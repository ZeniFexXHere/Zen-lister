(function attachMeeshoAiListingToolUi() {
  const NS = "meeshoAiV2Ui";
  if (window[NS]) return;

  const ROOT_CLASS = "meesho-ai-v2-panel";
  const LOG_CLASS = "meesho-ai-v2-log-line";

  function createButton(label, action) {
    const btn = document.createElement("button");
    btn.className = "meesho-ai-v2-btn";
    btn.type = "button";
    btn.textContent = label;
    btn.dataset.action = action;
    return btn;
  }

  function enableDrag(root, handle) {
    let active = false;
    let offsetX = 0;
    let offsetY = 0;

    function onDown(ev) {
      if (ev.button !== 0) return;
      const rect = root.getBoundingClientRect();
      active = true;
      offsetX = ev.clientX - rect.left;
      offsetY = ev.clientY - rect.top;
      root.style.right = "auto";
      ev.preventDefault();
    }

    function onMove(ev) {
      if (!active) return;
      const x = Math.max(8, Math.min(window.innerWidth - root.offsetWidth - 8, ev.clientX - offsetX));
      const y = Math.max(8, Math.min(window.innerHeight - root.offsetHeight - 8, ev.clientY - offsetY));
      root.style.left = `${x}px`;
      root.style.top = `${y}px`;
    }

    function onUp() {
      active = false;
    }

    handle.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function buildPanel() {
    const root = document.createElement("section");
    root.className = ROOT_CLASS;
    root.setAttribute("aria-label", "Meesho AI Listing Tool V2");
    root.style.left = `${window.innerWidth - 390}px`;
    root.style.top = "90px";

    const header = document.createElement("div");
    header.className = "meesho-ai-v2-header";
    header.innerHTML = `
      <div>
        <div class="meesho-ai-v2-title">Meesho AI Listing Tool</div>
        <div class="meesho-ai-v2-subtitle">Premium V2</div>
      </div>
      <span class="meesho-ai-v2-chip">LIVE</span>
    `;

    const buttonGrid = document.createElement("div");
    buttonGrid.className = "meesho-ai-v2-grid";
    const buttons = [
      createButton("Detect Fields", "detect"),
      createButton("Upload Image", "upload"),
      createButton("Analyze Product", "analyze"),
      createButton("Fill Listing", "fill"),
      createButton("Stop", "stop"),
      createButton("Clear Highlights", "clear"),
      createButton("Settings", "settings")
    ];
    buttons.forEach((btn) => buttonGrid.appendChild(btn));

    const status = document.createElement("div");
    status.className = "meesho-ai-v2-status";
    status.textContent = "Ready";

    const progressWrap = document.createElement("div");
    progressWrap.className = "meesho-ai-v2-progress-wrap";
    progressWrap.innerHTML = `
      <div class="meesho-ai-v2-progress-label">Progress</div>
      <div class="meesho-ai-v2-progress-track">
        <div class="meesho-ai-v2-progress-fill"></div>
      </div>
    `;

    const counters = document.createElement("div");
    counters.className = "meesho-ai-v2-counters";
    counters.innerHTML = `
      <span>Detected: <strong data-k="detected">0</strong></span>
      <span>Dropdowns: <strong data-k="dropdowns">0</strong></span>
      <span>Missing: <strong data-k="missing">0</strong></span>
    `;

    const logs = document.createElement("div");
    logs.className = "meesho-ai-v2-log";
    logs.setAttribute("aria-live", "polite");

    root.appendChild(header);
    root.appendChild(buttonGrid);
    root.appendChild(status);
    root.appendChild(progressWrap);
    root.appendChild(counters);
    root.appendChild(logs);
    document.body.appendChild(root);
    enableDrag(root, header);

    const byAction = {};
    buttons.forEach((btn) => {
      byAction[btn.dataset.action] = btn;
    });

    return {
      root,
      status,
      logs,
      byAction,
      progressFill: progressWrap.querySelector(".meesho-ai-v2-progress-fill"),
      counterDetected: counters.querySelector('[data-k="detected"]'),
      counterDropdowns: counters.querySelector('[data-k="dropdowns"]'),
      counterMissing: counters.querySelector('[data-k="missing"]')
    };
  }

  function buildSettingsModal() {
    const overlay = document.createElement("div");
    overlay.className = "meesho-ai-v2-settings-overlay";
    overlay.innerHTML = `
      <div class="meesho-ai-v2-settings">
        <div class="meesho-ai-v2-settings-title">Default Settings</div>
        <div class="meesho-ai-v2-settings-section">Business (saved — used on Fill)</div>
        <label>Manufacturer Name <input data-key="manufacturerName" type="text" placeholder="Your legal name" /></label>
        <label>Manufacturer Address <input data-key="manufacturerAddress" type="text" placeholder="Full address" /></label>
        <label>Manufacturer Pincode <input data-key="manufacturerPincode" type="text" placeholder="6 digit" /></label>
        <label>Importer Name <input data-key="importerName" type="text" /></label>
        <label>Importer Address <input data-key="importerAddress" type="text" /></label>
        <label>Importer Pincode <input data-key="importerPincode" type="text" /></label>
        <label class="meesho-ai-v2-settings-row">
          <input data-key="tickSameAsManufacturer" type="checkbox" />
          After manufacturer, tick “Same as Manufacturer” (Packer)
        </label>
        <div class="meesho-ai-v2-settings-hint">If unticked, fill Packer below</div>
        <label>Packer Name <input data-key="packerName" type="text" /></label>
        <label>Packer Address <input data-key="packerAddress" type="text" /></label>
        <label>Packer Pincode <input data-key="packerPincode" type="text" /></label>
        <div class="meesho-ai-v2-settings-section">Listing defaults</div>
        <label>GST <input data-key="gst" type="text" /></label>
        <label>Country <input data-key="country" type="text" /></label>
        <label>Weight <input data-key="weight" type="text" /></label>
        <label>Brand <input data-key="brand" type="text" /></label>
        <label>Retry Count <input data-key="retryCount" type="number" min="1" max="5" /></label>
        <div class="meesho-ai-v2-settings-actions">
          <button type="button" data-action="cancel">Cancel</button>
          <button type="button" data-action="save">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function createUi(handlers) {
    const panel = buildPanel();
    const on = handlers || {};
    const counterKeys = ["detected", "dropdowns", "missing"];

    Object.entries(panel.byAction).forEach(([action, btn]) => {
      btn.addEventListener("click", () => {
        if (typeof on[action] === "function") on[action]();
      });
    });

    function setStatus(text) {
      panel.status.textContent = text || "Ready";
    }

    function setProgress(percent) {
      const normalized = Math.max(0, Math.min(100, Number(percent) || 0));
      panel.progressFill.style.width = `${normalized}%`;
    }

    function setCounters(stats) {
      const values = {
        detected: Number(stats?.detected || 0),
        dropdowns: Number(stats?.dropdowns || 0),
        missing: Number(stats?.missing || 0)
      };
      counterKeys.forEach((key) => {
        const el =
          key === "detected" ? panel.counterDetected : key === "dropdowns" ? panel.counterDropdowns : panel.counterMissing;
        el.textContent = String(values[key]);
      });
    }

    function pushLog(message, type) {
      const line = document.createElement("div");
      line.className = `${LOG_CLASS} ${type ? `${LOG_CLASS}--${type}` : ""}`.trim();
      line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
      panel.logs.prepend(line);
    }

    function setButtonDisabled(action, disabled) {
      if (panel.byAction[action]) panel.byAction[action].disabled = Boolean(disabled);
    }

    function openSettings(initialValues, onSave) {
      const modal = buildSettingsModal();
      const inputs = {};
      [
        "manufacturerName",
        "manufacturerAddress",
        "manufacturerPincode",
        "importerName",
        "importerAddress",
        "importerPincode",
        "tickSameAsManufacturer",
        "packerName",
        "packerAddress",
        "packerPincode",
        "gst",
        "country",
        "weight",
        "brand",
        "retryCount"
      ].forEach((key) => {
        inputs[key] = modal.querySelector(`[data-key="${key}"]`);
      });
      Object.keys(inputs).forEach((key) => {
        const el = inputs[key];
        if (!el) return;
        if (el.type === "checkbox") {
          el.checked = Boolean(initialValues?.[key]);
          return;
        }
        el.value = key in (initialValues || {}) && initialValues[key] != null ? String(initialValues[key]) : "";
      });

      modal.querySelector('[data-action="cancel"]').addEventListener("click", () => modal.remove());
      modal.querySelector('[data-action="save"]').addEventListener("click", () => {
        const payload = {
          manufacturerName: inputs.manufacturerName.value.trim(),
          manufacturerAddress: inputs.manufacturerAddress.value.trim(),
          manufacturerPincode: inputs.manufacturerPincode.value.trim(),
          importerName: inputs.importerName.value.trim(),
          importerAddress: inputs.importerAddress.value.trim(),
          importerPincode: inputs.importerPincode.value.trim(),
          tickSameAsManufacturer: Boolean(inputs.tickSameAsManufacturer?.checked),
          packerName: inputs.packerName.value.trim(),
          packerAddress: inputs.packerAddress.value.trim(),
          packerPincode: inputs.packerPincode.value.trim(),
          gst: inputs.gst.value.trim(),
          country: inputs.country.value.trim(),
          weight: inputs.weight.value.trim(),
          brand: inputs.brand.value.trim(),
          retryCount: Math.max(1, Math.min(5, Number(inputs.retryCount.value) || 3))
        };
        if (typeof onSave === "function") onSave(payload);
        modal.remove();
      });
    }

    function showPanel() {
      panel.root.style.display = "block";
      panel.root.style.opacity = "1";
      panel.root.style.pointerEvents = "auto";
    }

    return {
      setStatus,
      setProgress,
      setCounters,
      pushLog,
      setButtonDisabled,
      openSettings,
      showPanel
    };
  }

  window[NS] = { createUi };
})();
