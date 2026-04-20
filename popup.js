(function bootstrapPopup() {
  const statusEl = document.getElementById("popupStatus");

  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.style.color = isError ? "#fda4af" : "#93c5fd";
  }

  function getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs?.[0] || null);
      });
    });
  }

  async function sendAction(action) {
    const tab = await getActiveTab();
    if (!tab?.id) {
      setStatus("Active tab not found", true);
      return;
    }
    if (!tab.url || !tab.url.includes("supplier.meesho.com")) {
      setStatus("Open supplier.meesho.com first", true);
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action }, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        setStatus("Page not ready. Refresh Meesho tab.", true);
        return;
      }
      if (!response?.ok) {
        setStatus(response?.error || "Action failed", true);
        return;
      }
      const pretty = {
        openPanel: "Panel opened",
        detectFields: "Scanning started",
        uploadImage: "Image picker opened",
        analyzeProduct: "Analyzing started",
        fillListing: "Fill started",
        stop: "Stop sent"
      };
      setStatus(pretty[action] || "Done");
    });
  }

  document.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      sendAction(button.dataset.action);
    });
  });
})();
