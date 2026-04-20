(function attachMeeshoAiDetector() {
  const NS = "meeshoAiV2Detector";
  if (window[NS]) return;

  const ATTR_MARK = "data-meesho-ai-field";
  const ATTR_ORIG_OUTLINE = "data-meesho-ai-orig-outline";
  const ATTR_ORIG_OFFSET = "data-meesho-ai-orig-offset";
  const ATTR_TAG = "data-meesho-ai-tag";

  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }

  function inferKind(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "textarea") return "textarea";
    if (tag === "select") return "dropdown";
    if (el.getAttribute("role") === "combobox" || el.getAttribute("aria-haspopup") === "listbox") return "dropdown";
    if (tag === "input" && el.type === "checkbox") return "checkbox";
    if (tag === "input") return "text";
    return "unknown";
  }

  function getLabelForField(el) {
    if (!(el instanceof HTMLElement)) return "";
    if (el.id) {
      const byFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (byFor?.textContent?.trim()) return byFor.textContent.trim();
    }
    const parentLabel = el.closest("label");
    if (parentLabel?.textContent?.trim()) return parentLabel.textContent.trim();

    const row = el.closest("[class*='row'],[class*='Row'],[class*='field'],[class*='Field'],div,section,li,form") || el.parentElement;
    if (row) {
      const rowText = row.innerText || "";
      const firstLine = rowText.split("\n").map((s) => s.trim()).find((s) => s.length > 0 && s.length < 120);
      if (firstLine && !firstLine.match(/^enter\s/i)) return firstLine;

      const nearLabels = row.querySelectorAll("label, span[class*='label'], p, [class*='Label']");
      for (const node of nearLabels) {
        const text = node.textContent?.trim();
        if (text && text.length <= 100 && text.length >= 2) return text;
      }
    }

    const candidates = Array.from(el.closest("div,section,form,li")?.querySelectorAll("label,span,strong") || []);
    for (const node of candidates) {
      const text = node.textContent?.trim();
      if (text && text.length <= 80) return text;
    }
    return el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("name") || el.id || "Unnamed";
  }

  function isRequiredField(el, label) {
    if (el.required || el.getAttribute("aria-required") === "true") return true;
    const around = `${label} ${el.closest("label,div,section,li")?.textContent || ""}`.toLowerCase();
    return around.includes("*") || around.includes("required");
  }

  function valueLooksEmpty(el) {
    const v = String(el.value || "").trim();
    if (!v) return true;
    if (/^n\/a$/i.test(v)) return true;
    return false;
  }

  function createFieldTag(el, typeLabel, color) {
    const rect = el.getBoundingClientRect();
    const tag = document.createElement("span");
    tag.setAttribute(ATTR_TAG, "1");
    tag.style.left = `${window.scrollX + rect.left}px`;
    tag.style.top = `${window.scrollY + Math.max(0, rect.top - 18)}px`;
    tag.style.background = color;
    tag.textContent = typeLabel;
    document.body.appendChild(tag);
  }

  function markField(el, color) {
    if (!(el instanceof HTMLElement)) return;
    if (!el.hasAttribute(ATTR_ORIG_OUTLINE)) {
      el.setAttribute(ATTR_ORIG_OUTLINE, el.style.outline || "");
      el.setAttribute(ATTR_ORIG_OFFSET, el.style.outlineOffset || "");
    }
    el.style.outline = `2px solid ${color}`;
    el.style.outlineOffset = "1px";
  }

  function clearHighlights() {
    const marked = document.querySelectorAll(`[${ATTR_MARK}]`);
    marked.forEach((node) => {
      if (node instanceof HTMLElement) {
        node.style.outline = node.getAttribute(ATTR_ORIG_OUTLINE) || "";
        node.style.outlineOffset = node.getAttribute(ATTR_ORIG_OFFSET) || "";
        node.removeAttribute(ATTR_ORIG_OUTLINE);
        node.removeAttribute(ATTR_ORIG_OFFSET);
        node.removeAttribute(ATTR_MARK);
      }
    });
    document.querySelectorAll(`[${ATTR_TAG}]`).forEach((tag) => tag.remove());
  }

  function detectFields() {
    clearHighlights();
    const selectors = [
      'input:not([type="hidden"]):not([disabled])',
      "textarea:not([disabled])",
      "select:not([disabled])",
      '[role="combobox"]',
      '[aria-haspopup="listbox"]'
    ];
    const all = Array.from(document.querySelectorAll(selectors.join(","))).filter(isVisible);
    const unique = [...new Set(all)];

    const fields = [];
    let dropdownCount = 0;
    let missingCount = 0;

    unique.forEach((el, index) => {
      const kind = inferKind(el);
      const label = getLabelForField(el);
      const required = isRequiredField(el, label);
      const id = `field_${index}_${(label || "x").replace(/\s+/g, "_").toLowerCase()}`;
      const missing = required && (kind === "text" || kind === "textarea") && valueLooksEmpty(el);
      const color =
        missing ? "#ef4444" : kind === "dropdown" ? "#3b82f6" : kind === "checkbox" ? "#a78bfa" : "#22c55e";
      if (kind === "dropdown") dropdownCount += 1;
      if (missing) missingCount += 1;

      el.setAttribute(ATTR_MARK, id);
      markField(el, color);
      createFieldTag(el, `${kind.toUpperCase()}${required ? " *" : ""}`, color);

      fields.push({
        id,
        kind,
        label,
        required,
        missing
      });
    });

    const stats = {
      detected: fields.length,
      dropdowns: dropdownCount,
      missing: missingCount
    };

    return { fields, stats };
  }

  function getFieldNodeById(id) {
    return document.querySelector(`[${ATTR_MARK}="${CSS.escape(id)}"]`);
  }

  window[NS] = { detectFields, clearHighlights, getFieldNodeById };
})();
