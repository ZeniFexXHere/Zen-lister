(function attachMeeshoAiFiller() {
  const NS = "meeshoAiV2Filler";
  if (window[NS]) return;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalize = (s) =>
    String(s || "")
      .replace(/\*/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  function dispatchInputEvents(node) {
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    node.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function setNativeValue(node, value) {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), "value");
    if (descriptor?.set) descriptor.set.call(node, value);
    else node.value = value;
  }

  function mapValueByLabel(label, data, settings) {
    const l = normalize(label);
    const fallback = data.default || "N/A";

    if (l.includes("manufacturer") && l.includes("name") && !l.includes("packer") && !l.includes("importer")) {
      return settings.manufacturerName || data.title || fallback;
    }
    if (l.includes("manufacturer") && l.includes("address")) {
      return settings.manufacturerAddress || fallback;
    }
    if (l.includes("manufacturer") && (l.includes("pincode") || l.includes("pin code"))) {
      return settings.manufacturerPincode || fallback;
    }

    if (settings.tickSameAsManufacturer !== false) {
      if (l.includes("packer") && l.includes("name")) return settings.manufacturerName || fallback;
      if (l.includes("packer") && l.includes("address")) return settings.manufacturerAddress || fallback;
      if (l.includes("packer") && (l.includes("pincode") || l.includes("pin code"))) {
        return settings.manufacturerPincode || fallback;
      }
    } else {
      if (l.includes("packer") && l.includes("name")) return settings.packerName || settings.manufacturerName || fallback;
      if (l.includes("packer") && l.includes("address")) {
        return settings.packerAddress || settings.manufacturerAddress || fallback;
      }
      if (l.includes("packer") && (l.includes("pincode") || l.includes("pin code"))) {
        return settings.packerPincode || settings.manufacturerPincode || fallback;
      }
    }

    if (l.includes("importer") && l.includes("name")) return settings.importerName || settings.manufacturerName || fallback;
    if (l.includes("importer") && l.includes("address")) {
      return settings.importerAddress || settings.manufacturerAddress || fallback;
    }
    if (l.includes("importer") && (l.includes("pincode") || l.includes("pin code"))) {
      return settings.importerPincode || settings.manufacturerPincode || fallback;
    }

    if (l.includes("gst")) return data.gst || settings.gst || "18";
    if (l.includes("country") && (l.includes("origin") || l.includes("made"))) {
      return data.country || settings.country || "India";
    }
    if (l.includes("country")) return data.country || settings.country || "India";
    if (l.includes("weight") || l.includes("net weight")) return data.weight || settings.weight || "500 g";
    if (l.includes("color")) return data.color || fallback;
    if (l.includes("material") || l.includes("fabric")) return data.material || fallback;
    if (l.includes("brand")) return data.brand || settings.brand || fallback;
    if (l.includes("category")) return data.category || fallback;
    if (l.includes("pattern")) return data.pattern || fallback;
    if (l.includes("model")) return data.model || data.title || fallback;
    if (l.includes("sku")) return data.sku || fallback;
    if (l.includes("mrp") || l.includes("price")) return data.mrp || fallback;
    if (l.includes("battery")) return data.battery || "Rechargeable";
    if (l.includes("warranty")) return data.warranty || fallback;
    if (l.includes("hsn")) return data.hsn || "8517";
    if (l.includes("description")) return data.description || fallback;
    if (l.includes("size") && data.size) return data.size;
    if (l.includes("frequency")) return data.frequency || fallback;
    if (l.includes("bluetooth") && l.includes("range")) return data.bluetoothRange || fallback;
    if (l.includes("charging") && l.includes("type")) return data.chargingType || fallback;
    if (l.includes("charge") && l.includes("time")) return data.chargeTime || fallback;
    if (l.includes("power") && l.includes("source")) return data.powerSource || fallback;
    if (l.includes("compatibility")) return data.compatibility || fallback;

    if ((l.includes("product") && l.includes("name")) || l === "title" || (l.includes("listing") && l.includes("title"))) {
      return data.title || fallback;
    }

    if (l.includes("name") || l.includes("title")) return data.title || fallback;

    return fallback;
  }

  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function score(a, b) {
    const x = normalize(a);
    const y = normalize(b);
    if (!x || !y) return 0;
    if (x === y) return 100;
    if (x.includes(y) || y.includes(x)) return 75;
    const chunks = y.split(" ");
    return chunks.reduce((sum, c) => sum + (c && x.includes(c) ? 10 : 0), 0);
  }

  function distance(a, b) {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const dx = ar.left + ar.width / 2 - (br.left + br.width / 2);
    const dy = ar.top + ar.height / 2 - (br.top + br.height / 2);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function findLabelNodeFlexible(labelText) {
    const target = normalize(labelText);
    if (!target) return null;
    const nodes = Array.from(document.querySelectorAll("label,span,div,p,strong,td,th")).filter(isVisible);
    for (const n of nodes) {
      const t = normalize(n.textContent);
      if (t === target) return n;
    }
    for (const n of nodes) {
      const t = normalize(n.textContent);
      if (t.length > 80) continue;
      if (t.includes(target) || target.includes(t)) return n;
    }
    return null;
  }

  function findInputNearLabel(labelText, fallback) {
    const labelNode = findLabelNodeFlexible(labelText);
    if (!labelNode) return fallback || null;
    let scope =
      labelNode.closest("tr, [class*='grid'], [class*='Grid'], [class*='row'], [class*='Row'], section, form, li, div") ||
      labelNode.parentElement;
    for (let depth = 0; depth < 4 && scope; depth += 1) {
      const input = scope.querySelector(
        'input:not([type="checkbox"]):not([type="hidden"]):not([type="file"]):not([type="button"]):not([type="submit"]), textarea'
      );
      if (input instanceof HTMLElement && isVisible(input)) return input;
      scope = scope.parentElement;
    }
    return fallback || null;
  }

  function textVerify(field, expected) {
    const got = String(field.value || "").trim();
    const exp = String(expected || "").trim();
    if (!exp) return got.length >= 0;
    if (normalize(got) === normalize(exp)) return true;
    if (normalize(got).includes(normalize(exp)) || normalize(exp).includes(normalize(got))) return true;
    return false;
  }

  function dropdownCandidates() {
    return Array.from(
      document.querySelectorAll(
        [
          "select",
          '[role="combobox"]',
          '[aria-haspopup="listbox"]',
          '[class*="select"][tabindex]',
          '[class*="Select"][tabindex]'
        ].join(",")
      )
    ).filter(isVisible);
  }

  function findNearestDropdown(labelNode, fallback) {
    const candidates = dropdownCandidates();
    if (!labelNode || !candidates.length) return fallback;
    let best = fallback || null;
    let bestDistance = Number.POSITIVE_INFINITY;
    candidates.forEach((el) => {
      const d = distance(labelNode, el);
      if (d < bestDistance) {
        bestDistance = d;
        best = el;
      }
    });
    return best;
  }

  function getVisiblePopups() {
    return Array.from(document.querySelectorAll('[role="listbox"], [role="menu"], ul, div')).filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (!isVisible(el)) return false;
      const text = normalize(el.textContent);
      return text.length > 0 && (el.getAttribute("role") === "listbox" || el.getAttribute("role") === "menu");
    });
  }

  async function fillTextField(field, value) {
    field.scrollIntoView({ block: "center", behavior: "smooth" });
    await wait(100);
    field.click();
    field.focus();
    await wait(40);
    setNativeValue(field, "");
    dispatchInputEvents(field);
    await wait(50);
    setNativeValue(field, String(value));
    dispatchInputEvents(field);
    await wait(80);
    return textVerify(field, value);
  }

  async function fillNativeSelect(field, value) {
    const target = normalize(value);
    let selectedValue = null;
    Array.from(field.options).forEach((opt) => {
      if (selectedValue) return;
      if (score(opt.textContent, target) >= 90 || normalize(opt.value) === target) selectedValue = opt.value;
    });
    if (!selectedValue) {
      Array.from(field.options).forEach((opt) => {
        if (selectedValue) return;
        if (score(opt.textContent, target) >= 70) selectedValue = opt.value;
      });
    }
    if (!selectedValue) return false;
    field.focus();
    field.value = selectedValue;
    dispatchInputEvents(field);
    await wait(50);
    return true;
  }

  async function fillCustomDropdown(field, label, value, shouldStop, onStep) {
    const target = normalize(value);
    const labelNode = findLabelNodeFlexible(label);
    const dropdown = findNearestDropdown(labelNode, field);
    if (!(dropdown instanceof HTMLElement)) return false;

    if (shouldStop()) return false;
    if (dropdown.getBoundingClientRect().top < 40 || dropdown.getBoundingClientRect().bottom > window.innerHeight - 40) {
      dropdown.scrollIntoView({ block: "center", behavior: "smooth" });
      await wait(160);
    }

    onStep(`Opening dropdown for ${label}`);
    dropdown.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    dropdown.click();
    await wait(200);
    if (shouldStop()) return false;

    let activePopup = getVisiblePopups()[0];
    if (!activePopup) {
      dropdown.click();
      await wait(200);
      activePopup = getVisiblePopups()[0];
    }
    if (!activePopup) return false;

    const searchInput = activePopup.querySelector('input[type="text"], input[role="searchbox"]');
    if (searchInput) {
      searchInput.focus();
      setNativeValue(searchInput, String(value));
      dispatchInputEvents(searchInput);
      await wait(180);
    }

    const options = Array.from(activePopup.querySelectorAll('[role="option"], li, [data-value], div'))
      .filter(isVisible)
      .filter((el) => normalize(el.textContent).length > 0);
    let best = null;
    let bestScore = -1;
    options.forEach((opt) => {
      const s = score(opt.textContent, target);
      if (s > bestScore) {
        bestScore = s;
        best = opt;
      }
    });
    if (!best || bestScore < 70) return false;

    best.scrollIntoView({ block: "nearest", behavior: "smooth" });
    await wait(80);
    best.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    best.click();
    await wait(160);

    dropdown.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    await wait(80);

    const selectedText = normalize(dropdown.textContent || dropdown.value || "");
    return selectedText.includes(target) || selectedText === target || bestScore >= 90;
  }

  async function fillCheckbox(field, checked) {
    field.scrollIntoView({ block: "center", behavior: "smooth" });
    await wait(80);
    if (field.checked === checked) return true;
    field.click();
    await wait(60);
    if (field.checked !== checked) {
      field.checked = checked;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return field.checked === checked;
  }

  async function ensureSameAsManufacturerCheckbox(settings) {
    if (settings.tickSameAsManufacturer === false) return;
    const boxes = document.querySelectorAll('input[type="checkbox"]');
    for (const box of boxes) {
      if (!(box instanceof HTMLElement)) continue;
      const wrap = box.closest("label");
      const forLabel = box.id ? document.querySelector(`label[for="${CSS.escape(box.id)}"]`) : null;
      const text = normalize(`${wrap?.textContent || ""} ${forLabel?.textContent || ""}`);
      if (text.includes("same as manufacturer")) {
        await fillCheckbox(box, true);
        return;
      }
    }
  }

  function fillRank(label) {
    const l = normalize(label);
    if (l.includes("manufacturer") && l.includes("name") && !l.includes("packer")) return 5;
    if (l.includes("manufacturer") && l.includes("address")) return 6;
    if (l.includes("manufacturer") && (l.includes("pincode") || l.includes("pin code"))) return 7;
    if (l.includes("same as manufacturer")) return 8;
    if (l.includes("packer") && l.includes("name")) return 15;
    if (l.includes("packer") && l.includes("address")) return 16;
    if (l.includes("packer") && (l.includes("pincode") || l.includes("pin code"))) return 17;
    if (l.includes("importer") && l.includes("name")) return 25;
    if (l.includes("importer") && l.includes("address")) return 26;
    if (l.includes("importer") && (l.includes("pincode") || l.includes("pin code"))) return 27;
    if (l.includes("gst")) return 40;
    if (l.includes("hsn")) return 41;
    if (l.includes("product") && l.includes("name")) return 45;
    if (l.includes("description")) return 46;
    return 100;
  }

  function sortEntries(entries) {
    return [...entries].sort((a, b) => fillRank(a.label) - fillRank(b.label));
  }

  async function fillOneField(fieldEntry, node, data, settings, shouldStop, onStep) {
    const value = mapValueByLabel(fieldEntry.label, data, settings);
    if (shouldStop()) return { done: false, value, reason: "stopped" };

    const kind = fieldEntry.kind;
    let targetNode = node;
    if (kind === "text" || kind === "textarea") {
      targetNode = findInputNearLabel(fieldEntry.label, node);
    } else if (kind === "dropdown") {
      const ln = findLabelNodeFlexible(fieldEntry.label);
      targetNode = findNearestDropdown(ln, node);
    }

    if (!targetNode || !(targetNode instanceof HTMLElement)) {
      return { done: false, value, reason: "missing-node" };
    }

    if (kind === "checkbox") {
      const nl = normalize(fieldEntry.label);
      if (nl.includes("same as manufacturer") && settings.tickSameAsManufacturer !== false) {
        const ok = await fillCheckbox(targetNode, true);
        return { done: ok, value: "true", reason: ok ? "checkbox-checked" : "checkbox-failed" };
      }
      return { done: true, value: "", reason: "checkbox-skipped" };
    }

    if (kind === "text" || kind === "textarea") {
      let ok = await fillTextField(targetNode, value);
      if (!ok) {
        await wait(100);
        ok = await fillTextField(targetNode, value);
      }
      return { done: ok, value, reason: ok ? "text-filled" : "text-verify-failed" };
    }
    if (targetNode.tagName.toLowerCase() === "select") {
      const ok = await fillNativeSelect(targetNode, value);
      return { done: ok, value, reason: ok ? "dropdown-filled" : "native-dropdown-failed" };
    }
    if (kind === "dropdown") {
      const ok = await fillCustomDropdown(targetNode, fieldEntry.label, value, shouldStop, onStep);
      return { done: ok, value, reason: ok ? "dropdown-filled" : "custom-dropdown-failed" };
    }
    return { done: false, value, reason: "unsupported-kind" };
  }

  async function fillListing(entries, options) {
    const getNodeById = options.getNodeById;
    const data = options.analysis || {};
    const settings = options.settings || {};
    const shouldStop = options.shouldStop || (() => false);
    const onProgress = options.onProgress || (() => {});
    const onStep = options.onStep || (() => {});
    const retries = Math.max(1, Math.min(5, Number(settings.retryCount) || 3));

    const ordered = sortEntries(entries);
    let success = 0;
    const failedFields = [];
    let sameAsManufacturerEnsured = false;

    for (let i = 0; i < ordered.length; i += 1) {
      if (shouldStop()) break;
      const entry = ordered[i];
      const rank = fillRank(entry.label);
      if (rank >= 15 && !sameAsManufacturerEnsured) {
        sameAsManufacturerEnsured = true;
        await ensureSameAsManufacturerCheckbox(settings);
      }
      const node = getNodeById(entry.id);
      let result = { done: false, reason: "unattempted", value: "" };

      for (let attempt = 1; attempt <= retries; attempt += 1) {
        if (shouldStop()) break;
        onStep(`Filling ${entry.label || entry.id} (try ${attempt}/${retries})`);
        result = await fillOneField(entry, node, data, settings, shouldStop, onStep);
        if (result.done || result.reason === "checkbox-skipped") break;
        await wait(120);
      }

      if (result.done && result.reason !== "checkbox-skipped") success += 1;
      else if (!result.done && result.reason !== "checkbox-skipped") failedFields.push(entry.label || entry.id);

      onProgress({
        index: i,
        total: ordered.length,
        entry,
        result
      });
      await wait(60);
    }

    if (!sameAsManufacturerEnsured && settings.tickSameAsManufacturer !== false) {
      await ensureSameAsManufacturerCheckbox(settings);
    }

    return {
      total: ordered.length,
      filled: success,
      failed: failedFields
    };
  }

  window[NS] = { fillListing };
})();
