(function attachMeeshoAiAnalyzer() {
  const NS = "meeshoAiV2Analyzer";
  if (window[NS]) return;

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .trim();
  }

  function detectByKeywords(name) {
    const s = normalize(name);
    if (s.includes("ring") && (s.includes("smart") || s.includes("health"))) {
      return {
        category: "Electronics",
        type: "Smart Ring",
        material: "Titanium Alloy",
        battery: "Rechargeable",
        hsn: "8517",
        bluetoothRange: "10 m",
        chargingType: "Magnetic",
        chargeTime: "1 Hour",
        powerSource: "Battery",
        compatibility: "Android & iOS"
      };
    }
    if (s.includes("watch") || s.includes("smartwatch")) {
      return {
        category: "Electronics",
        type: "Smartwatch",
        material: "Silicone Strap",
        battery: "Rechargeable",
        hsn: "8517",
        warranty: "1 Year"
      };
    }
    if (s.includes("neckband") || s.includes("bluetooth") || s.includes("earphone") || s.includes("earbud")) {
      return {
        category: "Electronics",
        type: "Neckband",
        material: "ABS Plastic",
        battery: "Rechargeable",
        hsn: "8518",
        bluetoothRange: "10 m",
        chargingType: "USB",
        chargeTime: "2 Hours"
      };
    }
    if (s.includes("shoe") || s.includes("sneaker") || s.includes("slipper")) {
      return {
        category: "Shoes",
        type: "Casual Shoes",
        material: "Synthetic",
        battery: "",
        size: "8",
        hsn: "6404"
      };
    }
    if (s.includes("saree")) {
      return {
        category: "Sarees",
        type: "Saree",
        material: "Silk Blend",
        pattern: "Printed",
        hsn: "5407"
      };
    }
    if (s.includes("kurti")) {
      return {
        category: "Women Ethnic",
        type: "Kurti",
        material: "Cotton",
        hsn: "6204"
      };
    }
    if (s.includes("phone") || s.includes("mobile") || s.includes("cover")) {
      return {
        category: "Electronics",
        type: "Mobile Accessory",
        material: "Polycarbonate",
        hsn: "8517"
      };
    }
    return {
      category: "General",
      type: "Regular",
      material: "Mixed",
      hsn: "8517"
    };
  }

  function rgbToColorName(r, g, b) {
    const palette = [
      { name: "Black", rgb: [20, 20, 20] },
      { name: "White", rgb: [240, 240, 240] },
      { name: "Gray", rgb: [128, 128, 128] },
      { name: "Silver", rgb: [192, 192, 200] },
      { name: "Red", rgb: [220, 38, 38] },
      { name: "Blue", rgb: [37, 99, 235] },
      { name: "Green", rgb: [34, 197, 94] },
      { name: "Pink", rgb: [236, 72, 153] },
      { name: "Yellow", rgb: [250, 204, 21] },
      { name: "Brown", rgb: [120, 72, 36] },
      { name: "Gold", rgb: [212, 175, 55] }
    ];
    let best = palette[0];
    let bestDist = Number.POSITIVE_INFINITY;
    palette.forEach((entry) => {
      const d =
        Math.pow(entry.rgb[0] - r, 2) + Math.pow(entry.rgb[1] - g, 2) + Math.pow(entry.rgb[2] - b, 2);
      if (d < bestDist) {
        bestDist = d;
        best = entry;
      }
    });
    return best.name;
  }

  function sampleRegion(ctx, x0, y0, w, h) {
    const data = ctx.getImageData(x0, y0, w, h).data;
    let rs = 0;
    let gs = 0;
    let bs = 0;
    let n = 0;
    let edge = 0;
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const a = data[i + 3];
        if (a < 40) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        rs += r;
        gs += g;
        bs += b;
        n += 1;
        if (x > 0 && y > 0) {
          const j = ((y - 2) * w + (x - 2)) * 4;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const lum2 = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
          edge += Math.abs(lum - lum2);
        }
      }
    }
    if (!n) return { r: 20, g: 20, b: 20, edge: 0 };
    return { r: Math.round(rs / n), g: Math.round(gs / n), b: Math.round(bs / n), edge: edge / Math.max(n, 1) };
  }

  function analyzeImagePixels(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const maxSide = 160;
          let tw = img.width;
          let th = img.height;
          if (tw > th) {
            if (tw > maxSide) {
              th = Math.round((th * maxSide) / tw);
              tw = maxSide;
            }
          } else if (th > maxSide) {
            tw = Math.round((tw * maxSide) / th);
            th = maxSide;
          }
          canvas.width = tw;
          canvas.height = th;
          ctx.drawImage(img, 0, 0, tw, th);

          const cx = Math.floor(tw / 4);
          const cy = Math.floor(th / 4);
          const center = sampleRegion(ctx, cx, cy, Math.floor(tw / 2), Math.floor(th / 2));
          const topLeft = sampleRegion(ctx, 0, 0, cx, cy);
          const botRight = sampleRegion(ctx, tw - cx, th - cy, cx, cy);

          const dominant = rgbToColorName(center.r, center.g, center.b);
          const secondary = rgbToColorName(topLeft.r, topLeft.g, topLeft.b);
          const edgeScore = center.edge + topLeft.edge + botRight.edge;

          let visualHint = "general";
          if (edgeScore > 18 && (center.r + center.g + center.b) / 3 < 100) visualHint = "dark_product";
          else if (edgeScore > 22) visualHint = "detailed_texture";
          else if (Math.abs(center.r - topLeft.r) + Math.abs(center.g - topLeft.g) + Math.abs(center.b - topLeft.b) > 120) {
            visualHint = "high_contrast_background";
          }

          resolve({
            dominantColor: dominant,
            secondaryAccent: secondary,
            visualHint,
            edgeScore
          });
        };
        img.onerror = () => reject(new Error("Unable to read image"));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error("Unable to load image file"));
      reader.readAsDataURL(file);
    });
  }

  async function analyzeImage(file, settings) {
    const fromName = detectByKeywords(file?.name || "");
    const safeName = (file?.name || "product").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    const brand =
      settings.brand ||
      (normalize(safeName).includes("nike")
        ? "Nike"
        : normalize(safeName).includes("boat")
          ? "boAt"
          : "Generic");

    let pixels = {
      dominantColor: "Black",
      secondaryAccent: "",
      visualHint: "general",
      edgeScore: 0
    };
    if (file) {
      try {
        pixels = await analyzeImagePixels(file);
      } catch {
        pixels.dominantColor = "Black";
      }
    }

    const sku = `SKU-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
    const title = safeName ? `${safeName} ${fromName.type}` : `${fromName.type} Premium`;
    const descParts = [
      `Category: ${fromName.category}.`,
      `Type: ${fromName.type}.`,
      `Primary color (image): ${pixels.dominantColor}.`,
      fromName.material ? `Material: ${fromName.material}.` : "",
      pixels.secondaryAccent ? `Accent: ${pixels.secondaryAccent}.` : "",
      pixels.visualHint !== "general" ? `Visual: ${pixels.visualHint.replace(/_/g, " ")}.` : ""
    ];

    return {
      title,
      description: descParts.filter(Boolean).join(" "),
      category: fromName.category,
      type: fromName.type,
      color: pixels.dominantColor,
      secondaryColor: pixels.secondaryAccent,
      material: fromName.material,
      brand,
      battery: fromName.battery || "",
      pattern: fromName.pattern || "",
      size: fromName.size || "",
      gst: settings.gst || "18",
      country: settings.country || "India",
      weight: settings.weight || "500 g",
      hsn: fromName.hsn || "8517",
      warranty: fromName.warranty || "6 Months",
      sku,
      mrp: "999",
      model: safeName.slice(0, 40) || fromName.type,
      bluetoothRange: fromName.bluetoothRange || "",
      chargingType: fromName.chargingType || "",
      chargeTime: fromName.chargeTime || "",
      powerSource: fromName.powerSource || "",
      compatibility: fromName.compatibility || "",
      frequency: fromName.frequency || "",
      default: "N/A"
    };
  }

  window[NS] = { analyzeImage };
})();
