(function bootstrapMeeshoAiListingTool() {
  const APP_NS = "meeshoAiV2App";
  if (window[APP_NS]) return;
  if (location.hostname !== "supplier.meesho.com") return;

  const uiModule = window.meeshoAiV2Ui;
  const detector = window.meeshoAiV2Detector;
  const analyzer = window.meeshoAiV2Analyzer;
  const filler = window.meeshoAiV2Filler;
  if (!uiModule || !detector || !analyzer || !filler) return;

  const state = {
    running: false,
    stopRequested: false,
    fields: [],
    imageFile: null,
    analysis: null,
    settings: {
      manufacturerName: "",
      manufacturerAddress: "",
      manufacturerPincode: "",
      importerName: "",
      importerAddress: "",
      importerPincode: "",
      tickSameAsManufacturer: true,
      packerName: "",
      packerAddress: "",
      packerPincode: "",
      gst: "18",
      country: "India",
      weight: "500 g",
      brand: "Generic",
      retryCount: 3
    }
  };

  function storageGet(key) {
    return new Promise((resolve) => {
      if (!chrome?.storage?.local) return resolve({});
      chrome.storage.local.get([key], (res) => resolve(res || {}));
    });
  }

  function storageSet(key, value) {
    return new Promise((resolve) => {
      if (!chrome?.storage?.local) return resolve();
      chrome.storage.local.set({ [key]: value }, () => resolve());
    });
  }

  function openFilePicker() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";
      document.body.appendChild(input);
      input.addEventListener("change", () => {
        const file = input.files?.[0] || null;
        input.remove();
        resolve(file);
      });
      input.click();
    });
  }

  function setBusy(running) {
    state.running = Boolean(running);
    app.ui.setButtonDisabled("detect", running);
    app.ui.setButtonDisabled("upload", running);
    app.ui.setButtonDisabled("analyze", running);
    app.ui.setButtonDisabled("fill", running);
    app.ui.setButtonDisabled("clear", running);
    app.ui.setButtonDisabled("settings", running);
    app.ui.setButtonDisabled("stop", !running);
  }

  function log(message, type) {
    app.ui.pushLog(message, type);
    console.log(`[Meesho AI V2] ${message}`);
  }

  async function loadSettings() {
    const stored = await storageGet("meeshoAiV2Settings");
    state.settings = { ...state.settings, ...(stored.meeshoAiV2Settings || {}) };
  }

  async function onDetect() {
    state.stopRequested = false;
    setBusy(true);
    app.ui.setStatus("Scanning...");
    app.ui.setProgress(8);
    try {
      const result = detector.detectFields();
      state.fields = result.fields;
      app.ui.setCounters(result.stats);
      app.ui.setProgress(100);
      app.ui.setStatus(`Detected Fields: ${result.stats.detected}`);
      log(
        `Detected Fields: ${result.stats.detected} | Dropdowns: ${result.stats.dropdowns} | Missing: ${result.stats.missing}`,
        "success"
      );
    } catch (error) {
      app.ui.setStatus("Scan failed");
      log(`Detect error: ${error.message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function onUpload() {
    state.stopRequested = false;
    setBusy(true);
    app.ui.setStatus("Choose product image...");
    app.ui.setProgress(15);
    try {
      const file = await openFilePicker();
      if (!file) {
        app.ui.setStatus("Upload canceled");
        app.ui.setProgress(0);
        log("No image selected.", "warn");
        return;
      }
      state.imageFile = file;
      app.ui.setStatus(`Image uploaded: ${file.name}`);
      app.ui.setProgress(100);
      log(`Image uploaded: ${file.name}`, "success");
    } catch (error) {
      app.ui.setStatus("Upload failed");
      log(`Upload error: ${error.message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function onAnalyze() {
    state.stopRequested = false;
    setBusy(true);
    app.ui.setStatus("Analyzing...");
    app.ui.setProgress(20);
    try {
      state.analysis = await analyzer.analyzeImage(state.imageFile, state.settings);
      app.ui.setProgress(100);
      app.ui.setStatus("Analysis complete");
      log(`Category: ${state.analysis.category} | Type: ${state.analysis.type} | Color: ${state.analysis.color}`, "success");
    } catch (error) {
      app.ui.setStatus("Analyze failed");
      log(`Analyze error: ${error.message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function onFill() {
    state.stopRequested = false;
    setBusy(true);
    app.ui.setStatus("Filling listing...");
    app.ui.setProgress(4);
    try {
      if (!state.fields.length) {
        const result = detector.detectFields();
        state.fields = result.fields;
        app.ui.setCounters(result.stats);
        log("Auto-detected fields before fill.", "warn");
      }
      if (!state.analysis) {
        state.analysis = await analyzer.analyzeImage(state.imageFile, state.settings);
        log("Analysis created automatically before fill.", "warn");
      }

      const result = await filler.fillListing(state.fields, {
        analysis: state.analysis,
        settings: state.settings,
        getNodeById: detector.getFieldNodeById,
        shouldStop: () => state.stopRequested,
        onStep: (message) => {
          if (!state.stopRequested) app.ui.setStatus(message);
        },
        onProgress: ({ index, total, entry, result: stepResult }) => {
          const pct = Math.round(((index + 1) / Math.max(total, 1)) * 100);
          app.ui.setProgress(pct);
          const fieldName = entry.label || entry.id;
          const kind = stepResult.done ? "success" : "warn";
          app.ui.setStatus(`Filling ${fieldName}...`);
          log(`${index + 1}/${total} ${fieldName} => ${stepResult.reason}`, kind);
        }
      });

      if (state.stopRequested) {
        app.ui.setStatus("Stopped by user");
        log("Autofill stopped.", "warn");
      } else {
        app.ui.setStatus("Completed");
        log(`Completed: ${result.filled}/${result.total} filled.`, "success");
        if (result.failed.length) {
          log(`Failed fields: ${result.failed.join(", ")}`, "warn");
        }
      }
    } catch (error) {
      app.ui.setStatus("Fill failed");
      log(`Fill error: ${error.message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  function onStop() {
    state.stopRequested = true;
    app.ui.setStatus("Stop requested...");
    log("Stop signal sent. Current step will end immediately.", "warn");
  }

  function onClear() {
    detector.clearHighlights();
    app.ui.setCounters({ detected: 0, dropdowns: 0, missing: 0 });
    app.ui.setProgress(0);
    app.ui.setStatus("Highlights cleared");
    log("All highlights and tags removed.", "success");
  }

  function onSettings() {
    app.ui.openSettings(state.settings, async (values) => {
      state.settings = { ...state.settings, ...values };
      await storageSet("meeshoAiV2Settings", state.settings);
      log("Settings saved.", "success");
    });
  }

  function onOpenPanel() {
    app.ui.showPanel();
    app.ui.setStatus("Panel opened");
    log("Panel opened from extension popup.", "success");
  }

  const app = {
    ui: uiModule.createUi({
      detect: onDetect,
      upload: onUpload,
      analyze: onAnalyze,
      fill: onFill,
      stop: onStop,
      clear: onClear,
      settings: onSettings
    })
  };

  app.ui.setCounters({ detected: 0, dropdowns: 0, missing: 0 });
  app.ui.setProgress(0);
  app.ui.setStatus("Ready");
  app.ui.showPanel();
  setBusy(false);
  loadSettings().then(() => {
    log("Settings loaded.", "success");
  });
  log("Meesho AI Listing Tool V2 ready.", "success");

  window[APP_NS] = {
    stop: onStop
  };

  if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const action = message?.action;
      const actionMap = {
        openPanel: onOpenPanel,
        detectFields: onDetect,
        uploadImage: onUpload,
        analyzeProduct: onAnalyze,
        fillListing: onFill,
        stop: onStop,
        clearHighlights: onClear,
        settings: onSettings
      };
      if (!actionMap[action]) {
        sendResponse?.({ ok: false, error: "Unknown action" });
        return false;
      }
      Promise.resolve(actionMap[action]())
        .then(() => sendResponse?.({ ok: true }))
        .catch((error) => sendResponse?.({ ok: false, error: error?.message || "Action failed" }));
      return true;
    });
  }
})();
