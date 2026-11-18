"use strict";

/* ==========================================================================
 * Elektronik I (ELM2021) — Aydınlık, Adım Adım & Etkileşimli Çalışma Laboratuvarı
 * Marmara Üniversitesi Mekatronik Mühendisliği Müfredatı (Boylestad Böl. 1-4)
 * ========================================================================== */

const fmt = (val, dec = 2) => {
  if (!Number.isFinite(val)) return "∞";
  const rounded = Math.abs(val) < 1e-9 ? 0 : val;
  return Number(rounded.toFixed(dec)).toString();
};

const diodeColor = (isOn) => (isOn ? "#16a34a" : "#dc2626");
const diodeLabel = (isOn) => (isOn ? "ON (İletim)" : "OFF (Kesim)");

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.remove("show"), 2400);
}

/* --------------------------------------------------------------------------
 * SVG DEVRE ŞEMASI YARDIMCI BİLEŞENLERİ (AYDINLIK KAĞIT TEMA)
 * -------------------------------------------------------------------------- */
const SVG_WRAP = (inner, w = 520, h = 250) => `
<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L7,3 z" fill="#16a34a" />
    </marker>
    <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L7,3 z" fill="#2563eb" />
    </marker>
  </defs>
  <style>
    .wire { stroke: #475569; stroke-width: 2.3; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .comp { stroke: #0f172a; stroke-width: 2.3; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .txt { fill: #0f172a; font-family: "JetBrains Mono", monospace; font-size: 12px; font-weight: 700; }
    .sub { fill: #64748b; font-family: "Inter", sans-serif; font-size: 11px; font-weight: 600; }
    .val { fill: #2563eb; font-family: "JetBrains Mono", monospace; font-size: 11.5px; font-weight: 700; }
    .on-txt { fill: #15803d; font-family: "JetBrains Mono", monospace; font-size: 11px; font-weight: 800; }
    .off-txt { fill: #dc2626; font-family: "JetBrains Mono", monospace; font-size: 11px; font-weight: 800; }
    .warn-txt { fill: #d97706; font-family: "JetBrains Mono", monospace; font-size: 11px; font-weight: 800; }
  </style>
  ${inner}
</svg>`;

function svgGround(x, y) {
  return `
    <line class="wire" x1="${x}" y1="${y}" x2="${x}" y2="${y + 10}" />
    <line class="comp" x1="${x - 12}" y1="${y + 10}" x2="${x + 12}" y2="${y + 10}" />
    <line class="comp" x1="${x - 8}" y1="${y + 15}" x2="${x + 8}" y2="${y + 15}" />
    <line class="comp" x1="${x - 4}" y1="${y + 20}" x2="${x + 4}" y2="${y + 20}" />
  `;
}

function svgResistorH(x1, x2, y, label, valText) {
  const cx = (x1 + x2) / 2;
  const start = cx - 22;
  const pts = [
    [x1, y], [start, y],
    [start + 4, y - 7], [start + 11, y + 7], [start + 18, y - 7],
    [start + 25, y + 7], [start + 32, y - 7], [start + 39, y + 7],
    [start + 44, y], [x2, y]
  ].map((p) => p.join(",")).join(" ");
  return `
    <polyline class="comp" points="${pts}" />
    <text class="txt" x="${cx}" y="${y - 14}" text-anchor="middle">${label}</text>
    <text class="val" x="${cx}" y="${y + 20}" text-anchor="middle">${valText}</text>
  `;
}

function svgResistorV(x, y1, y2, label, valText, labelSide = "right") {
  const cy = (y1 + y2) / 2;
  const start = cy - 22;
  const pts = [
    [x, y1], [x, start],
    [x - 7, start + 4], [x + 7, start + 11], [x - 7, start + 18],
    [x + 7, start + 25], [x - 7, start + 32], [x + 7, start + 39],
    [x, start + 44], [x, y2]
  ].map((p) => p.join(",")).join(" ");
  const dx = labelSide === "right" ? 14 : -14;
  const anchor = labelSide === "right" ? "start" : "end";
  return `
    <polyline class="comp" points="${pts}" />
    <text class="txt" x="${x + dx}" y="${cy - 4}" text-anchor="${anchor}">${label}</text>
    <text class="val" x="${x + dx}" y="${cy + 12}" text-anchor="${anchor}">${valText}</text>
  `;
}

function svgSourceV(cx, cy, label, valText, isAC = false, polarPosTop = true) {
  let inner = `<circle cx="${cx}" cy="${cy}" r="18" class="comp" fill="#ffffff" />`;
  if (isAC) {
    inner += `<path d="M ${cx - 9} ${cy} Q ${cx - 4.5} ${cy - 8} ${cx} ${cy} T ${cx + 9} ${cy}" class="comp" stroke="#2563eb" />`;
  } else {
    const topSign = polarPosTop ? "+" : "−";
    const botSign = polarPosTop ? "−" : "+";
    inner += `<text class="txt" x="${cx}" y="${cy - 4}" text-anchor="middle">${topSign}</text>`;
    inner += `<text class="txt" x="${cx}" y="${cy + 11}" text-anchor="middle">${botSign}</text>`;
  }
  inner += `<text class="txt" x="${cx - 25}" y="${cy - 4}" text-anchor="end">${label}</text>`;
  inner += `<text class="val" x="${cx - 25}" y="${cy + 12}" text-anchor="end">${valText}</text>`;
  return inner;
}

function svgDiodeH(cx, cy, dirRight, isOn, label, valText, reveal = true) {
  const showState = reveal && isOn !== null;
  const col = showState ? diodeColor(isOn) : "#0f172a";
  const fillCol = showState ? (isOn ? "rgba(22,163,74,0.16)" : "rgba(220,38,38,0.10)") : "#f8fafc";
  const s = dirRight ? 1 : -1;
  const tri = `${cx - 10 * s},${cy - 10} ${cx - 10 * s},${cy + 10} ${cx + 10 * s},${cy}`;
  const barX = cx + 10 * s;
  const statusCls = showState ? (isOn ? "on-txt" : "off-txt") : "val";
  const statusTxt = showState ? `${valText} • ${isOn ? "ON" : "OFF"}` : (isOn === null ? valText : `${valText} • ?`);
  return `
    <polygon points="${tri}" fill="${fillCol}" stroke="${col}" stroke-width="2.3" />
    <line x1="${barX}" y1="${cy - 11}" x2="${barX}" y2="${cy + 11}" stroke="${col}" stroke-width="2.6" />
    <text class="txt" x="${cx}" y="${cy - 16}" text-anchor="middle">${label}</text>
    <text class="${statusCls}" x="${cx}" y="${cy + 25}" text-anchor="middle">${statusTxt}</text>
  `;
}

function svgDiodeV(cx, cy, dirDown, isOn, label, valText, side = "right", isZener = false, reveal = true) {
  const showState = reveal && isOn !== null;
  const col = showState ? diodeColor(isOn) : "#0f172a";
  const fillCol = showState ? (isOn ? "rgba(22,163,74,0.16)" : "rgba(220,38,38,0.10)") : "#f8fafc";
  const s = dirDown ? 1 : -1;
  const tri = `${cx - 10},${cy - 10 * s} ${cx + 10},${cy - 10 * s} ${cx},${cy + 10 * s}`;
  const barY = cy + 10 * s;
  const dx = side === "right" ? 16 : -16;
  const anchor = side === "right" ? "start" : "end";
  const statusCls = showState ? (isOn ? "on-txt" : "off-txt") : "val";
  const statusTxt = showState ? `${valText} • ${isOn ? "ON" : "OFF"}` : (isOn === null ? valText : `${valText} • ?`);
  let bar = `<line x1="${cx - 11}" y1="${barY}" x2="${cx + 11}" y2="${barY}" stroke="${col}" stroke-width="2.6" />`;
  if (isZener) {
    bar = `<polyline points="${cx - 13},${barY + 4 * s} ${cx - 10},${barY} ${cx + 10},${barY} ${cx + 13},${barY - 4 * s}" fill="none" stroke="${col}" stroke-width="2.4" />`;
  }
  return `
    <polygon points="${tri}" fill="${fillCol}" stroke="${col}" stroke-width="2.3" />
    ${bar}
    <text class="txt" x="${cx + dx}" y="${cy - 3}" text-anchor="${anchor}">${label}</text>
    <text class="${statusCls}" x="${cx + dx}" y="${cy + 13}" text-anchor="${anchor}">${statusTxt}</text>
  `;
}

function svgCapacitorH(cx, cy, label, valText) {
  return `
    <line class="comp" x1="${cx - 4}" y1="${cy - 13}" x2="${cx - 4}" y2="${cy + 13}" />
    <line class="comp" x1="${cx + 4}" y1="${cy - 13}" x2="${cx + 4}" y2="${cy + 13}" />
    <text class="txt" x="${cx}" y="${cy - 18}" text-anchor="middle">${label}</text>
    <text class="val" x="${cx}" y="${cy + 26}" text-anchor="middle">${valText}</text>
  `;
}

function svgBatteryV(cx, cy, posTop, label, valText, side = "right") {
  const dx = side === "right" ? 16 : -16;
  const anchor = side === "right" ? "start" : "end";
  const longY = posTop ? cy - 5 : cy + 5;
  const shortY = posTop ? cy + 5 : cy - 5;
  return `
    <line class="comp" x1="${cx - 12}" y1="${longY}" x2="${cx + 12}" y2="${longY}" />
    <line class="comp" x1="${cx - 6}" y1="${shortY}" x2="${cx + 6}" y2="${shortY}" stroke-width="3.2" />
    <text class="sub" x="${cx - 15}" y="${longY + 3}" text-anchor="end">+</text>
    <text class="txt" x="${cx + dx}" y="${cy - 2}" text-anchor="${anchor}">${label}</text>
    <text class="val" x="${cx + dx}" y="${cy + 13}" text-anchor="${anchor}">${valText}</text>
  `;
}

function svgNodeDot(x, y, label = "") {
  return `
    <circle cx="${x}" cy="${y}" r="4.2" fill="#2563eb" stroke="#ffffff" stroke-width="1.2" />
    ${label ? `<text class="val" x="${x + 8}" y="${y - 6}">${label}</text>` : ""}
  `;
}

function svgBJT(cx, cy, isSat, reveal = true) {
  const col = !reveal ? "#0f172a" : isSat ? "#d97706" : "#16a34a";
  const fill = !reveal ? "#f8fafc" : isSat ? "rgba(217,119,6,0.12)" : "rgba(22,163,74,0.10)";
  return `
    <circle cx="${cx}" cy="${cy}" r="22" stroke="${col}" stroke-width="2.2" fill="${fill}" />
    <line x1="${cx - 8}" y1="${cy - 12}" x2="${cx - 8}" y2="${cy + 12}" stroke="#0f172a" stroke-width="3" />
    <line class="wire" x1="${cx - 22}" y1="${cy}" x2="${cx - 8}" y2="${cy}" />
    <line class="wire" x1="${cx - 8}" y1="${cy - 6}" x2="${cx + 10}" y2="${cy - 18}" />
    <line class="wire" x1="${cx - 8}" y1="${cy + 6}" x2="${cx + 10}" y2="${cy + 18}" />
    <line class="wire" x1="${cx + 10}" y1="${cy - 18}" x2="${cx + 10}" y2="${cy - 24}" />
    <line class="wire" x1="${cx + 10}" y1="${cy + 18}" x2="${cx + 10}" y2="${cy + 24}" />
    <polygon points="${cx + 2},${cy + 15} ${cx + 9},${cy + 17} ${cx + 6},${cy + 10}" fill="${col}" />
    <text class="sub" x="${cx - 24}" y="${cy - 6}" text-anchor="end">B</text>
    <text class="sub" x="${cx + 17}" y="${cy - 14}">C</text>
    <text class="sub" x="${cx + 17}" y="${cy + 21}">E</text>
  `;
}

/* --------------------------------------------------------------------------
 * İNTERAKTİF CANVAS GRAFİK MOTORU (AYDINLIK TEMA + OSİLOSKOP PROBU)
 * -------------------------------------------------------------------------- */
let currentPlotCfg = null;
let lastProbeX = null;

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(400, rect.width || 680);
  const h = 300;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  return { ctx, w, h };
}

function interpolateCurveY(points, xVal) {
  if (!points || points.length === 0) return null;
  if (xVal <= points[0][0]) return points[0][1];
  if (xVal >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if ((xVal >= x0 && xVal <= x1) || (xVal >= x1 && xVal <= x0)) {
      const denom = x1 - x0;
      const t = Math.abs(denom) < 1e-12 ? 0 : (xVal - x0) / denom;
      return y0 + t * (y1 - y0);
    }
  }
  return null;
}

function drawAxesPlot(canvas, cfg, probeDataX = null) {
  currentPlotCfg = cfg;
  const { ctx, w, h } = setupCanvas(canvas);
  const pad = { l: 56, r: 24, t: 28, b: 40 };
  const pw = w - pad.l - pad.r;
  const ph = h - pad.t - pad.b;

  const { xMin, xMax, yMin, yMax, xLabel, yLabel, curves = [], markers = [], hLines = [], vLines = [] } = cfg;
  const mapX = (x) => pad.l + ((x - xMin) / (xMax - xMin || 1)) * pw;
  const mapY = (y) => pad.t + ph - ((y - yMin) / (yMax - yMin || 1)) * ph;

  // Grid (Aydınlık gri)
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  const nx = 6, ny = 6;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillStyle = "#64748b";

  for (let i = 0; i <= nx; i++) {
    const xv = xMin + (i / nx) * (xMax - xMin);
    const px = mapX(xv);
    ctx.beginPath();
    ctx.moveTo(px, pad.t);
    ctx.lineTo(px, pad.t + ph);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillText(fmt(xv, 1), px, h - 18);
  }
  for (let j = 0; j <= ny; j++) {
    const yv = yMin + (j / ny) * (yMax - yMin);
    const py = mapY(yv);
    ctx.beginPath();
    ctx.moveTo(pad.l, py);
    ctx.lineTo(pad.l + pw, py);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(fmt(yv, 1), pad.l - 7, py + 4);
  }

  // Zero axes
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.4;
  if (yMin <= 0 && yMax >= 0) {
    const y0 = mapY(0);
    ctx.beginPath();
    ctx.moveTo(pad.l, y0);
    ctx.lineTo(pad.l + pw, y0);
    ctx.stroke();
  }
  if (xMin <= 0 && xMax >= 0) {
    const x0 = mapX(0);
    ctx.beginPath();
    ctx.moveTo(x0, pad.t);
    ctx.lineTo(x0, pad.t + ph);
    ctx.stroke();
  }

  // Reference lines
  hLines.forEach((hl) => {
    const py = mapY(hl.y);
    if (py < pad.t || py > pad.t + ph) return;
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = hl.color || "#d97706";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(pad.l, py);
    ctx.lineTo(pad.l + pw, py);
    ctx.stroke();
    ctx.fillStyle = hl.color || "#d97706";
    ctx.textAlign = "left";
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText(hl.label, pad.l + 6, py - 5);
    ctx.restore();
  });

  vLines.forEach((vl) => {
    const px = mapX(vl.x);
    if (px < pad.l || px > pad.l + pw) return;
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = vl.color || "#d97706";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px, pad.t);
    ctx.lineTo(px, pad.t + ph);
    ctx.stroke();
    ctx.fillStyle = vl.color || "#d97706";
    ctx.textAlign = "left";
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText(vl.label, px + 5, pad.t + 14);
    ctx.restore();
  });

  // Curves
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.l, pad.t, pw, ph);
  ctx.clip();
  curves.forEach((c) => {
    ctx.save();
    ctx.strokeStyle = c.color;
    ctx.lineWidth = c.width || 2.6;
    if (c.dashed) ctx.setLineDash([6, 4]);
    ctx.beginPath();
    c.points.forEach((pt, idx) => {
      const px = mapX(pt[0]);
      const py = mapY(pt[1]);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();
  });
  ctx.restore();

  // Markers
  markers.forEach((m) => {
    const px = mapX(m.x);
    const py = mapY(m.y);
    ctx.fillStyle = m.color || "#16a34a";
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (m.label) {
      ctx.fillStyle = m.color || "#15803d";
      ctx.font = 'bold 11.5px "JetBrains Mono", monospace';
      const alignRight = px > w - 150;
      ctx.textAlign = alignRight ? "right" : "left";
      ctx.fillText(m.label, alignRight ? px - 9 : px + 9, py - 9);
    }
  });

  // Interactive Hover Probe
  const readoutEl = document.getElementById("probeReadout");
  if (probeDataX !== null && probeDataX >= xMin && probeDataX <= xMax) {
    const px = mapX(probeDataX);
    ctx.save();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px, pad.t);
    ctx.lineTo(px, pad.t + ph);
    ctx.stroke();
    ctx.restore();

    const parts = [`X = ${fmt(probeDataX, 2)}`];
    curves.forEach((c) => {
      const yv = interpolateCurveY(c.points, probeDataX);
      if (yv !== null) {
        const py = mapY(yv);
        ctx.fillStyle = c.color;
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const shortName = (c.name || "Y").split(" ")[0];
        parts.push(`${shortName}: ${fmt(yv, 2)}`);
      }
    });
    if (readoutEl) readoutEl.textContent = parts.join("  |  ");
  } else if (readoutEl) {
    readoutEl.textContent = "Prob: Grafik üzerine gelin";
  }

  // Axis Titles & Legend
  ctx.fillStyle = "#334155";
  ctx.font = 'bold 11.5px "Inter", sans-serif';
  ctx.textAlign = "right";
  ctx.fillText(xLabel, pad.l + pw, h - 4);
  ctx.textAlign = "left";
  ctx.fillText(yLabel, 8, 16);

  let lx = pad.l + 8;
  curves.forEach((c) => {
    if (!c.name) return;
    ctx.fillStyle = c.color;
    ctx.fillRect(lx, 9, 15, 4);
    ctx.fillStyle = "#0f172a";
    ctx.font = '600 11px "Inter", sans-serif';
    ctx.textAlign = "left";
    ctx.fillText(c.name, lx + 20, 15);
    lx += ctx.measureText(c.name).width + 38;
  });
}

/* --------------------------------------------------------------------------
 * MODÜL 1: DC DİYOT & ÇOKLU DİYOT ANALİZİ
 * -------------------------------------------------------------------------- */
const M1_CONFIG = {
  week: "Hafta 1–3",
  topologies: [
    { id: "parallel_diodes", name: "1. Paralel Farklı Diyotlar (Si // Ge // LED)" },
    { id: "series_parallel_mix", name: "2. Çift Kaynaklı Karma Diyot Devresi (Varsayım-Kontrol)" },
    { id: "diode_logic", name: "3. Diyotlu Lojik Kapıları (OR & AND)" }
  ],
  presets: {
    parallel_diodes: [
      { label: "Boylestad Klasik (12V, Si // Ge)", val: { E: 12, R: 0.33, Vk1: 0.7, Vk2: 0.3 } },
      { label: "İki Özdeş Si Diyot (10V, Si // Si)", val: { E: 10, R: 1.0, Vk1: 0.7, Vk2: 0.7 } },
      { label: "Si + Kırmızı LED (9V, Si // LED)", val: { E: 9, R: 0.47, Vk1: 0.7, Vk2: 1.8 } },
      { label: "Kesim Bölgesi Testi (0.2V)", val: { E: 0.2, R: 1.0, Vk1: 0.7, Vk2: 0.3 } }
    ],
    series_parallel_mix: [
      { label: "Vize Klasik (E1=10V, E2=4V)", val: { E1: 10, E2: 4, R1: 1, R2: 1, RL: 2, Vk1: 0.7, Vk2: 0.7 } },
      { label: "İkisi de İletimde (E1=10V, E2=9V)", val: { E1: 10, E2: 9, R1: 1, R2: 1, RL: 2, Vk1: 0.7, Vk2: 0.7 } },
      { label: "Farklı Eşik (Si & Ge)", val: { E1: 5, E2: 5, R1: 1, R2: 1, RL: 1, Vk1: 0.7, Vk2: 0.3 } }
    ],
    diode_logic: [
      { label: "OR Kapısı (V1=5V, V2=0V)", val: { gateType: "OR", Vcc: 5, V1: 5, V2: 0, R: 1, Vk: 0.7 } },
      { label: "AND Kapısı (V1=5V, V2=0V)", val: { gateType: "AND", Vcc: 5, V1: 5, V2: 0, R: 1, Vk: 0.7 } },
      { label: "AND Kapısı (V1=5V, V2=5V)", val: { gateType: "AND", Vcc: 5, V1: 5, V2: 5, R: 1, Vk: 0.7 } }
    ]
  },
  paramsSchema: {
    parallel_diodes: [
      { key: "E", label: "Kaynak Gerilimi E (V)", min: -5, max: 24, step: 0.1, def: 12 },
      { key: "R", label: "Seri Direnç R (kΩ)", min: 0.1, max: 10, step: 0.01, def: 0.33 },
      { key: "Vk1", label: "D1 Eşik Gerilimi Vk1 (V)", min: 0, max: 2.5, step: 0.1, def: 0.7 },
      { key: "Vk2", label: "D2 Eşik Gerilimi Vk2 (V)", min: 0, max: 2.5, step: 0.1, def: 0.3 }
    ],
    series_parallel_mix: [
      { key: "E1", label: "Kaynak E1 (V)", min: -5, max: 20, step: 0.5, def: 10 },
      { key: "E2", label: "Kaynak E2 (V)", min: -5, max: 20, step: 0.5, def: 4 },
      { key: "R1", label: "Direnç R1 (kΩ)", min: 0.2, max: 10, step: 0.1, def: 1 },
      { key: "R2", label: "Direnç R2 (kΩ)", min: 0.2, max: 10, step: 0.1, def: 1 },
      { key: "RL", label: "Yük Direnci RL (kΩ)", min: 0.2, max: 10, step: 0.1, def: 2 },
      { key: "Vk1", label: "D1 Eşik Vk1 (V)", min: 0, max: 2, step: 0.1, def: 0.7 },
      { key: "Vk2", label: "D2 Eşik Vk2 (V)", min: 0, max: 2, step: 0.1, def: 0.7 }
    ],
    diode_logic: [
      { key: "gateType", label: "Kapı Tipi", type: "select", options: [{ v: "OR", t: "Diyot OR (VEYA) Kapısı" }, { v: "AND", t: "Diyot AND (VE) Kapısı" }], def: "OR" },
      { key: "Vcc", label: "Besleme Vcc (V)", min: 3, max: 12, step: 1, def: 5 },
      { key: "V1", label: "Giriş V1 (V)", min: 0, max: 12, step: 0.5, def: 5 },
      { key: "V2", label: "Giriş V2 (V)", min: 0, max: 12, step: 0.5, def: 0 },
      { key: "R", label: "Direnç R (kΩ)", min: 0.2, max: 10, step: 0.1, def: 1 },
      { key: "Vk", label: "Diyot Eşik Vk (V)", min: 0, max: 1, step: 0.1, def: 0.7 }
    ]
  }
};

function solveM1(topo, p, stepIdx = 3) {
  const reveal = stepIdx >= 1;
  const showFlow = stepIdx >= 2;

  if (topo === "parallel_diodes") {
    const { E, R, Vk1, Vk2 } = p;
    const vmin = Math.min(Vk1, Vk2);
    let d1On = false, d2On = false, Vo = E, Ir = 0, Id1 = 0, Id2 = 0;

    if (E <= vmin) {
      Vo = E;
    } else if (Math.abs(Vk1 - Vk2) < 1e-6) {
      d1On = true; d2On = true; Vo = Vk1; Ir = (E - Vo) / R; Id1 = Ir / 2; Id2 = Ir / 2;
    } else if (Vk1 < Vk2) {
      d1On = true; d2On = false; Vo = Vk1; Ir = (E - Vo) / R; Id1 = Ir;
    } else {
      d1On = false; d2On = true; Vo = Vk2; Ir = (E - Vo) / R; Id2 = Ir;
    }

    let correctIdx = 3;
    if (d1On && d2On) correctIdx = 2;
    else if (d1On) correctIdx = 0;
    else if (d2On) correctIdx = 1;

    const quiz = {
      question: `Kaynak E = ${fmt(E)} V iken D1 (${fmt(Vk1)} V) ve D2 (${fmt(Vk2)} V) diyotlarından hangisi iletime geçer?`,
      options: ["Sadece D1 İletimde", "Sadece D2 İletimde", "İkisi de İletimde (ON)", "İkisi de Kesimde (OFF)"],
      correctIdx,
      explanation: d1On && d2On
        ? `Doğru! Eşik gerilimleri eşit (${fmt(Vk1)} V = ${fmt(Vk2)} V) ve E > ${fmt(vmin)} V olduğu için ikisi de aynı anda iletime geçer, akımı paylaşır.`
        : !d1On && !d2On
        ? `Doğru! E = ${fmt(E)} V en küçük eşik olan ${fmt(vmin)} V'u aşamadığı için hiçbir diyot açılmaz.`
        : `Doğru! Paralel kolda eşik gerilimi küçük olan (${d1On ? `D1 = ${fmt(Vk1)} V` : `D2 = ${fmt(Vk2)} V`}) önce iletime geçer ve düğümü kendi geriliminde kilitler; diğer diyot o gerilime çıkamadığı için kesimde kalır!`
    };

    const intro = `<strong>Paralel Diyot Kuralı:</strong> İki diyot paralel bağlıyken kaynak gerilimi 0 V'tan yükselmeye başladığında <strong>önce eşik gerilimi (V<sub>K</sub>) küçük olan diyot iletime geçer</strong> ve ortak düğüm gerilimini kendi eşik değerinde kilitler.`;
    const steps = [
      {
        title: "Eşik Gerilimlerini Karşılaştır ve Kilitleyen Diyodu Seç",
        body: `D1 eşik gerilimi V<sub>K1</sub> = ${fmt(Vk1)} V, D2 eşik gerilimi V<sub>K2</sub> = ${fmt(Vk2)} V. En düşük eşik: <strong>${fmt(vmin)} V</strong>.`,
        formula: E <= vmin
          ? `E = ${fmt(E)} V ≤ ${fmt(vmin)} V olduğundan HİÇBİR diyot açılmaz (D1=OFF, D2=OFF).`
          : Math.abs(Vk1 - Vk2) < 1e-6
          ? `E > ${fmt(vmin)} V ve V<sub>K1</sub> = V<sub>K2</sub> ⇒ Her iki diyot ON (akım yarı yarıya paylaşılır).`
          : Vk1 < Vk2
          ? `V<sub>K1</sub> (${fmt(Vk1)} V) < V<sub>K2</sub> (${fmt(Vk2)} V) ⇒ Önce D1 ON olur ve düğümü ${fmt(Vk1)} V'a kilitler; D2 OFF kalır!`
          : `V<sub>K2</sub> (${fmt(Vk2)} V) < V<sub>K1</sub> (${fmt(Vk1)} V) ⇒ Önce D2 ON olur ve düğümü ${fmt(Vk2)} V'a kilitler; D1 OFF kalır!`,
        tone: "info"
      },
      {
        title: "Çıkış Gerilimi (V<sub>o</sub>) ve KVL ile Toplam Akım (I<sub>R</sub>)",
        body: `İletimdeki diyot düğüm gerilimini belirledikten sonra seri R direnci üzerinden geçen akımı buluruz:`,
        formula: `V_o = ${fmt(Vo)} V\nI_R = (E - V_o) / R = (${fmt(E)} - ${fmt(Vo)}) / ${fmt(R)} kΩ = ${fmt(Ir)} mA\nI_D1 = ${fmt(Id1)} mA  |  I_D2 = ${fmt(Id2)} mA`,
        tone: "success"
      }
    ];

    const flowLines = showFlow && Ir > 0 ? `
      <polyline class="current-flow" points="80,95 80,50 290,50" marker-end="url(#arrowGreen)" />
      ${d1On ? `<line class="current-flow" x1="290" y1="50" x2="290" y2="205" />` : ""}
      ${d2On ? `<polyline class="current-flow" points="290,50 395,50 395,205" />` : ""}
    ` : "";

    const svg = SVG_WRAP(`
      <line class="wire" x1="80" y1="50" x2="80" y2="95" />
      <line class="wire" x1="80" y1="135" x2="80" y2="205" />
      <line class="wire" x1="80" y1="205" x2="430" y2="205" />
      ${flowLines}
      ${svgSourceV(80, 115, "E", `${fmt(E)} V`, false, true)}
      ${svgResistorH(80, 230, 50, "R", `${fmt(R)} kΩ`)}
      <line class="wire" x1="230" y1="50" x2="430" y2="50" />
      ${svgNodeDot(290, 50)}
      ${svgNodeDot(395, 50)}
      ${svgNodeDot(430, 50, reveal ? `Vo = ${fmt(Vo)} V` : "Vo = ?")}
      <line class="wire" x1="290" y1="50" x2="290" y2="112" />
      <line class="wire" x1="290" y1="134" x2="290" y2="205" />
      ${svgDiodeV(290, 123, true, d1On, "D1", `${fmt(Vk1)}V`, "left", false, reveal)}
      <line class="wire" x1="395" y1="50" x2="395" y2="112" />
      <line class="wire" x1="395" y1="134" x2="395" y2="205" />
      ${svgDiodeV(395, 123, true, d2On, "D2", `${fmt(Vk2)}V`, "right", false, reveal)}
      ${svgGround(230, 205)}
      ${showFlow ? `<text class="on-txt" x="155" y="24" text-anchor="middle">I_R = ${fmt(Ir)} mA →</text>` : ""}
      ${showFlow ? `<text class="sub" x="290" y="238" text-anchor="middle">I_D1 = ${fmt(Id1)} mA  |  I_D2 = ${fmt(Id2)} mA</text>` : ""}
    `);

    const sweepPts = [];
    for (let ev = -2; ev <= Math.max(15, E + 3); ev += 0.25) {
      sweepPts.push([ev, ev > vmin ? vmin : ev]);
    }

    const spice = `* Modul 1: Paralel Farkli Diyotlar (ELM2021)
.model D_IDEAL D(IS=1e-15 N=0.001)
V1 in 0 DC ${fmt(E)}
R1 in vo ${fmt(R)}k
D1 vo d1_k D_IDEAL
V_k1 d1_k 0 DC ${fmt(Vk1)}
D2 vo d2_k D_IDEAL
V_k2 d2_k 0 DC ${fmt(Vk2)}
.op
.dc V1 0 ${fmt(Math.max(15, E + 3))} 0.1
.print dc v(vo) i(V_k1) i(V_k2)
.end`;

    return {
      statusText: reveal ? `D1: ${d1On ? "ON" : "OFF"} | D2: ${d2On ? "ON" : "OFF"}` : "Adım 1: Tahmin Et",
      statusTone: !reveal ? "badge-info" : (d1On || d2On ? "badge-on" : "badge-off"),
      quiz,
      checkTarget: { label: "Çıkış Gerilimi Vo (V)", unit: "V", expected: Vo },
      kpis: [
        { label: "Çıkış Vo", val: `${fmt(Vo)} V` },
        { label: "Toplam I_R", val: `${fmt(Ir)} mA` },
        { label: "I_D1", val: `${fmt(Id1)} mA`, cls: d1On ? "green" : "red" },
        { label: "I_D2", val: `${fmt(Id2)} mA`, cls: d2On ? "green" : "red" }
      ],
      intro,
      steps,
      svg,
      plots: [{
        id: "sweep",
        title: "DC Tarama: Vo vs Kaynak E",
        cfg: {
          xMin: -2, xMax: Math.max(15, E + 3),
          yMin: -2, yMax: Math.max(5, vmin + 3),
          xLabel: "Kaynak E (V)", yLabel: "Çıkış Vo (V)",
          curves: [{ name: "Vo(E) Eğrisi", color: "#2563eb", points: sweepPts }],
          hLines: [{ y: vmin, color: "#16a34a", label: `Kenetlenme = ${fmt(vmin)} V` }],
          markers: [{ x: E, y: Vo, color: "#d97706", label: `Çalışma (${fmt(E)}V, ${fmt(Vo)}V)` }]
        }
      }],
      spice
    };
  }

  if (topo === "series_parallel_mix") {
    const { E1, E2, R1, R2, RL, Vk1, Vk2 } = p;
    const tried = [];
    let sol = null;

    {
      const gSum = 1 / R1 + 1 / R2 + 1 / RL;
      const vo = ((E1 - Vk1) / R1 + (E2 - Vk2) / R2) / gSum;
      const id1 = (E1 - Vk1 - vo) / R1;
      const id2 = (E2 - Vk2 - vo) / R2;
      const ok = id1 >= -1e-6 && id2 >= -1e-6;
      tried.push(`D1=ON, D2=ON → Vo=${fmt(vo)}V, I_D1=${fmt(id1)}mA, I_D2=${fmt(id2)}mA → ${ok ? "GEÇERLİ ✓" : "ÇELİŞKİ (Akım negatif!) ✗"}`);
      if (ok) sol = { d1On: true, d2On: true, vo, id1, id2, irl: vo / RL };
    }
    if (!sol) {
      const vo = (E1 - Vk1) * (RL / (R1 + RL));
      const id1 = (E1 - Vk1 - vo) / R1;
      const vd2 = E2 - vo;
      const ok = id1 >= -1e-6 && vd2 <= Vk2 + 1e-6;
      tried.push(`D1=ON, D2=OFF → Vo=${fmt(vo)}V, I_D1=${fmt(id1)}mA, V_D2=${fmt(vd2)}V → ${ok ? "GEÇERLİ ✓" : "ÇELİŞKİ ✗"}`);
      if (ok) sol = { d1On: true, d2On: false, vo, id1, id2: 0, irl: vo / RL };
    }
    if (!sol) {
      const vo = (E2 - Vk2) * (RL / (R2 + RL));
      const id2 = (E2 - Vk2 - vo) / R2;
      const vd1 = E1 - vo;
      const ok = id2 >= -1e-6 && vd1 <= Vk1 + 1e-6;
      tried.push(`D1=OFF, D2=ON → Vo=${fmt(vo)}V, I_D2=${fmt(id2)}mA, V_D1=${fmt(vd1)}V → ${ok ? "GEÇERLİ ✓" : "ÇELİŞKİ ✗"}`);
      if (ok) sol = { d1On: false, d2On: true, vo, id1: 0, id2, irl: vo / RL };
    }
    if (!sol) {
      tried.push(`D1=OFF, D2=OFF → Vo=0V → GEÇERLİ ✓`);
      sol = { d1On: false, d2On: false, vo: 0, id1: 0, id2: 0, irl: 0 };
    }

    let cIdx = 3;
    if (sol.d1On && sol.d2On) cIdx = 0;
    else if (sol.d1On) cIdx = 1;
    else if (sol.d2On) cIdx = 2;

    const quiz = {
      question: `E1 = ${fmt(E1)} V ve E2 = ${fmt(E2)} V değerleri için geçerli diyot kombinasyonu hangisidir?`,
      options: ["D1=ON, D2=ON", "D1=ON, D2=OFF", "D1=OFF, D2=ON", "D1=OFF, D2=OFF"],
      correctIdx: cIdx,
      explanation: `Geçerli durum: D1=${diodeLabel(sol.d1On)}, D2=${diodeLabel(sol.d2On)}. Varsayımda negatif diyot akımı çıkarsa o diyodu OFF yapıp tekrar çözeriz.`
    };

    const intro = `<strong>Varsayım ve Kontrol (Assume &amp; Check) Metodu:</strong> Diyotları başlangıçta iletimde varsayıp çözeriz. İletimdeki diyotta akım I<sub>D</sub> ≥ 0, kesimdekinde V<sub>D</sub> &lt; V<sub>K</sub> çıkmalıdır. Çelişki varsa varsayımı güncelleriz.`;
    const steps = [
      {
        title: "Kombinasyon Testleri (Varsayım-Çelişki Yöntemi)",
        body: `Sırayla test edilen durumlar:`,
        formula: tried.join("\n"),
        tone: "info"
      },
      {
        title: "Geçerli Devrenin KCL ve Çıkış Çözümü",
        body: `Geçerli durum: <strong>D1 ${diodeLabel(sol.d1On)}</strong>, <strong>D2 ${diodeLabel(sol.d2On)}</strong>.`,
        formula: `V_o = ${fmt(sol.vo)} V   |   I_RL = ${fmt(sol.irl)} mA\nI_D1 = ${fmt(sol.id1)} mA   |   I_D2 = ${fmt(sol.id2)} mA`,
        tone: "success"
      }
    ];

    const svg = SVG_WRAP(`
      <line class="wire" x1="55" y1="60" x2="55" y2="120" />
      <line class="wire" x1="55" y1="160" x2="55" y2="215" />
      ${svgSourceV(55, 140, "E1", `${fmt(E1)}V`, false, true)}
      ${svgResistorH(55, 165, 60, "R1", `${fmt(R1)}k`)}
      <line class="wire" x1="165" y1="60" x2="215" y2="60" />
      <line class="wire" x1="237" y1="60" x2="310" y2="60" />
      ${svgDiodeH(226, 60, true, sol.d1On, "D1", `${fmt(Vk1)}V`, reveal)}
      <line class="wire" x1="55" y1="215" x2="380" y2="215" />
      <line class="wire" x1="120" y1="145" x2="120" y2="215" />
      ${svgSourceV(120, 125, "E2", `${fmt(E2)}V`, false, true)}
      <line class="wire" x1="120" y1="105" x2="120" y2="105" />
      ${svgResistorH(120, 210, 105, "R2", `${fmt(R2)}k`)}
      <line class="wire" x1="210" y1="105" x2="235" y2="105" />
      <line class="wire" x1="257" y1="105" x2="310" y2="105" />
      ${svgDiodeH(246, 105, true, sol.d2On, "D2", `${fmt(Vk2)}V`, reveal)}
      <line class="wire" x1="310" y1="60" x2="310" y2="105" />
      <line class="wire" x1="310" y1="82" x2="380" y2="82" />
      ${svgNodeDot(310, 82)}
      ${svgNodeDot(380, 82, reveal ? `Vo=${fmt(sol.vo)}V` : "Vo=?")}
      <line class="wire" x1="380" y1="82" x2="380" y2="120" />
      ${svgResistorV(380, 120, 195, "RL", `${fmt(RL)}k`, "right")}
      <line class="wire" x1="380" y1="195" x2="380" y2="215" />
      ${svgGround(230, 215)}
    `);

    const sweepPts = [];
    for (let e1s = -2; e1s <= 16; e1s += 0.4) {
      let v = 0;
      const gSum = 1 / R1 + 1 / R2 + 1 / RL;
      const vo1 = ((e1s - Vk1) / R1 + (E2 - Vk2) / R2) / gSum;
      if ((e1s - Vk1 - vo1) / R1 >= 0 && (E2 - Vk2 - vo1) / R2 >= 0) v = vo1;
      else {
        const vo2 = (e1s - Vk1) * (RL / (R1 + RL));
        if (vo2 >= 0 && E2 - vo2 <= Vk2) v = vo2;
        else {
          const vo3 = (E2 - Vk2) * (RL / (R2 + RL));
          if (vo3 >= 0 && e1s - vo3 <= Vk1) v = vo3;
        }
      }
      sweepPts.push([e1s, v]);
    }

    const spice = `* Modul 1: Cift Kaynakli Karma Diyot Devresi
.model D_IDEAL D(IS=1e-15 N=0.001)
V1 n1 0 DC ${fmt(E1)}
R1 n1 a1 ${fmt(R1)}k
D1 a1 d1k D_IDEAL
Vk1 d1k vo DC ${fmt(Vk1)}
V2 n2 0 DC ${fmt(E2)}
R2 n2 a2 ${fmt(R2)}k
D2 a2 d2k D_IDEAL
Vk2 d2k vo DC ${fmt(Vk2)}
RL vo 0 ${fmt(RL)}k
.op
.print op v(vo)
.end`;

    return {
      statusText: reveal ? `D1: ${sol.d1On ? "ON" : "OFF"} | D2: ${sol.d2On ? "ON" : "OFF"}` : "Adım 1: Tahmin Et",
      statusTone: reveal ? "badge-on" : "badge-info",
      quiz,
      checkTarget: { label: "Çıkış Gerilimi Vo (V)", unit: "V", expected: sol.vo },
      kpis: [
        { label: "Çıkış Vo", val: `${fmt(sol.vo)} V` },
        { label: "Yük Akımı I_RL", val: `${fmt(sol.irl)} mA` },
        { label: "I_D1", val: `${fmt(sol.id1)} mA`, cls: sol.d1On ? "green" : "red" },
        { label: "I_D2", val: `${fmt(sol.id2)} mA`, cls: sol.d2On ? "green" : "red" }
      ],
      intro, steps, svg,
      plots: [{
        id: "sweep_mix", title: "E1 Değişirken Çıkış Vo Grafiği",
        cfg: {
          xMin: -2, xMax: 16, yMin: 0, yMax: 16,
          xLabel: "E1 (V)", yLabel: "Vo (V)",
          curves: [{ name: "Vo(E1)", color: "#2563eb", points: sweepPts }],
          markers: [{ x: E1, y: sol.vo, color: "#16a34a", label: `(${fmt(E1)}V, ${fmt(sol.vo)}V)` }]
        }
      }],
      spice
    };
  }

  // diode_logic
  const { gateType, Vcc, V1, V2, R, Vk } = p;
  let Vo = 0, d1On = false, d2On = false, Ir = 0, Id1 = 0, Id2 = 0;

  if (gateType === "OR") {
    const vmax = Math.max(V1, V2);
    if (vmax > Vk) {
      Vo = vmax - Vk; Ir = Vo / R;
      if (Math.abs(V1 - V2) < 1e-6) { d1On = true; d2On = true; Id1 = Ir / 2; Id2 = Ir / 2; }
      else if (V1 > V2) { d1On = true; Id1 = Ir; }
      else { d2On = true; Id2 = Ir; }
    }
  } else {
    const vmin = Math.min(V1, V2);
    if (Vcc > vmin + Vk) {
      Vo = vmin + Vk; Ir = (Vcc - Vo) / R;
      if (Math.abs(V1 - V2) < 1e-6) { d1On = true; d2On = true; Id1 = Ir / 2; Id2 = Ir / 2; }
      else if (V1 < V2) { d1On = true; Id1 = Ir; }
      else { d2On = true; Id2 = Ir; }
    } else {
      Vo = Vcc;
    }
  }

  const isHigh = Vo >= Vcc * 0.5;
  const logicOut = isHigh ? "LOJİK 1 (HIGH)" : "LOJİK 0 (LOW)";
  const quiz = {
    question: `${gateType} kapısında V1 = ${fmt(V1)} V, V2 = ${fmt(V2)} V iken çıkış lojik seviyesi ne olur?`,
    options: ["Lojik 1 (HIGH)", "Lojik 0 (LOW)"],
    correctIdx: isHigh ? 0 : 1,
    explanation: gateType === "OR"
      ? `OR kapısında yüksek giriş (${fmt(Math.max(V1, V2))} V) çıkışı belirler: Vo = ${fmt(Vo)} V (${logicOut}).`
      : `AND kapısında düşük giriş (${fmt(Math.min(V1, V2))} V) diyodunu açarak çıkışı aşağı çeker: Vo = ${fmt(Vo)} V (${logicOut}).`
  };

  const intro = gateType === "OR"
    ? `<strong>Diyot OR Kapısı:</strong> Girişlerden yüksek olanı diyodunu iletime sokarak çıkışı V<sub>max</sub> - V<sub>K</sub> seviyesine çeker.`
    : `<strong>Diyot AND Kapısı:</strong> Girişlerden düşük olanı diyodunu iletime sokarak çıkışı V<sub>min</sub> + V<sub>K</sub> (Lojik 0) seviyesine indirir. Tüm girişler yüksekse çıkış V<sub>CC</sub> (Lojik 1) olur.`;

  const steps = [
    {
      title: gateType === "OR" ? "Maksimum Girişi Belirle" : "Minimum Girişi Belirle",
      body: `Giriş değerleri: V1 = ${fmt(V1)} V, V2 = ${fmt(V2)} V.`,
      formula: `V_o = ${fmt(Vo)} V  ⇒  ${logicOut}`,
      tone: "info"
    },
    {
      title: "Diyot Durumları ve Akım",
      body: `R = ${fmt(R)} kΩ direnci üzerindeki toplam akım:`,
      formula: `I_R = ${fmt(Ir)} mA | I_D1 = ${fmt(Id1)} mA (${diodeLabel(d1On)}) | I_D2 = ${fmt(Id2)} mA (${diodeLabel(d2On)})`,
      tone: "success"
    }
  ];

  const svg = gateType === "OR"
    ? SVG_WRAP(`
        <text class="val" x="45" y="74" text-anchor="end">V1=${fmt(V1)}V</text>
        <line class="wire" x1="55" y1="70" x2="140" y2="70" />
        ${svgDiodeH(150, 70, true, d1On, "D1", `${fmt(Vk)}V`, reveal)}
        <line class="wire" x1="162" y1="70" x2="260" y2="70" />
        <text class="val" x="45" y="134" text-anchor="end">V2=${fmt(V2)}V</text>
        <line class="wire" x1="55" y1="130" x2="140" y2="130" />
        ${svgDiodeH(150, 130, true, d2On, "D2", `${fmt(Vk)}V`, reveal)}
        <line class="wire" x1="162" y1="130" x2="260" y2="130" />
        <line class="wire" x1="260" y1="70" x2="260" y2="130" />
        <line class="wire" x1="260" y1="100" x2="360" y2="100" />
        ${svgNodeDot(260, 100)}
        ${svgNodeDot(360, 100, reveal ? `Vo = ${fmt(Vo)}V` : "Vo = ?")}
        <line class="wire" x1="360" y1="100" x2="360" y2="130" />
        ${svgResistorV(360, 130, 200, "R", `${fmt(R)}k`, "right")}
        ${svgGround(360, 200)}
      `)
    : SVG_WRAP(`
        <text class="val" x="250" y="25" text-anchor="middle">+Vcc = ${fmt(Vcc)} V</text>
        <line class="wire" x1="250" y1="33" x2="250" y2="55" />
        ${svgResistorV(250, 55, 115, "R", `${fmt(R)}k`, "right")}
        <line class="wire" x1="250" y1="115" x2="250" y2="135" />
        ${svgNodeDot(250, 135, reveal ? `Vo = ${fmt(Vo)}V` : "Vo = ?")}
        <line class="wire" x1="250" y1="135" x2="170" y2="135" />
        <line class="wire" x1="170" y1="135" x2="170" y2="165" />
        <line class="wire" x1="170" y1="187" x2="170" y2="215" />
        ${svgDiodeV(170, 176, true, d1On, "D1", `${fmt(Vk)}V`, "left", false, reveal)}
        <text class="val" x="170" y="232" text-anchor="middle">V1=${fmt(V1)}V</text>
        <line class="wire" x1="250" y1="135" x2="330" y2="135" />
        <line class="wire" x1="330" y1="135" x2="330" y2="165" />
        <line class="wire" x1="330" y1="187" x2="330" y2="215" />
        ${svgDiodeV(330, 176, true, d2On, "D2", `${fmt(Vk)}V`, "right", false, reveal)}
        <text class="val" x="330" y="232" text-anchor="middle">V2=${fmt(V2)}V</text>
      `);

  const spice = `* Modul 1: Diyot ${gateType} Lojik Kapisi
.model D_IDEAL D(IS=1e-15 N=0.001)
V1 in1 0 DC ${fmt(V1)}
V2 in2 0 DC ${fmt(V2)}
${gateType === "AND" ? `Vcc vcc 0 DC ${fmt(Vcc)}\nR1 vcc vo ${fmt(R)}k\nD1 vo d1k D_IDEAL\nVk1 d1k in1 DC ${fmt(Vk)}\nD2 vo d2k D_IDEAL\nVk2 d2k in2 DC ${fmt(Vk)}` : `D1 in1 d1k D_IDEAL\nVk1 d1k vo DC ${fmt(Vk)}\nD2 in2 d2k D_IDEAL\nVk2 d2k vo DC ${fmt(Vk)}\nR1 vo 0 ${fmt(R)}k`}
.op
.print op v(vo)
.end`;

  return {
    statusText: reveal ? logicOut : "Adım 1: Tahmin Et",
    statusTone: !reveal ? "badge-info" : (isHigh ? "badge-on" : "badge-warn"),
    quiz,
    checkTarget: { label: "Çıkış Gerilimi Vo (V)", unit: "V", expected: Vo },
    kpis: [
      { label: "Çıkış Vo", val: `${fmt(Vo)} V` },
      { label: "Lojik Seviye", val: isHigh ? "1 (HIGH)" : "0 (LOW)", cls: isHigh ? "green" : "amber" },
      { label: "D1 Durumu", val: d1On ? "ON" : "OFF", cls: d1On ? "green" : "red" },
      { label: "D2 Durumu", val: d2On ? "ON" : "OFF", cls: d2On ? "green" : "red" }
    ],
    intro, steps, svg,
    plots: [{
      id: "logic_sweep", title: "V1 (0 → Vcc) Değişirken Vo Tepkisi",
      cfg: {
        xMin: 0, xMax: Vcc, yMin: 0, yMax: Vcc + 1,
        xLabel: "V1 (V)", yLabel: "Vo (V)",
        curves: [{
          name: `Vo (V2=${fmt(V2)}V sabit)`, color: "#2563eb",
          points: Array.from({ length: 41 }, (_, i) => {
            const v1 = (i / 40) * Vcc;
            const vo = gateType === "OR" ? Math.max(0, Math.max(v1, V2) - Vk) : Math.min(Vcc, Math.min(v1, V2) + Vk);
            return [v1, vo];
          })
        }],
        markers: [{ x: V1, y: Vo, color: "#16a34a", label: `Çalışma (${fmt(V1)}V, ${fmt(Vo)}V)` }]
      }
    }],
    spice
  };
}

/* --------------------------------------------------------------------------
 * MODÜL 2: KIRPICI (CLIPPER), KENETLEYİCİ (CLAMPER) & DOĞRULTUCU
 * -------------------------------------------------------------------------- */
const M2_CONFIG = {
  week: "Hafta 4–5",
  topologies: [
    { id: "series_clipper", name: "1. Seri Kırpıcı (Series Clipper + DC Bias)" },
    { id: "parallel_clipper", name: "2. Paralel Kırpıcı (Parallel Clipper + DC Bias)" },
    { id: "clamper", name: "3. Kenetleyici Devre (Clamper + DC Bias)" },
    { id: "rectifier", name: "4. Doğrultucular (Yarım, Orta Uçlu & Köprü)" }
  ],
  presets: {
    series_clipper: [
      { label: "Pozitif Seri Kırpıcı (DC=0V)", val: { wave: "sine", Vm: 10, Vdc: 0, dir: "forward", Vk: 0.7 } },
      { label: "Boylestad Örnek (Vm=20V, Vdc=+5V)", val: { wave: "sine", Vm: 20, Vdc: 5, dir: "forward", Vk: 0 } },
      { label: "Ters Diyotlu + Bias (Vm=10V, Vdc=-4V)", val: { wave: "sine", Vm: 10, Vdc: -4, dir: "reverse", Vk: 0.7 } }
    ],
    parallel_clipper: [
      { label: "Üstten Kırpıcı (Vm=12V, Vdc=+4V)", val: { wave: "sine", Vm: 12, Vdc: 4, dir: "down", Vk: 0.7 } },
      { label: "Alttan Kırpıcı (Vm=12V, Vdc=-3V)", val: { wave: "sine", Vm: 12, Vdc: -3, dir: "up", Vk: 0.7 } },
      { label: "İdeal 0V Kırpıcı (Vm=10V, Vdc=0V)", val: { wave: "sine", Vm: 10, Vdc: 0, dir: "down", Vk: 0 } }
    ],
    clamper: [
      { label: "Boylestad Kare Dalga (Vm=20V, Vdc=+5V)", val: { wave: "square", Vm: 20, Vdc: 5, dir: "up", Vk: 0.7 } },
      { label: "Negatif Kenetleyici Sinüs (Vm=10V, Vdc=0V)", val: { wave: "sine", Vm: 10, Vdc: 0, dir: "down", Vk: 0.7 } },
      { label: "Pozitif Kenetleyici + Pil (Vm=12V, Vdc=-3V)", val: { wave: "sine", Vm: 12, Vdc: -3, dir: "up", Vk: 0.7 } }
    ],
    rectifier: [
      { label: "Köprü Tam Dalga (Vm=15V, Si)", val: { rtype: "bridge", Vm: 15, Vk: 0.7 } },
      { label: "Orta Uçlu Tam Dalga (Vm=15V, Si)", val: { rtype: "center_tap", Vm: 15, Vk: 0.7 } },
      { label: "Yarım Dalga (Vm=20V, İdeal)", val: { rtype: "half", Vm: 20, Vk: 0 } }
    ]
  },
  paramsSchema: {
    series_clipper: [
      { key: "wave", label: "Giriş Sinyali", type: "select", options: [{ v: "sine", t: "Sinüs Dalgası" }, { v: "square", t: "Kare Dalga" }, { v: "tri", t: "Üçgen Dalga" }], def: "sine" },
      { key: "dir", label: "Diyot Yönü", type: "select", options: [{ v: "forward", t: "İleri (Anot Girişte →)" }, { v: "reverse", t: "Ters (Katot Girişte ←)" }], def: "forward" },
      { key: "Vm", label: "Giriş Genliği Vm (V)", min: 2, max: 30, step: 1, def: 10 },
      { key: "Vdc", label: "Seri DC Kaynak V_DC (V)", min: -15, max: 15, step: 0.5, def: 4 },
      { key: "Vk", label: "Diyot Eşik Gerilimi Vk (V)", min: 0, max: 1, step: 0.1, def: 0.7 }
    ],
    parallel_clipper: [
      { key: "wave", label: "Giriş Sinyali", type: "select", options: [{ v: "sine", t: "Sinüs Dalgası" }, { v: "square", t: "Kare Dalga" }, { v: "tri", t: "Üçgen Dalga" }], def: "sine" },
      { key: "dir", label: "Diyot Yönü", type: "select", options: [{ v: "down", t: "Aşağı (Anot Üstte ↓)" }, { v: "up", t: "Yukarı (Katot Üstte ↑)" }], def: "down" },
      { key: "Vm", label: "Giriş Genliği Vm (V)", min: 2, max: 30, step: 1, def: 12 },
      { key: "Vdc", label: "Paralel Kol DC Kaynağı V_DC (V)", min: -15, max: 15, step: 0.5, def: 4 },
      { key: "Vk", label: "Diyot Eşik Gerilimi Vk (V)", min: 0, max: 1, step: 0.1, def: 0.7 }
    ],
    clamper: [
      { key: "wave", label: "Giriş Sinyali", type: "select", options: [{ v: "square", t: "Kare Dalga (Sınav Klasiği)" }, { v: "sine", t: "Sinüs Dalgası" }], def: "square" },
      { key: "dir", label: "Diyot Yönü", type: "select", options: [{ v: "up", t: "Yukarı (Katot Çıkışta ↑)" }, { v: "down", t: "Aşağı (Anot Çıkışta ↓)" }], def: "up" },
      { key: "Vm", label: "Giriş Genliği Vm (V)", min: 2, max: 30, step: 1, def: 20 },
      { key: "Vdc", label: "Paralel Kol DC Kaynağı V_DC (V)", min: -15, max: 15, step: 0.5, def: 5 },
      { key: "Vk", label: "Diyot Eşik Gerilimi Vk (V)", min: 0, max: 1, step: 0.1, def: 0.7 }
    ],
    rectifier: [
      { key: "rtype", label: "Doğrultucu Tipi", type: "select", options: [{ v: "bridge", t: "Köprü Tam Dalga (Bridge)" }, { v: "center_tap", t: "Orta Uçlu Tam Dalga" }, { v: "half", t: "Yarım Dalga Doğrultucu" }], def: "bridge" },
      { key: "Vm", label: "Sekonder Tepe Gerilimi Vm (V)", min: 3, max: 40, step: 1, def: 15 },
      { key: "Vk", label: "Diyot Eşik Gerilimi Vk (V)", min: 0, max: 1, step: 0.1, def: 0.7 }
    ]
  }
};

function genInputWave(wave, Vm, tNorm) {
  if (wave === "sine") return Vm * Math.sin(2 * Math.PI * tNorm);
  if (wave === "square") return (tNorm % 1) < 0.5 ? Vm : -Vm;
  const ph = tNorm % 1;
  if (ph < 0.25) return 4 * Vm * ph;
  if (ph < 0.75) return 2 * Vm - 4 * Vm * ph;
  return -4 * Vm + 4 * Vm * ph;
}

function solveM2(topo, p, stepIdx = 3) {
  const reveal = stepIdx >= 1;
  const N = 240;
  const ts = Array.from({ length: N + 1 }, (_, i) => (i / N) * 2);

  if (topo === "series_clipper") {
    const { wave, Vm, Vdc, dir, Vk } = p;
    const vTrans = dir === "forward" ? Vk - Vdc : -Vk - Vdc;
    const evalVo = (vi) => dir === "forward" ? (vi > vTrans ? vi - Vk + Vdc : 0) : (vi < vTrans ? vi + Vk + Vdc : 0);
    const viPts = ts.map((t) => [t, genInputWave(wave, Vm, t)]);
    const voPts = viPts.map(([t, vi]) => [t, evalVo(vi)]);
    const voMax = Math.max(...voPts.map((x) => x[1]));
    const voMin = Math.min(...voPts.map((x) => x[1]));
    const transPts = Array.from({ length: 101 }, (_, i) => {
      const vi = -Vm + (i / 100) * (2 * Vm);
      return [vi, evalVo(vi)];
    });

    const quiz = {
      question: `Bu seri kırpıcıda diyot hangi durumda KESİMDE (OFF) kalır ve çıkış v_o = 0 V olur?`,
      options: [`v_i ≤ ${fmt(vTrans)} V iken`, `v_i ≥ ${fmt(vTrans)} V iken`],
      correctIdx: dir === "forward" ? 0 : 1,
      explanation: dir === "forward"
        ? `Doğru! Diyot ileri yönde bağlı olduğu için v_i ≤ ${fmt(vTrans)} V olduğunda iletime geçemez (OFF) ve R direncinden akım akmadığı için çıkış 0 V olur.`
        : `Doğru! Diyot ters yönde bağlı olduğu için yalnızca v_i < ${fmt(vTrans)} V iken iletime geçer; v_i ≥ ${fmt(vTrans)} V iken kesimde (0 V) kalır.`
    };

    const intro = `<strong>Seri Kırpıcı Metodu:</strong> Çıkış direnci toprağa bağlıdır; diyot <strong>OFF</strong> olduğunda dirençten akım geçmez ve v<sub>o</sub> = 0 V olur. Bu yüzden önce diyodun tam iletime geçtiği <strong>geçiş gerilimini (V<sub>geçiş</sub>)</strong> buluruz.`;
    const steps = [
      {
        title: "Geçiş (Transition) Gerilimini Bul (I_D = 0, V_D = V_K)",
        body: dir === "forward"
          ? `İletim sınırında v<sub>i</sub> - V<sub>K</sub> + V<sub>DC</sub> = 0 denklemi kurulur:`
          : `Ters diyotta iletim sınırında v<sub>i</sub> + V<sub>K</sub> + V<sub>DC</sub> = 0 denklemi kurulur:`,
        formula: `V_geçiş = ${fmt(vTrans)} V`,
        tone: "info"
      },
      {
        title: "İletim/Kesim Bölgeleri ve Çıkış Tepe Değerleri",
        body: `Geçiş sınırının iki tarafındaki çıkış denklemleri ve tepeler:`,
        formula: dir === "forward"
          ? `v_i > ${fmt(vTrans)} V ⇒ ON ⇒ v_o = v_i + ${fmt(Vdc - Vk)} V\nv_i ≤ ${fmt(vTrans)} V ⇒ OFF ⇒ v_o = 0 V\nV_o(max) = ${fmt(voMax)} V  |  V_o(min) = ${fmt(voMin)} V`
          : `v_i < ${fmt(vTrans)} V ⇒ ON ⇒ v_o = v_i + ${fmt(Vdc + Vk)} V\nv_i ≥ ${fmt(vTrans)} V ⇒ OFF ⇒ v_o = 0 V\nV_o(max) = ${fmt(voMax)} V  |  V_o(min) = ${fmt(voMin)} V`,
        tone: "success"
      }
    ];

    const svg = SVG_WRAP(`
      <line class="wire" x1="70" y1="65" x2="70" y2="95" />
      <line class="wire" x1="70" y1="135" x2="70" y2="195" />
      <line class="wire" x1="70" y1="195" x2="430" y2="195" />
      ${svgSourceV(70, 115, "vi", `±${fmt(Vm)}V`, true)}
      <line class="wire" x1="70" y1="65" x2="155" y2="65" />
      ${svgDiodeH(166, 65, dir === "forward", null, "D", `${fmt(Vk)}V`, reveal)}
      <line class="wire" x1="178" y1="65" x2="265" y2="65" />
      <rect x="253" y="47" width="44" height="36" rx="6" fill="#eff6ff" stroke="#2563eb" stroke-width="1.6" />
      <text class="val" x="275" y="69" text-anchor="middle">${Vdc >= 0 ? "+" : ""}${fmt(Vdc)}V</text>
      <text class="sub" x="275" y="38" text-anchor="middle">Seri Bias</text>
      <line class="wire" x1="297" y1="65" x2="395" y2="65" />
      ${svgNodeDot(395, 65, "vo")}
      <line class="wire" x1="395" y1="65" x2="395" y2="95" />
      ${svgResistorV(395, 95, 175, "R", "10kΩ", "right")}
      <line class="wire" x1="395" y1="175" x2="395" y2="195" />
      ${svgGround(230, 195)}
    `);

    const spice = `* Modul 2: Seri Kirpici (Series Clipper)
.model D_IDEAL D(IS=1e-15 N=0.001)
Vin in 0 SIN(0 ${fmt(Vm)} 1k)
${dir === "forward" ? `D1 in d_k D_IDEAL\nVk d_k d_b DC ${fmt(Vk)}` : `D1 d_k in D_IDEAL\nVk in_b d_k DC ${fmt(Vk)}`}
Vdc ${dir === "forward" ? "vo d_b" : "vo in_b"} DC ${fmt(Vdc)}
Rload vo 0 10k
.tran 10u 2m
.dc Vin ${fmt(-Vm)} ${fmt(Vm)} 0.1
.end`;

    return {
      statusText: reveal ? `Geçiş: Vi = ${fmt(vTrans)} V` : "Adım 1: Tahmin Et",
      statusTone: "badge-info",
      quiz,
      checkTarget: { label: dir === "forward" ? "Vo(max) (V)" : "Vo(min) (V)", unit: "V", expected: dir === "forward" ? voMax : voMin },
      kpis: [
        { label: "Geçiş Gerilimi", val: `${fmt(vTrans)} V` },
        { label: "Vo(max)", val: `${fmt(voMax)} V`, cls: "green" },
        { label: "Vo(min)", val: `${fmt(voMin)} V`, cls: "amber" },
        { label: "Giriş ±Vm", val: `±${fmt(Vm)} V` }
      ],
      intro, steps, svg,
      plots: [
        {
          id: "time", title: "Zaman Domeni: vi(t) ve vo(t)",
          cfg: {
            xMin: 0, xMax: 2, yMin: Math.min(-Vm, voMin) - 2, yMax: Math.max(Vm, voMax) + 2,
            xLabel: "Periyot (t / T)", yLabel: "Gerilim (V)",
            curves: [
              { name: "vi(t) Giriş", color: "#94a3b8", dashed: true, width: 2, points: viPts },
              { name: "vo(t) Çıkış", color: "#2563eb", width: 2.8, points: voPts }
            ],
            hLines: [{ y: vTrans, color: "#d97706", label: `Geçiş Vi=${fmt(vTrans)}V` }]
          }
        },
        {
          id: "transfer", title: "Transfer Eğrisi: vo vs vi",
          cfg: {
            xMin: -Vm, xMax: Vm, yMin: Math.min(-Vm, voMin) - 2, yMax: Math.max(Vm, voMax) + 2,
            xLabel: "vi (V)", yLabel: "vo (V)",
            curves: [{ name: "vo(vi)", color: "#16a34a", width: 2.8, points: transPts }],
            vLines: [{ x: vTrans, color: "#d97706", label: `Vgeçiş=${fmt(vTrans)}V` }]
          }
        }
      ],
      spice
    };
  }

  if (topo === "parallel_clipper") {
    const { wave, Vm, Vdc, dir, Vk } = p;
    const vClip = dir === "down" ? Vdc + Vk : Vdc - Vk;
    const evalVo = (vi) => dir === "down" ? (vi > vClip ? vClip : vi) : (vi < vClip ? vClip : vi);
    const viPts = ts.map((t) => [t, genInputWave(wave, Vm, t)]);
    const voPts = viPts.map(([t, vi]) => [t, evalVo(vi)]);
    const voMax = Math.max(...voPts.map((x) => x[1]));
    const voMin = Math.min(...voPts.map((x) => x[1]));
    const transPts = Array.from({ length: 101 }, (_, i) => {
      const vi = -Vm + (i / 100) * (2 * Vm);
      return [vi, evalVo(vi)];
    });

    const quiz = {
      question: `Bu paralel kırpıcı devrede sinyal nereden kırpılır (sabitlenir)?`,
      options: [`Üstten (+${fmt(vClip)} V'un üstü kırpılır)`, `Alttan (${fmt(vClip)} V'un altı kırpılır)`],
      correctIdx: dir === "down" ? 0 : 1,
      explanation: dir === "down"
        ? `Doğru! Diyot aşağı baktığı için v_i > ${fmt(vClip)} V olduğunda iletime geçer ve çıkışı ${fmt(vClip)} V'a sabitler (üstten kırpar).`
        : `Doğru! Diyot yukarı baktığı için v_i < ${fmt(vClip)} V olduğunda iletime geçer ve çıkışı ${fmt(vClip)} V'a sabitler (alttan kırpar).`
    };

    const intro = `<strong>Paralel Kırpıcı Metodu:</strong> Diyot <strong>ON</strong> olduğunda çıkış gerilimini kendi kolunun sabit gerilimine (V<sub>kırpma</sub>) kilitler. Diyot <strong>OFF</strong> olduğunda seri R direncinden akım akmaz ve v<sub>o</sub> = v<sub>i</sub> aynen çıkışa geçer.`;
    const steps = [
      {
        title: "Kırpma Seviyesini Hesapla",
        body: dir === "down" ? `Diyot aşağı yönlü: V<sub>kırpma</sub> = V<sub>DC</sub> + V<sub>K</sub>` : `Diyot yukarı yönlü: V<sub>kırpma</sub> = V<sub>DC</sub> - V<sub>K</sub>`,
        formula: `V_kırpma = ${fmt(vClip)} V`,
        tone: "info"
      },
      {
        title: "Bölge Analizi ve Çıkış Sınırları",
        body: `v<sub>i</sub> ile V<sub>kırpma</sub> karşılaştırması:`,
        formula: dir === "down"
          ? `v_i > ${fmt(vClip)} V ⇒ ON ⇒ v_o = ${fmt(vClip)} V\nv_i ≤ ${fmt(vClip)} V ⇒ OFF ⇒ v_o = v_i\nV_o(max) = ${fmt(voMax)} V  |  V_o(min) = ${fmt(voMin)} V`
          : `v_i < ${fmt(vClip)} V ⇒ ON ⇒ v_o = ${fmt(vClip)} V\nv_i ≥ ${fmt(vClip)} V ⇒ OFF ⇒ v_o = v_i\nV_o(max) = ${fmt(voMax)} V  |  V_o(min) = ${fmt(voMin)} V`,
        tone: "success"
      }
    ];

    const svg = SVG_WRAP(`
      <line class="wire" x1="70" y1="55" x2="70" y2="95" />
      <line class="wire" x1="70" y1="135" x2="70" y2="205" />
      <line class="wire" x1="70" y1="205" x2="430" y2="205" />
      ${svgSourceV(70, 115, "vi", `±${fmt(Vm)}V`, true)}
      ${svgResistorH(70, 230, 55, "R", "1kΩ")}
      <line class="wire" x1="230" y1="55" x2="410" y2="55" />
      ${svgNodeDot(300, 55)}
      ${svgNodeDot(410, 55, "vo")}
      <line class="wire" x1="300" y1="55" x2="300" y2="95" />
      ${svgDiodeV(300, 106, dir === "down", null, "D", `${fmt(Vk)}V`, "right", false, reveal)}
      <line class="wire" x1="300" y1="117" x2="300" y2="148" />
      ${svgBatteryV(300, 162, Vdc >= 0, "Vdc", `${fmt(Math.abs(Vdc))}V`, "right")}
      <line class="wire" x1="300" y1="176" x2="300" y2="205" />
      ${svgGround(230, 205)}
    `);

    const spice = `* Modul 2: Paralel Kirpici (Parallel Clipper)
.model D_IDEAL D(IS=1e-15 N=0.001)
Vin in 0 SIN(0 ${fmt(Vm)} 1k)
R1 in vo 1k
${dir === "down" ? `D1 vo dk D_IDEAL\nVk dk vdc_n DC ${fmt(Vk)}` : `D1 dk vo D_IDEAL\nVk vdc_n dk DC ${fmt(Vk)}`}
Vdc vdc_n 0 DC ${fmt(Vdc)}
.tran 10u 2m
.dc Vin ${fmt(-Vm)} ${fmt(Vm)} 0.1
.end`;

    return {
      statusText: reveal ? `Kırpma: ${fmt(vClip)} V` : "Adım 1: Tahmin Et",
      statusTone: "badge-info",
      quiz,
      checkTarget: { label: "Kırpma Seviyesi V_kırpma (V)", unit: "V", expected: vClip },
      kpis: [
        { label: "Kırpma Seviyesi", val: `${fmt(vClip)} V`, cls: "amber" },
        { label: "Vo(max)", val: `${fmt(voMax)} V`, cls: "green" },
        { label: "Vo(min)", val: `${fmt(voMin)} V`, cls: "amber" },
        { label: "Giriş ±Vm", val: `±${fmt(Vm)} V` }
      ],
      intro, steps, svg,
      plots: [
        {
          id: "time", title: "Zaman Domeni: vi(t) ve vo(t)",
          cfg: {
            xMin: 0, xMax: 2, yMin: Math.min(-Vm, voMin) - 2, yMax: Math.max(Vm, voMax) + 2,
            xLabel: "Periyot (t / T)", yLabel: "Gerilim (V)",
            curves: [
              { name: "vi(t) Giriş", color: "#94a3b8", dashed: true, width: 2, points: viPts },
              { name: "vo(t) Çıkış", color: "#2563eb", width: 2.8, points: voPts }
            ],
            hLines: [{ y: vClip, color: "#d97706", label: `Kırpma = ${fmt(vClip)} V` }]
          }
        },
        {
          id: "transfer", title: "Transfer Eğrisi: vo vs vi",
          cfg: {
            xMin: -Vm, xMax: Vm, yMin: Math.min(-Vm, voMin) - 2, yMax: Math.max(Vm, voMax) + 2,
            xLabel: "vi (V)", yLabel: "vo (V)",
            curves: [{ name: "vo(vi)", color: "#16a34a", width: 2.8, points: transPts }],
            hLines: [{ y: vClip, color: "#d97706", label: `V_kırpma=${fmt(vClip)}V` }]
          }
        }
      ],
      spice
    };
  }

  if (topo === "clamper") {
    const { wave, Vm, Vdc, dir, Vk } = p;
    let Vc = 0, clamped = true;
    const vClamp = dir === "down" ? Vdc + Vk : Vdc - Vk;
    if (dir === "down") {
      if (Vm > vClamp) Vc = Vm - vClamp; else clamped = false;
    } else {
      if (-Vm < vClamp) Vc = -Vm - vClamp; else clamped = false;
    }
    const viPts = ts.map((t) => [t, genInputWave(wave, Vm, t)]);
    const voPts = viPts.map(([t, vi]) => [t, vi - Vc]);
    const voMax = Math.max(...voPts.map((x) => x[1]));
    const voMin = Math.min(...voPts.map((x) => x[1]));

    const quiz = {
      question: `Kenetleyici (Clamper) sorusunu çözerken ANALİZE HANGİ ALTERNANSTAN başlanmalıdır?`,
      options: ["Pozitif Alternanstan (+Vm)", "Negatif Alternanstan (-Vm)"],
      correctIdx: dir === "down" ? 0 : 1,
      explanation: dir === "down"
        ? `Doğru! Diyot aşağı yönlü olduğu için pozitif alternansta (+Vm) iletime geçip kondansatörü şarj eder; bu yüzden analize daima pozitif alternanstan başlanır.`
        : `Doğru! Diyot yukarı yönlü (katot üstte) olduğu için negatif alternansta (-Vm) iletime geçip kondansatörü şarj eder; bu yüzden analize negatif alternanstan başlanır.`
    };

    const intro = `<strong>Kenetleyici (Clamper) Altın Kuralı:</strong><br>1) Analize her zaman <strong>diyodu İLETİME (ON) sokan alternanstan</strong> başla ve kondansatör gerilimini (V<sub>C</sub>) bul.<br>2) Diğer alternansta diyot kesime gider; V<sub>C</sub> sabit kalır ve v<sub>o</sub> = v<sub>i</sub> - V<sub>C</sub> hesaplanır.<br>3) Sağlama: Tepeden tepeye genlik korunur (ΔV<sub>o</sub> = 2V<sub>m</sub>).`;

    const steps = [
      {
        title: "1. İletime Sokan Alternans ve Kondansatör V_C",
        body: dir === "down"
          ? `Diyot aşağı yönlü ⇒ <strong>Pozitif alternansta (+${fmt(Vm)} V)</strong> ON olur ve çıkışı v<sub>o</sub> = ${fmt(vClamp)} V'a kelepçeler.`
          : `Diyot yukarı yönlü ⇒ <strong>Negatif alternansta (-${fmt(Vm)} V)</strong> ON olur ve çıkışı v<sub>o</sub> = ${fmt(vClamp)} V'a kelepçeler.`,
        formula: clamped
          ? `V_C = v_i - v_o = ${fmt(dir === "down" ? Vm : -Vm)} - (${fmt(vClamp)}) = ${fmt(Vc)} V`
          : `UYARI: Giriş genliği (${fmt(Vm)} V) diyodu açmaya yetmiyor! V_C = 0 V kalır.`,
        tone: clamped ? "info" : "warn"
      },
      {
        title: "2. Diğer Alternans, Çıkış Sınırları & Genlik Sağlaması",
        body: `Diyot kesimdeyken kondansatör sabit pil gibi davranır:`,
        formula: `v_o(t) = v_i(t) ${Vc <= 0 ? `+ ${fmt(Math.abs(Vc))}` : `- ${fmt(Vc)}`} V\nV_o(max) = ${fmt(voMax)} V   |   V_o(min) = ${fmt(voMin)} V\nSağlama: ΔV_çıkış = ${fmt(voMax - voMin)} V == 2·Vm = ${fmt(2 * Vm)} V ✓`,
        tone: "success"
      }
    ];

    const svg = SVG_WRAP(`
      <line class="wire" x1="70" y1="55" x2="70" y2="95" />
      <line class="wire" x1="70" y1="135" x2="70" y2="205" />
      <line class="wire" x1="70" y1="205" x2="440" y2="205" />
      ${svgSourceV(70, 115, "vi", `±${fmt(Vm)}V`, true)}
      <line class="wire" x1="70" y1="55" x2="155" y2="55" />
      ${svgCapacitorH(165, 55, "C", reveal ? `|Vc|=${fmt(Math.abs(Vc))}V` : "Vc=?")}
      <line class="wire" x1="175" y1="55" x2="410" y2="55" />
      ${svgNodeDot(280, 55)}
      ${svgNodeDot(390, 55, "vo")}
      <line class="wire" x1="280" y1="55" x2="280" y2="95" />
      ${svgDiodeV(280, 106, dir === "down", null, "D", `${fmt(Vk)}V`, "right", false, reveal)}
      <line class="wire" x1="280" y1="117" x2="280" y2="148" />
      ${svgBatteryV(280, 162, Vdc >= 0, "Vdc", `${fmt(Math.abs(Vdc))}V`, "right")}
      <line class="wire" x1="280" y1="176" x2="280" y2="205" />
      <line class="wire" x1="390" y1="55" x2="390" y2="95" />
      ${svgResistorV(390, 95, 175, "R", "100kΩ", "right")}
      <line class="wire" x1="390" y1="175" x2="390" y2="205" />
      ${svgGround(210, 205)}
    `);

    const spice = `* Modul 2: Kenetleyici (Clamper)
.model D_IDEAL D(IS=1e-15 N=0.001)
Vin in 0 ${wave === "square" ? `PULSE(${fmt(-Vm)} ${fmt(Vm)} 0 1u 1u 0.5m 1m)` : `SIN(0 ${fmt(Vm)} 1k)`}
C1 in vo 10u
${dir === "down" ? `D1 vo dk D_IDEAL\nVk dk vdc_n DC ${fmt(Vk)}` : `D1 dk vo D_IDEAL\nVk vdc_n dk DC ${fmt(Vk)}`}
Vdc vdc_n 0 DC ${fmt(Vdc)}
Rload vo 0 100k
.tran 10u 5m 3m
.end`;

    return {
      statusText: reveal ? `Vc = ${fmt(Vc)} V` : "Adım 1: Tahmin Et",
      statusTone: "badge-on",
      quiz,
      checkTarget: { label: "Maksimum Çıkış Vo(max) (V)", unit: "V", expected: voMax },
      kpis: [
        { label: "Kondansatör Vc", val: `${fmt(Vc)} V` },
        { label: "Vo(max)", val: `${fmt(voMax)} V`, cls: "green" },
        { label: "Vo(min)", val: `${fmt(voMin)} V`, cls: "amber" },
        { label: "ΔVo Genlik", val: `${fmt(voMax - voMin)} V` }
      ],
      intro, steps, svg,
      plots: [{
        id: "time", title: "Kenetlenmiş Çıkış vo(t) vs Giriş vi(t)",
        cfg: {
          xMin: 0, xMax: 2, yMin: Math.min(-Vm, voMin) - 3, yMax: Math.max(Vm, voMax) + 3,
          xLabel: "Periyot (t / T)", yLabel: "Gerilim (V)",
          curves: [
            { name: "vi(t) Giriş", color: "#94a3b8", dashed: true, width: 2, points: viPts },
            { name: "vo(t) Çıkış", color: "#16a34a", width: 2.8, points: voPts }
          ],
          hLines: [{ y: vClamp, color: "#2563eb", label: `Kelepçe = ${fmt(vClamp)} V` }]
        }
      }],
      spice
    };
  }

  // rectifier
  const { rtype, Vm, Vk } = p;
  const dropCount = rtype === "bridge" ? 2 : 1;
  const voPeak = Math.max(0, Vm - dropCount * Vk);
  const vdc = rtype === "half" ? voPeak / Math.PI : (2 * voPeak) / Math.PI;
  const piv = rtype === "center_tap" ? 2 * Vm - Vk : rtype === "bridge" ? Vm - Vk : Vm;

  const evalRec = (vi) => rtype === "half" ? (vi > Vk ? vi - Vk : 0) : (Math.abs(vi) > dropCount * Vk ? Math.abs(vi) - dropCount * Vk : 0);
  const viPts = ts.map((t) => [t, Vm * Math.sin(2 * Math.PI * t)]);
  const voPts = viPts.map(([t, vi]) => [t, evalRec(vi)]);

  const quiz = {
    question: `${rtype === "bridge" ? "Köprü Tam Dalga" : rtype === "center_tap" ? "Orta Uçlu Tam Dalga" : "Yarım Dalga"} doğrultucuda her alternansta akım yolunda kaç diyot seri iletime geçer?`,
    options: ["1 diyot (1·Vk düşümü)", "2 diyot (2·Vk düşümü)"],
    correctIdx: rtype === "bridge" ? 1 : 0,
    explanation: rtype === "bridge"
      ? `Doğru! Köprü doğrultucuda her alternansta çapraz 2 diyot seri olarak iletime geçer (2×${fmt(Vk)} V düşüm).`
      : `Doğru! Bu topolojide her iletimde yalnızca 1 diyot akım yolundadır.`
  };

  const intro = `<strong>Doğrultucu Sınav Özeti:</strong> Her alternansta iletimdeki diyot sayısı kadar eşik gerilimi düşülür. Ayrıca sınavlarda kesimdeki diyodun dayandığı <strong>PIV (Tepe Ters Gerilim)</strong> sorulur.`;
  const steps = [
    {
      title: "Çıkış Tepe Gerilimi (Vo,peak) ve Ortalama Vdc",
      body: `Her yarım periyotta ${dropCount} diyot düşümü vardır:`,
      formula: `V_o(peak) = V_m - ${dropCount}·V_K = ${fmt(voPeak)} V\nV_dc = ${rtype === "half" ? "V_o(peak)/π" : "2·V_o(peak)/π"} = ${fmt(vdc)} V`,
      tone: "info"
    },
    {
      title: "Tepe Ters Gerilim (PIV) Hesabı",
      body: rtype === "center_tap" ? `Orta uçlu trafoda kesimdeki diyot iki sargı toplamına (2·Vm - Vk) dayanır:` : `Kesimdeki diyodun maruz kaldığı tepe ters gerilim:`,
      formula: `PIV = ${fmt(piv)} V`,
      tone: "success"
    }
  ];

  const svg = SVG_WRAP(`
    <line class="wire" x1="70" y1="65" x2="70" y2="95" />
    <line class="wire" x1="70" y1="135" x2="70" y2="195" />
    <line class="wire" x1="70" y1="195" x2="430" y2="195" />
    ${svgSourceV(70, 115, "vi", `${fmt(Vm)}V sin`, true)}
    <rect x="155" y="45" width="150" height="80" rx="10" fill="#eff6ff" stroke="#2563eb" stroke-width="2" />
    <text class="txt" x="230" y="78" text-anchor="middle">${rtype === "bridge" ? "KÖPRÜ (4 Diyot)" : rtype === "center_tap" ? "ORTA UÇLU (2 Diyot)" : "YARIM DALGA (1 Diyot)"}</text>
    <text class="val" x="230" y="102" text-anchor="middle">Düşüm: ${dropCount}×${fmt(Vk)}V</text>
    <line class="wire" x1="70" y1="65" x2="155" y2="65" />
    <line class="wire" x1="305" y1="65" x2="400" y2="65" />
    ${svgNodeDot(400, 65, reveal ? `Vo(pk)=${fmt(voPeak)}V` : "Vo=?")}
    <line class="wire" x1="400" y1="65" x2="400" y2="95" />
    ${svgResistorV(400, 95, 175, "RL", "1kΩ", "right")}
    <line class="wire" x1="400" y1="175" x2="400" y2="195" />
    ${svgGround(230, 195)}
  `);

  const spice = `* Modul 2: Dogrultucu
.model D_IDEAL D(IS=1e-15 N=0.001)
Vin in 0 SIN(0 ${fmt(Vm)} 50)
Eabs vo 0 VALUE = {${rtype === "half" ? `max(0, v(in)-${fmt(Vk)})` : `max(0, abs(v(in))-${fmt(dropCount * Vk)})`}}
RL vo 0 1k
.tran 0.1m 40m
.end`;

  return {
    statusText: reveal ? `Vdc = ${fmt(vdc)} V | PIV = ${fmt(piv)} V` : "Adım 1: Tahmin Et",
    statusTone: "badge-on",
    quiz,
    checkTarget: { label: "Ortalama DC Gerilim Vdc (V)", unit: "V", expected: vdc },
    kpis: [
      { label: "Vo(peak)", val: `${fmt(voPeak)} V`, cls: "green" },
      { label: "Ortalama Vdc", val: `${fmt(vdc)} V` },
      { label: "PIV (Ters Ger.)", val: `${fmt(piv)} V`, cls: "amber" },
      { label: "Diyot Düşümü", val: `${fmt(dropCount * Vk)} V` }
    ],
    intro, steps, svg,
    plots: [{
      id: "time", title: "Doğrultulmuş Çıkış vo(t) ve Ortalama Vdc",
      cfg: {
        xMin: 0, xMax: 2, yMin: -Vm - 2, yMax: Vm + 2,
        xLabel: "Periyot (t / T)", yLabel: "Gerilim (V)",
        curves: [
          { name: "vi(t) Giriş", color: "#94a3b8", dashed: true, width: 2, points: viPts },
          { name: "vo(t) Çıkış", color: "#16a34a", width: 2.8, points: voPts }
        ],
        hLines: [{ y: vdc, color: "#2563eb", label: `Vdc = ${fmt(vdc)} V` }]
      }
    }],
    spice
  };
}

/* --------------------------------------------------------------------------
 * MODÜL 3: ZENER REGÜLATÖR & SINIR ANALİZİ
 * -------------------------------------------------------------------------- */
const M3_CONFIG = {
  week: "Hafta 5",
  topologies: [{ id: "zener_reg", name: "1. Zener Regülatör (Sabit Vi & Değişken Yük RL)" }],
  presets: {
    zener_reg: [
      { label: "Boylestad Örnek 2.26 (RL=1.2kΩ → OFF)", val: { Vi: 16, Rs: 1000, Vz: 10, Pzm: 300, RL: 1200 } },
      { label: "Boylestad Örnek 2.26b (RL=3kΩ → ON)", val: { Vi: 16, Rs: 1000, Vz: 10, Pzm: 300, RL: 3000 } },
      { label: "Aşırı Güç / Yanma Testi (Vi=30V, Rs=200Ω)", val: { Vi: 30, Rs: 200, Vz: 10, Pzm: 300, RL: 2000 } }
    ]
  },
  paramsSchema: {
    zener_reg: [
      { key: "Vi", label: "Giriş Gerilimi Vi (V)", min: 5, max: 40, step: 0.5, def: 16 },
      { key: "Rs", label: "Seri Direnç Rs (Ω)", min: 50, max: 3000, step: 10, def: 1000 },
      { key: "Vz", label: "Zener Gerilimi Vz (V)", min: 3, max: 20, step: 0.1, def: 10 },
      { key: "Pzm", label: "Maks. Zener Gücü Pzm (mW)", min: 50, max: 2000, step: 10, def: 300 },
      { key: "RL", label: "Yük Direnci RL (Ω)", min: 100, max: 5000, step: 50, def: 1200 }
    ]
  }
};

function solveM3(_topo, p, stepIdx = 3) {
  const reveal = stepIdx >= 1;
  const showFlow = stepIdx >= 2;
  const { Vi, Rs, Vz, Pzm, RL } = p;
  const Izm = Pzm / Vz;
  const Vth = Vi * (RL / (Rs + RL));
  const isOn = Vth >= Vz;

  let VL = Vth, VR = Vi - Vth, IL = 0, IR = 0, IZ = 0, Pz = 0;
  if (isOn) {
    VL = Vz; VR = Vi - Vz;
    IR = (VR / Rs) * 1000; IL = (VL / RL) * 1000;
    IZ = IR - IL; Pz = Vz * IZ;
  } else {
    IR = (Vi / (Rs + RL)) * 1000; IL = IR;
  }

  const overload = isOn && Pz > Pzm;
  const RLmin = Vi > Vz ? (Rs * Vz) / (Vi - Vz) : Infinity;
  const ILmax = Vi > Vz ? ((Vi - Vz) / Rs) * 1000 : 0;
  const IR_at_reg = Vi > Vz ? ((Vi - Vz) / Rs) * 1000 : 0;
  const ILmin = IR_at_reg > Izm ? IR_at_reg - Izm : 0;
  const RLmax = ILmin > 0 ? (Vz / ILmin) * 1000 : Infinity;
  const Vimin = Vz * ((Rs + RL) / RL);
  const Vimax = Vz + (Rs * (Izm + (Vz / RL) * 1000)) / 1000;

  const quiz = {
    question: `Zener'i devreden söküp gerilim bölücü uygularsak: V_th = ${fmt(Vi)}·(${fmt(RL, 0)}/${fmt(Rs + RL, 0)}) = ${fmt(Vth)} V çıkıyor. Zener'in durumu nedir?`,
    options: ["Zener ON (Regülasyon Aktif, VL = Vz)", "Zener OFF (Açık Devre, Regülasyon Yok!)"],
    correctIdx: isOn ? 0 : 1,
    explanation: isOn
      ? `Doğru! V_th (${fmt(Vth)} V) ≥ V_Z (${fmt(Vz)} V) olduğu için Zener iletimdedir ve yükü ${fmt(Vz)} V'a sabitler.`
      : `Doğru! V_th (${fmt(Vth)} V) < V_Z (${fmt(Vz)} V) olduğu için Zener kırılma gerilimine ulaşamaz ve OFF (açık devre) kalır!`
  };

  const intro = `<strong>Zener Regülatör 3 Adımlı Sınav Metodu:</strong><br>1) Zener'i sök ve boşta kalan uçlardaki <strong>V<sub>th</sub></strong> gerilimini hesapla.<br>2) <strong>V<sub>th</sub> &lt; V<sub>Z</sub></strong> ise Zener OFF (açık devre), <strong>V<sub>th</sub> ≥ V<sub>Z</sub></strong> ise Zener ON (V<sub>L</sub> = V<sub>Z</sub>).<br>3) Akımları (I<sub>Z</sub> = I<sub>R</sub> - I<sub>L</sub>) ve P<sub>Z</sub> ≤ P<sub>ZM</sub> güvenliğini kontrol et.`;

  const steps = [
    {
      title: "Zener'i Sökerek Thévenin Gerilimi (V_th) Testi",
      body: `Zener devreden çıkarılırsa yük üzerindeki açık devre gerilimi:`,
      formula: `V_th = V_i · [R_L / (R_S + R_L)] = ${fmt(Vth)} V\nKarşılaştırma: ${fmt(Vth)} V ${isOn ? "≥" : "<"} V_Z (${fmt(Vz)} V)  ⇒  ZENER ${isOn ? "ON" : "OFF"}`,
      tone: isOn ? "success" : "warn"
    },
    {
      title: "Akımlar, Güç ve Regülasyon Sınırları (RL(min), Vi Aralığı)",
      body: isOn ? `Zener ON: V<sub>L</sub> = V<sub>Z</sub> alınarak KCL yazılır.` : `Zener OFF: Seri direnç devresi gibi çözülür.`,
      formula: `${isOn
        ? `V_L = ${fmt(VL)} V | I_R = ${fmt(IR)} mA | I_L = ${fmt(IL)} mA | I_Z = ${fmt(IZ)} mA\nP_Z = ${fmt(Pz, 1)} mW (Sınır P_ZM = ${fmt(Pzm, 0)} mW)`
        : `V_L = ${fmt(VL)} V | I_R = I_L = ${fmt(IR)} mA | I_Z = 0 mA`}
--- Sınav Sınır Formülleri ---
R_L(min) = (R_S · V_Z) / (V_i - V_Z) = ${Number.isFinite(RLmin) ? `${fmt(RLmin, 1)} Ω (I_L(max)=${fmt(ILmax)} mA)` : "Yok"}
R_L(max) = ${Number.isFinite(RLmax) ? `${fmt(RLmax, 1)} Ω` : "∞ (Açık devre güvenli)"}
V_i Aralığı (sabit R_L için): [${fmt(Vimin)} V , ${fmt(Vimax)} V]`,
      tone: overload ? "danger" : "info"
    }
  ];

  const flowLines = showFlow ? `
    <polyline class="current-flow" points="70,95 70,55 395,55 395,95" />
    ${isOn ? `<line class="current-flow" x1="290" y1="55" x2="290" y2="205" />` : ""}
  ` : "";

  const svg = SVG_WRAP(`
    <line class="wire" x1="70" y1="55" x2="70" y2="95" />
    <line class="wire" x1="70" y1="135" x2="70" y2="205" />
    <line class="wire" x1="70" y1="205" x2="430" y2="205" />
    ${flowLines}
    ${svgSourceV(70, 115, "Vi", `${fmt(Vi)} V`, false, true)}
    ${svgResistorH(70, 230, 55, "Rs", `${fmt(Rs, 0)} Ω`)}
    <line class="wire" x1="230" y1="55" x2="395" y2="55" />
    ${svgNodeDot(290, 55)}
    ${svgNodeDot(395, 55, reveal ? `VL=${fmt(VL)}V` : "VL=?")}
    <line class="wire" x1="290" y1="55" x2="290" y2="112" />
    <line class="wire" x1="290" y1="134" x2="290" y2="205" />
    ${svgDiodeV(290, 123, false, isOn, "Zener", `${fmt(Vz)}V`, "left", true, reveal)}
    <line class="wire" x1="395" y1="55" x2="395" y2="95" />
    ${svgResistorV(395, 95, 175, "RL", `${fmt(RL, 0)} Ω`, "right")}
    <line class="wire" x1="395" y1="175" x2="395" y2="205" />
    ${svgGround(230, 205)}
    ${showFlow ? `<text class="on-txt" x="150" y="24" text-anchor="middle">I_R = ${fmt(IR)} mA →</text>` : ""}
    ${showFlow ? `<text class="${overload ? "off-txt" : "sub"}" x="290" y="236" text-anchor="middle">I_Z = ${fmt(IZ)} mA  |  P_Z = ${fmt(Pz, 1)} mW</text>` : ""}
  `);

  const maxPlotR = Math.max(5000, RL * 1.4, Number.isFinite(RLmin) ? RLmin * 2.5 : 5000);
  const pts = Array.from({ length: 101 }, (_, i) => {
    const r = 50 + (i / 100) * (maxPlotR - 50);
    const vth = Vi * (r / (Rs + r));
    return [r, vth >= Vz ? Vz : vth];
  });

  const spice = `* Modul 3: Zener Regulator (ELM2021)
.model DZ_MOD D(BV=${fmt(Vz)} IBV=1m Rs=0.001)
Vi in 0 DC ${fmt(Vi)}
Rs in vl ${fmt(Rs, 0)}
Dz 0 vl DZ_MOD
RL vl 0 ${fmt(RL, 0)}
.op
.dc RL 100 ${fmt(maxPlotR, 0)} 50
.end`;

  return {
    statusText: !reveal ? "Adım 1: Tahmin Et" : overload ? "AŞIRI GÜÇ (YANMA RİSKİ!)" : isOn ? "ZENER ON (Regülasyon Aktif)" : "ZENER OFF (Kesimde)",
    statusTone: !reveal ? "badge-info" : overload ? "badge-off" : isOn ? "badge-on" : "badge-warn",
    quiz,
    checkTarget: { label: "Yük Gerilimi VL (V)", unit: "V", expected: VL },
    kpis: [
      { label: "Yük Gerilimi VL", val: `${fmt(VL)} V`, cls: isOn ? "green" : "amber" },
      { label: "Zener Akımı I_Z", val: `${fmt(IZ)} mA` },
      { label: "Harcanan P_Z", val: `${fmt(Pz, 1)} mW`, cls: overload ? "red" : "green" },
      { label: "RL(min) Sınırı", val: Number.isFinite(RLmin) ? `${fmt(RLmin, 0)} Ω` : "Yok" }
    ],
    intro, steps, svg,
    plots: [{
      id: "zener_rl", title: "Yük Direnci (RL) Değişirken VL Regülasyon Eğrisi",
      cfg: {
        xMin: 0, xMax: maxPlotR, yMin: 0, yMax: Math.max(Vi, Vz) + 2,
        xLabel: "Yük Direnci RL (Ω)", yLabel: "Yük Gerilimi VL (V)",
        curves: [{ name: "VL(RL)", color: "#2563eb", width: 2.6, points: pts }],
        hLines: [{ y: Vz, color: "#16a34a", label: `Vz = ${fmt(Vz)} V` }],
        vLines: Number.isFinite(RLmin) && RLmin < maxPlotR ? [{ x: RLmin, color: "#d97706", label: `RL(min)=${fmt(RLmin, 0)}Ω` }] : [],
        markers: [{ x: RL, y: VL, color: isOn ? "#16a34a" : "#dc2626", label: `(${fmt(RL, 0)}Ω, ${fmt(VL)}V)` }]
      }
    }],
    spice
  };
}

/* --------------------------------------------------------------------------
 * MODÜL 4: BJT DC ÖNGERİMLENDİRME, Q-NOKTASI & YÜK DOĞRUSU
 * -------------------------------------------------------------------------- */
const M4_CONFIG = {
  week: "Hafta 6–7",
  topologies: [
    { id: "fixed", name: "1. Sabit Öngerilim (Fixed-Bias)" },
    { id: "emitter", name: "2. Emiter Dirençli Öngerilim (Emitter-Stabilized)" },
    { id: "divider", name: "3. Gerilim Bölücülü (Voltage-Divider — Yaklaşık vs Thévenin)" },
    { id: "feedback", name: "4. Kollektör Geri Beslemeli (Collector-Feedback)" }
  ],
  presets: {
    fixed: [
      { label: "Boylestad Örnek 4.1 (Vcc=12V, β=50)", val: { Vcc: 12, Rb: 240, Rc: 2.2, beta: 50, Vbe: 0.7 } },
      { label: "Doyum Testi (Rb=47kΩ, Rc=4.7kΩ)", val: { Vcc: 12, Rb: 47, Rc: 4.7, beta: 100, Vbe: 0.7 } }
    ],
    emitter: [
      { label: "Boylestad Örnek 4.4 (Vcc=20V, β=50)", val: { Vcc: 20, Rb: 430, Rc: 2, Re: 1, beta: 50, Vbe: 0.7 } },
      { label: "Doyum Testi (Rb=68kΩ)", val: { Vcc: 12, Rb: 68, Rc: 2.2, Re: 1, beta: 120, Vbe: 0.7 } }
    ],
    divider: [
      { label: "Boylestad Örnek 4.8 (Yaklaşık Şartı Sağlar ✓)", val: { Vcc: 22, R1: 39, R2: 3.9, Rc: 10, Re: 1.5, beta: 100, Vbe: 0.7 } },
      { label: "Boylestad Örnek 4.10 (Şart Sağlanmaz → Thévenin!)", val: { Vcc: 18, R1: 82, R2: 22, Rc: 5.6, Re: 1.2, beta: 50, Vbe: 0.7 } },
      { label: "Doyum Senaryosu", val: { Vcc: 12, R1: 10, R2: 10, Rc: 4.7, Re: 0.47, beta: 100, Vbe: 0.7 } }
    ],
    feedback: [
      { label: "Boylestad Örnek 4.11 (Vcc=10V, Rf=250kΩ)", val: { Vcc: 10, Rf: 250, Rc: 4.7, Re: 1.2, beta: 90, Vbe: 0.7 } },
      { label: "Re = 0 Ω Sade Geri Besleme", val: { Vcc: 12, Rf: 180, Rc: 2.2, Re: 0, beta: 100, Vbe: 0.7 } }
    ]
  },
  paramsSchema: {
    fixed: [
      { key: "Vcc", label: "Besleme Vcc (V)", min: 5, max: 30, step: 0.5, def: 12 },
      { key: "Rb", label: "Baz Direnci RB (kΩ)", min: 10, max: 1000, step: 5, def: 240 },
      { key: "Rc", label: "Kollektör Direnci RC (kΩ)", min: 0.2, max: 15, step: 0.1, def: 2.2 },
      { key: "beta", label: "Akım Kazancı β (hFE)", min: 20, max: 300, step: 5, def: 50 },
      { key: "Vbe", label: "V_BE Eşik Gerilimi (V)", min: 0.5, max: 0.8, step: 0.05, def: 0.7 }
    ],
    emitter: [
      { key: "Vcc", label: "Besleme Vcc (V)", min: 5, max: 30, step: 0.5, def: 20 },
      { key: "Rb", label: "Baz Direnci RB (kΩ)", min: 10, max: 1000, step: 5, def: 430 },
      { key: "Rc", label: "Kollektör Direnci RC (kΩ)", min: 0.2, max: 15, step: 0.1, def: 2 },
      { key: "Re", label: "Emiter Direnci RE (kΩ)", min: 0.1, max: 10, step: 0.1, def: 1 },
      { key: "beta", label: "Akım Kazancı β", min: 20, max: 300, step: 5, def: 50 },
      { key: "Vbe", label: "V_BE (V)", min: 0.5, max: 0.8, step: 0.05, def: 0.7 }
    ],
    divider: [
      { key: "Vcc", label: "Besleme Vcc (V)", min: 5, max: 30, step: 0.5, def: 22 },
      { key: "R1", label: "Üst Bölücü R1 (kΩ)", min: 1, max: 200, step: 0.5, def: 39 },
      { key: "R2", label: "Alt Bölücü R2 (kΩ)", min: 1, max: 100, step: 0.5, def: 3.9 },
      { key: "Rc", label: "Kollektör Direnci RC (kΩ)", min: 0.2, max: 20, step: 0.1, def: 10 },
      { key: "Re", label: "Emiter Direnci RE (kΩ)", min: 0.1, max: 10, step: 0.1, def: 1.5 },
      { key: "beta", label: "Akım Kazancı β", min: 20, max: 300, step: 5, def: 100 },
      { key: "Vbe", label: "V_BE (V)", min: 0.5, max: 0.8, step: 0.05, def: 0.7 }
    ],
    feedback: [
      { key: "Vcc", label: "Besleme Vcc (V)", min: 5, max: 30, step: 0.5, def: 10 },
      { key: "Rf", label: "Geri Besleme RF (kΩ)", min: 10, max: 600, step: 5, def: 250 },
      { key: "Rc", label: "Kollektör Direnci RC (kΩ)", min: 0.2, max: 15, step: 0.1, def: 4.7 },
      { key: "Re", label: "Emiter Direnci RE (kΩ)", min: 0, max: 10, step: 0.1, def: 1.2 },
      { key: "beta", label: "Akım Kazancı β", min: 20, max: 300, step: 5, def: 90 },
      { key: "Vbe", label: "V_BE (V)", min: 0.5, max: 0.8, step: 0.05, def: 0.7 }
    ]
  }
};

function solve2x2(a11, a12, b1, a21, a22, b2) {
  const det = a11 * a22 - a12 * a21;
  return [(b1 * a22 - b2 * a12) / det, (a11 * b2 - a21 * b1) / det];
}

function solveM4(topo, p, stepIdx = 3) {
  const reveal = stepIdx >= 1;
  const showFlow = stepIdx >= 2;
  const Vcesat = 0.2;
  let Ib = 0, Ic = 0, Ie = 0, Vce = 0, Vb = 0, Vc = 0, Ve = 0;
  let IcSatLine = 0, isSat = false, isCutoff = false;
  let steps = [], intro = "", extraQ = null, quiz = null;

  if (topo === "fixed") {
    const { Vcc, Rb, Rc, beta, Vbe } = p;
    IcSatLine = Vcc / Rc;
    Ib = Math.max(0, (Vcc - Vbe) / Rb);
    const IcActive = beta * Ib;
    const VceActive = Vcc - IcActive * Rc;

    if (Ib <= 0) {
      isCutoff = true; Ic = 0; Ie = 0; Vce = Vcc; Vc = Vcc; Vb = Vcc; Ve = 0;
    } else if (VceActive <= Vcesat) {
      isSat = true; Vce = Vcesat; Ic = (Vcc - Vcesat) / Rc; Ie = Ib + Ic;
      Vc = Vce; Vb = Vbe; Ve = 0;
    } else {
      Ic = IcActive; Ie = Ib + Ic; Vce = VceActive; Vc = Vce; Vb = Vbe; Ve = 0;
    }

    quiz = {
      question: `Sabit öngerilimli bu devrede aktif bölge formülüyle V_CE = ${fmt(VceActive)} V bulunuyor. Transistör hangi bölgededir?`,
      options: ["İleri Aktif Bölge (I_C = β·I_B geçerli)", "Doyum / Saturation (I_C = β·I_B GEÇERSİZ!)"],
      correctIdx: isSat ? 1 : 0,
      explanation: isSat
        ? `Doğru! Aktif denemede V_CE ≤ 0.2 V çıktığı için transistör DOYUMDADIR. Bu durumda V_CE = 0.2 V ve I_C(sat) = (V_CC - 0.2)/R_C alınır.`
        : `Doğru! V_CE = ${fmt(VceActive)} V > 0.2 V olduğu için transistör İleri Aktif bölgededir.`
    };

    intro = `<strong>Sabit Öngerilim (Fixed-Bias) Metodu:</strong> Baz çevriminden I<sub>B</sub> bulunur, ardından aktif varsayımla I<sub>C</sub> = β·I<sub>B</sub> ve V<sub>CE</sub> hesaplanır. Eğer <strong>V<sub>CE</sub> ≤ 0.2 V</strong> çıkarsa transistör <strong>DOYUMDADIR!</strong>`;
    steps = [
      {
        title: "Baz Çevrimi (KVL) ve Aktif Bölge Denemesi",
        body: `Baz çevriminden I<sub>B</sub> hesaplanır ve aktif bölge varsayımı yapılır:`,
        formula: `I_B = (V_CC - V_BE) / R_B = ${fmt(Ib * 1000, 1)} µA\nI_C(aktif) = β · I_B = ${fmt(IcActive)} mA\nV_CE(aktif) = V_CC - I_C·R_C = ${fmt(VceActive)} V`,
        tone: "info"
      },
      {
        title: "Doyum Kontrolü, Q-Noktası & Yük Doğrusu",
        body: isSat ? `V<sub>CE(aktif)</sub> ≤ 0.2 V ⇒ <strong>DOYUM!</strong> Gerçek kollektör akımı:` : `V<sub>CE</sub> > 0.2 V ⇒ İleri Aktif Bölge geçerli.`,
        formula: `Q(${fmt(Vce)} V, ${fmt(Ic)} mA) | Yük Doğrusu: V_CE(off)=${fmt(Vcc)}V, I_C(sat,0)=${fmt(IcSatLine)}mA\nr_e = 26 mV / I_E = ${Ie > 0 ? fmt(26 / Ie, 1) : "∞"} Ω`,
        tone: isSat ? "warn" : "success"
      }
    ];
  } else if (topo === "emitter") {
    const { Vcc, Rb, Rc, Re, beta, Vbe } = p;
    IcSatLine = Vcc / (Rc + Re);
    Ib = Math.max(0, (Vcc - Vbe) / (Rb + (beta + 1) * Re));
    const IcActive = beta * Ib;
    const IeActive = (beta + 1) * Ib;
    const VceActive = Vcc - IcActive * Rc - IeActive * Re;

    if (VceActive <= Vcesat) {
      isSat = true;
      [Ib, Ic] = solve2x2(Rb + Re, Re, Vcc - Vbe, Re, Rc + Re, Vcc - Vcesat);
      Ie = Ib + Ic; Vce = Vcesat; Ve = Ie * Re; Vb = Ve + Vbe; Vc = Ve + Vce;
    } else {
      Ic = IcActive; Ie = IeActive; Vce = VceActive; Ve = Ie * Re; Vb = Ve + Vbe; Vc = Vcc - Ic * Rc;
    }

    quiz = {
      question: `Emiter direnci R_E = ${fmt(Re)} kΩ, baz çevrimi KVL denklemine hangi çarpanla yansır?`,
      options: ["Doğrudan R_E olarak", "(β + 1)·R_E olarak (I_E akımı geçtiği için)"],
      correctIdx: 1,
      explanation: `Doğru! R_E direncinden baz akımı değil emiter akımı I_E = (β+1)·I_B geçtiği için baz tarafına (β+1)·R_E olarak yansır.`
    };

    intro = `<strong>Emiter Dirençli Öngerilim:</strong> R<sub>E</sub> üzerinden I<sub>E</sub> = (β+1)I<sub>B</sub> aktığı için baz çevrimine <strong>(β+1)R<sub>E</sub></strong> yansır ve Q-noktası β değişimine karşı kararlı hale gelir.`;
    steps = [
      {
        title: "Yansıtılmış R_E ile Baz Akımı ve Aktif Deneme",
        body: `Baz KVL denkleminden:`,
        formula: `I_B = (V_CC - V_BE) / [R_B + (β+1)R_E] = ${fmt(Ib * 1000, 1)} µA\nI_C(aktif) = ${fmt(IcActive)} mA | V_CE(aktif) = ${fmt(VceActive)} V`,
        tone: "info"
      },
      {
        title: "Doyum Kontrolü & Düğüm Gerilimleri",
        body: isSat ? `<strong>DOYUM!</strong> V<sub>CE</sub> = 0.2 V ile tam 2×2 çevre çözümü yapıldı.` : `Aktif bölge geçerli. Tekil düğüm gerilimleri:`,
        formula: `Q(${fmt(Vce)} V, ${fmt(Ic)} mA) | V_E=${fmt(Ve)}V, V_B=${fmt(Vb)}V, V_C=${fmt(Vc)}V\nr_e = ${Ie > 0 ? fmt(26 / Ie, 1) : "∞"} Ω`,
        tone: isSat ? "warn" : "success"
      }
    ];
  } else if (topo === "divider") {
    const { Vcc, R1, R2, Rc, Re, beta, Vbe } = p;
    IcSatLine = Vcc / (Rc + Re);
    const Rth = (R1 * R2) / (R1 + R2);
    const Eth = Vcc * (R2 / (R1 + R2));
    Ib = Math.max(0, (Eth - Vbe) / (Rth + (beta + 1) * Re));
    const IcActive = beta * Ib;
    const IeActive = (beta + 1) * Ib;
    const VceActive = Vcc - IcActive * Rc - IeActive * Re;

    if (Eth <= Vbe) {
      isCutoff = true; Ib = 0; Ic = 0; Ie = 0; Vce = Vcc; Vb = Eth; Ve = 0; Vc = Vcc;
    } else if (VceActive <= Vcesat) {
      isSat = true;
      [Ib, Ic] = solve2x2(Rth + Re, Re, Eth - Vbe, Re, Rc + Re, Vcc - Vcesat);
      Ie = Ib + Ic; Vce = Vcesat; Ve = Ie * Re; Vb = Ve + Vbe; Vc = Ve + Vce;
    } else {
      Ic = IcActive; Ie = IeActive; Vce = VceActive; Ve = Ie * Re; Vb = Ve + Vbe; Vc = Vcc - Ic * Rc;
    }

    const approxOk = beta * Re >= 10 * R2;
    const VbApprox = Eth;
    const VeApprox = Math.max(0, VbApprox - Vbe);
    const IcApprox = VeApprox / Re;
    const VceApprox = Math.max(Vcesat, Vcc - IcApprox * (Rc + Re));
    const errPct = Ic > 0 ? (Math.abs(IcApprox - Ic) / Ic) * 100 : 0;
    extraQ = { Vce: VceApprox, Ic: IcApprox, label: `Yaklaşık Q(${fmt(VceApprox)}V, ${fmt(IcApprox)}mA)` };

    quiz = {
      question: `β·R_E = ${fmt(beta * Re)} kΩ ve 10·R_2 = ${fmt(10 * R2)} kΩ. Sınavda hızlı "Yaklaşık Yöntem" kullanılabilir mi?`,
      options: ["Evet, şart sağlanıyor (β·R_E ≥ 10·R_2)", "Hayır, şart sağlanmıyor → Tam Thévenin ŞART!"],
      correctIdx: approxOk ? 0 : 1,
      explanation: approxOk
        ? `Doğru! ${fmt(beta * Re)} kΩ ≥ ${fmt(10 * R2)} kΩ olduğu için baz akımı bölücüyü bozmaz; Yaklaşık Yöntem güvenle kullanılabilir (fark sadece %${fmt(errPct, 1)}).`
        : `Doğru! ${fmt(beta * Re)} kΩ < ${fmt(10 * R2)} kΩ olduğu için yaklaşık yöntem %${fmt(errPct, 1)} hata yapar; R1 || R2 Thévenin eşdeğeri kurulmalıdır!`
    };

    intro = `<strong>Gerilim Bölücülü Öngerilim:</strong> İlk adım daima <strong>β·R<sub>E</sub> ≥ 10·R<sub>2</sub></strong> testidir. Sağlanırsa Yaklaşık Yöntem, sağlanmazsa <strong>Thévenin Eşdeğeri (R<sub>th</sub>, E<sub>th</sub>)</strong> kullanılır!`;
    steps = [
      {
        title: "1. Şart Testi ve Thévenin Eşdeğeri (R_th, E_th)",
        body: approxOk ? `Şart sağlandı (fark %${fmt(errPct, 1)}).` : `Şart sağlanmadı! <strong>TAM THÉVENİN ZORUNLU</strong>.`,
        formula: `β·R_E = ${fmt(beta * Re)} kΩ  ${approxOk ? "≥" : "<"}  10·R_2 = ${fmt(10 * R2)} kΩ\nR_th = R1 || R2 = ${fmt(Rth)} kΩ   |   E_th = Vcc·R2/(R1+R2) = ${fmt(Eth)} V`,
        tone: approxOk ? "success" : "warn"
      },
      {
        title: "2. Tam Çözüm vs Yaklaşık Yöntem Karşılaştırması",
        body: isSat ? `<strong>DOYUM UYARISI:</strong> V<sub>CE</sub> ≤ 0.2 V!` : `İki yöntemin karşılaştırmalı Q-noktası:`,
        formula: `TAM (Thévenin):  I_B = ${fmt(Ib * 1000, 1)} µA,  I_C = ${fmt(Ic)} mA,  V_CE = ${fmt(Vce)} V\nYAKLAŞIK:        I_C ≈ ${fmt(IcApprox)} mA,  V_CE ≈ ${fmt(VceApprox)} V\nr_e = ${Ie > 0 ? fmt(26 / Ie, 1) : "∞"} Ω`,
        tone: "info"
      }
    ];
  } else {
    const { Vcc, Rf, Rc, Re, beta, Vbe } = p;
    IcSatLine = Vcc / (Rc + Re);
    Ib = Math.max(0, (Vcc - Vbe) / (Rf + (beta + 1) * (Rc + Re)));
    Ic = beta * Ib; Ie = (beta + 1) * Ib;
    Vce = Vcc - Ie * (Rc + Re); Ve = Ie * Re; Vb = Ve + Vbe; Vc = Ve + Vce;

    quiz = {
      question: `Kollektör geri beslemeli devrede transistör doyuma girebilir mi?`,
      options: ["Evet, Rc büyürse doyuma girer", "Hayır, V_CE = V_BE + I_B·R_F > 0.7 V olduğu için daima aktif kalır"],
      correctIdx: 1,
      explanation: `Doğru! Baz R_F ile kollektöre bağlı olduğu için V_CE = 0.7 + I_B·R_F > 0.7 V olur ve teorik olarak doyuma geçmez.`
    };

    intro = `<strong>Kollektör Geri Beslemeli Devre:</strong> R<sub>C</sub> üzerinden toplam I<sub>E</sub> = I<sub>C</sub> + I<sub>B</sub> geçtiği için dış çevre KVL denkleminde (R<sub>C</sub>+R<sub>E</sub>) terimi (β+1) ile çarpılır.`;
    steps = [
      {
        title: "Dış Çevre KVL ile I_B Hesabı",
        body: `V<sub>CC</sub> → R<sub>C</sub> → R<sub>F</sub> → V<sub>BE</sub> → R<sub>E</sub> → GND çevrimi:`,
        formula: `I_B = (V_CC - V_BE) / [R_F + (β+1)(R_C+R_E)] = ${fmt(Ib * 1000, 1)} µA`,
        tone: "info"
      },
      {
        title: "Q-Noktası ve Düğüm Gerilimleri",
        body: `Aktif bölge Q-noktası:`,
        formula: `I_C = ${fmt(Ic)} mA | V_CE = ${fmt(Vce)} V\nV_B=${fmt(Vb)}V, V_C=${fmt(Vc)}V, V_E=${fmt(Ve)}V | r_e = ${fmt(26 / Ie, 1)} Ω`,
        tone: "success"
      }
    ];
  }

  const svg = SVG_WRAP(`
    <text class="val" x="275" y="22" text-anchor="middle">+Vcc = ${fmt(p.Vcc)} V</text>
    <line class="wire" x1="275" y1="28" x2="275" y2="44" />
    ${svgResistorV(275, 44, 102, "Rc", `${fmt(p.Rc)}k`, "right")}
    <line class="wire" x1="275" y1="102" x2="275" y2="115" />
    ${svgBJT(265, 139, isSat, reveal)}
    ${topo === "fixed" || topo === "emitter" ? `
      <line class="wire" x1="155" y1="44" x2="275" y2="44" />
      ${svgResistorV(155, 44, 139, "RB", `${fmt(p.Rb)}k`, "left")}
      <line class="wire" x1="155" y1="139" x2="243" y2="139" />
    ` : topo === "divider" ? `
      <line class="wire" x1="155" y1="44" x2="275" y2="44" />
      ${svgResistorV(155, 44, 128, "R1", `${fmt(p.R1)}k`, "left")}
      <line class="wire" x1="155" y1="128" x2="155" y2="150" />
      ${svgNodeDot(155, 139)}
      <line class="wire" x1="155" y1="139" x2="243" y2="139" />
      ${svgResistorV(155, 150, 215, "R2", `${fmt(p.R2)}k`, "left")}
      ${svgGround(155, 215)}
    ` : `
      <line class="wire" x1="275" y1="108" x2="155" y2="108" />
      ${svgNodeDot(275, 108)}
      <line class="wire" x1="155" y1="108" x2="155" y2="139" />
      ${svgResistorH(155, 238, 139, "RF", `${fmt(p.Rf)}k`)}
      <line class="wire" x1="238" y1="139" x2="243" y2="139" />
    `}
    ${p.Re && p.Re > 0 ? `
      <line class="wire" x1="275" y1="163" x2="275" y2="168" />
      ${svgResistorV(275, 168, 215, "RE", `${fmt(p.Re)}k`, "right")}
      ${svgGround(275, 215)}
    ` : `
      <line class="wire" x1="275" y1="163" x2="275" y2="215" />
      ${svgGround(275, 215)}
    `}
    ${reveal ? `
      <text class="${isSat ? "warn-txt" : "on-txt"}" x="365" y="124">Bölge: ${isCutoff ? "KESİM" : isSat ? "DOYUM (SAT)" : "İLERİ AKTİF"}</text>
      <text class="val" x="365" y="144">Ic = ${fmt(Ic)} mA</text>
      <text class="val" x="365" y="162">Vce = ${fmt(Vce)} V</text>
    ` : `
      <text class="val" x="365" y="136">Q(Vce, Ic) = ?</text>
    `}
    <text class="sub" x="365" y="182">β = ${p.beta}</text>
  `);

  const markers = [{ x: Vce, y: Ic, color: isSat ? "#d97706" : "#16a34a", label: `Q(${fmt(Vce)}V, ${fmt(Ic)}mA)` }];
  if (extraQ) markers.push({ x: extraQ.Vce, y: extraQ.Ic, color: "#7c3aed", label: extraQ.label });

  const spice = `* Modul 4: BJT DC Polarma (${topo.toUpperCase()})
.model Q_SINAV NPN(BF=${p.beta} VAF=1e6 IS=1e-15 NF=1)
Vcc vcc 0 DC ${fmt(p.Vcc)}
${topo === "fixed" ? `Rb vcc b ${fmt(p.Rb)}k\nRc vcc c ${fmt(p.Rc)}k\nQ1 c b 0 Q_SINAV` :
    topo === "emitter" ? `Rb vcc b ${fmt(p.Rb)}k\nRc vcc c ${fmt(p.Rc)}k\nRe e 0 ${fmt(p.Re)}k\nQ1 c b e Q_SINAV` :
    topo === "divider" ? `R1 vcc b ${fmt(p.R1)}k\nR2 b 0 ${fmt(p.R2)}k\nRc vcc c ${fmt(p.Rc)}k\nRe e 0 ${fmt(p.Re)}k\nQ1 c b e Q_SINAV` :
    `Rc vcc c ${fmt(p.Rc)}k\nRf c b ${fmt(p.Rf)}k\n${p.Re > 0 ? `Re e 0 ${fmt(p.Re)}k` : `Ve e 0 DC 0`}\nQ1 c b e Q_SINAV`}
.op
.print op v(c) v(b) v(e)
.end`;

  return {
    statusText: !reveal ? "Adım 1: Tahmin Et" : isCutoff ? "KESİM" : isSat ? "DOYUM (Saturation)" : "İLERİ AKTİF",
    statusTone: !reveal ? "badge-info" : isSat ? "badge-warn" : isCutoff ? "badge-off" : "badge-on",
    quiz,
    checkTarget: { label: "Kollektör Akımı I_C (mA)", unit: "mA", expected: Ic },
    kpis: [
      { label: "Baz Akımı I_B", val: `${fmt(Ib * 1000, 1)} µA` },
      { label: "Kollektör I_C", val: `${fmt(Ic)} mA`, cls: "green" },
      { label: "V_CEQ", val: `${fmt(Vce)} V`, cls: isSat ? "amber" : "green" },
      { label: "r_e (AC Ön Hazırlık)", val: Ie > 0 ? `${fmt(26 / Ie, 1)} Ω` : "∞" }
    ],
    intro, steps, svg,
    plots: [{
      id: "loadline", title: "DC Yük Doğrusu (Ic vs Vce) & Q-Noktası",
      cfg: {
        xMin: 0, xMax: p.Vcc * 1.15, yMin: 0, yMax: Math.max(IcSatLine, Ic) * 1.25,
        xLabel: "V_CE (V)", yLabel: "I_C (mA)",
        curves: [
          { name: "DC Yük Doğrusu", color: "#2563eb", width: 2.8, points: [[0, IcSatLine], [p.Vcc, 0]] },
          { name: "Sabit I_C", color: "#94a3b8", dashed: true, width: 1.6, points: [[0.2, Ic], [p.Vcc, Ic]] }
        ],
        vLines: [{ x: 0.2, color: "#d97706", label: "Doyum (0.2V)" }],
        markers
      }
    }],
    spice
  };
}

/* --------------------------------------------------------------------------
 * MODÜL 5: KLASİK VİZE SORULARI & SPICE REHBERİ
 * -------------------------------------------------------------------------- */
const EXAM_QUESTIONS = [
  {
    id: "q1", tag: "Modül 1 • DC Çoklu Diyot", title: "Soru 1: Paralel Silisyum & Germanyum Diyot",
    question: "12 V'luk DC kaynak, 330 Ω (0.33 kΩ) seri direnç üzerinden paralel bağlı bir Silisyum (V<sub>K</sub> = 0.7 V) ve bir Germanyum (V<sub>K</sub> = 0.3 V) diyoda bağlanmıştır. Çıkış gerilimi V<sub>o</sub> ve diyot akımlarını bulunuz.",
    answer: `<strong>Çözüm Özeti:</strong><br>1) Paralel bağlı iki diyottan eşik gerilimi düşük olan <strong>Ge (0.3 V)</strong> önce iletime geçer ve V<sub>o</sub> = <strong>0.3 V</strong> olur.<br>2) Si diyot kesimde kalır (I<sub>D1</sub> = 0 mA).<br>3) I<sub>D2</sub> = (12 - 0.3) / 0.33 kΩ = <strong>35.45 mA</strong>.`,
    module: "m1", topo: "parallel_diodes", params: { E: 12, R: 0.33, Vk1: 0.7, Vk2: 0.3 }
  },
  {
    id: "q2", tag: "Modül 2 • Seri Kırpıcı", title: "Soru 2: DC Pilli Seri Kırpıcı (Boylestad)",
    question: "Girişine ±20 V sinüs uygulanan seri kırpıcıda ideal diyot (V<sub>K</sub> = 0 V) ileri yönde ve +5 V DC kaynak ile desteklenmektedir. Geçiş gerilimini ve çıkış tepe değerlerini bulunuz.",
    answer: `<strong>Çözüm Özeti:</strong><br>1) Geçiş şartı: v<sub>i</sub> > <strong>-5 V</strong> iken diyot ON olur.<br>2) V<sub>o(max)</sub> = 20 + 5 = <strong>+25 V</strong>, v<sub>i</sub> ≤ -5 V iken <strong>0 V</strong>.`,
    module: "m2", topo: "series_clipper", params: { wave: "sine", Vm: 20, Vdc: 5, dir: "forward", Vk: 0 }
  },
  {
    id: "q3", tag: "Modül 2 • Kenetleyici", title: "Soru 3: Kare Dalgalı Pozitif Kenetleyici",
    question: "±20 V kare dalga girişli kenetleyicide diyot yukarı yönlü (V<sub>K</sub> = 0.7 V) ve altında +5 V pil (artısı üstte) bulunmaktadır. Çıkışın min ve max değerlerini bulunuz.",
    answer: `<strong>Çözüm Özeti:</strong><br>1) Negatif alternansta (-20 V) diyot ON olur: V<sub>o(min)</sub> = 5 - 0.7 = <strong>+4.3 V</strong>.<br>2) V<sub>C</sub> = -24.3 V ⇒ Pozitif alternansta V<sub>o(max)</sub> = +20 + 24.3 = <strong>+44.3 V</strong>.`,
    module: "m2", topo: "clamper", params: { wave: "square", Vm: 20, Vdc: 5, dir: "up", Vk: 0.7 }
  },
  {
    id: "q4", tag: "Modül 3 • Zener Regülatör", title: "Soru 4: Zener Diyot Regülasyon & RL(min)",
    question: "V<sub>i</sub> = 16 V, R<sub>S</sub> = 1 kΩ, V<sub>Z</sub> = 10 V olan devrede R<sub>L</sub> = 1.2 kΩ bağlanmıştır. Zener durumunu ve R<sub>L(min)</sub> sınırını bulunuz.",
    answer: `<strong>Çözüm Özeti:</strong><br>1) V<sub>th</sub> = 16 · (1.2/2.2) = <strong>8.73 V &lt; 10 V</strong> ⇒ Zener <strong>OFF</strong>.<br>2) R<sub>L(min)</sub> = (1000 · 10) / (16 - 10) = <strong>1666.7 Ω</strong>.`,
    module: "m3", topo: "zener_reg", params: { Vi: 16, Rs: 1000, Vz: 10, Pzm: 300, RL: 1200 }
  },
  {
    id: "q5", tag: "Modül 4 • BJT Bölücü", title: "Soru 5: Thévenin Zorunluluğu Olan BJT Devresi",
    question: "V<sub>CC</sub> = 18 V, R<sub>1</sub> = 82 kΩ, R<sub>2</sub> = 22 kΩ, R<sub>C</sub> = 5.6 kΩ, R<sub>E</sub> = 1.2 kΩ, β = 50 olan devrede yaklaşık yöntem geçerli midir? Q-noktasını bulunuz.",
    answer: `<strong>Çözüm Özeti:</strong><br>1) β·R<sub>E</sub> = 60 kΩ &lt; 10·R<sub>2</sub> = 220 kΩ ⇒ <strong>Yaklaşık kullanılamaz!</strong><br>2) R<sub>th</sub> = 17.35 kΩ, E<sub>th</sub> = 3.81 V ⇒ I<sub>B</sub> = <strong>39.6 µA</strong>, I<sub>C</sub> = <strong>1.98 mA</strong>, V<sub>CE</sub> = <strong>4.50 V</strong>.`,
    module: "m4", topo: "divider", params: { Vcc: 18, R1: 82, R2: 22, Rc: 5.6, Re: 1.2, beta: 50, Vbe: 0.7 }
  },
  {
    id: "q6", tag: "Modül 4 • BJT Doyum", title: "Soru 6: Sabit Öngerilimli Doyum Tuzağı",
    question: "V<sub>CC</sub> = 12 V, R<sub>B</sub> = 47 kΩ, R<sub>C</sub> = 4.7 kΩ ve β = 100 olan devrede Q-noktasını bulunuz. (V<sub>CE(sat)</sub> = 0.2 V)",
    answer: `<strong>Çözüm Özeti:</strong><br>1) I<sub>B</sub> = 0.2404 mA, aktif denemede V<sub>CE</sub> = -101.00 V ≤ 0.2 V (İmkansız!).<br>2) Transistör <strong>DOYUMDA</strong>: V<sub>CE</sub> = <strong>0.2 V</strong>, I<sub>C(sat)</sub> = (12 - 0.2)/4.7 = <strong>2.51 mA</strong>.`,
    module: "m4", topo: "fixed", params: { Vcc: 12, Rb: 47, Rc: 4.7, beta: 100, Vbe: 0.7 }
  }
];

function renderExamModule() {
  const container = document.getElementById("examLayout");
  const cards = EXAM_QUESTIONS.map((q) => `
    <div class="card exam-card">
      <div>
        <div class="card-header">
          <h3 class="card-title">${q.title}</h3>
          <span class="badge-tag badge-info">${q.tag}</span>
        </div>
        <div class="exam-q-text">${q.question}</div>
      </div>
      <div class="exam-answer-box" id="ans_${q.id}">${q.answer}</div>
      <div class="exam-actions">
        <button class="btn" onclick="toggleExamAnswer('${q.id}')">Adım Adım Cevabı Göster / Gizle</button>
        <button class="btn btn-primary" onclick="loadExamInSim('${q.id}')">Sihirbazda Adım Adım Çöz</button>
      </div>
    </div>
  `).join("");

  container.innerHTML = `
    <div class="exam-grid">${cards}</div>
    <section class="card guide-banner">
      <div class="card-header">
        <h2 class="card-title">SPICE Komutları &amp; Vize Hızlı Referans Rehberi</h2>
        <span class="badge-tag badge-on">ELM2021 Sınav Özeti</span>
      </div>
      <div class="guide-grid">
        <div class="guide-item">
          <h4>1. SPICE Birim Tuzakları</h4>
          <p>SPICE büyük/küçük harf ayırmaz! <code>10M</code> = 10 mili (10⁻³), <strong>Mega için daima <code>10MEG</code></strong> yazılır. Kilo: <code>k</code>, Mikro: <code>u</code>, Nano: <code>n</code>.</p>
        </div>
        <div class="guide-item">
          <h4>2. Sınav Tipi İdeal Diyot/BJT Modeli</h4>
          <p>Sabit eşik ve β için: <code>.model D_IDEAL D(IS=1e-15 N=0.001)</code> (yanına seri V<sub>K</sub> kaynağı) veya BJT için <code>.model Q_SINAV NPN(BF=100 VAF=1e6)</code> kullanılır.</p>
        </div>
        <div class="guide-item">
          <h4>3. Analiz Komutları</h4>
          <p><code>.op</code>: DC çalışma noktası.<br><code>.dc Vin -10 10 0.1</code>: Kırpıcı V<sub>o</sub>-V<sub>in</sub> eğrisi.<br><code>.tran 10u 4m</code>: Osiloskop zaman grafiği.</p>
        </div>
        <div class="guide-item">
          <h4>4. Python &amp; Terminal Doğrulama</h4>
          <p>Klasördeki <code>python3 elektronik1_lab.py --test</code> komutunu çalıştırarak tüm vize örneklerinin <code>numpy/sympy</code> doğrulamasını terminalden görebilirsiniz.</p>
        </div>
      </div>
    </section>
  `;
}

window.toggleExamAnswer = (qid) => {
  document.getElementById(`ans_${qid}`).classList.toggle("visible");
};

window.loadExamInSim = (qid) => {
  const q = EXAM_QUESTIONS.find((item) => item.id === qid);
  if (!q) return;
  state.module = q.module;
  state.topology[q.module] = q.topo;
  state.params[q.module][q.topo] = { ...q.params };
  state.currentStep = 0;
  state.quizSelection = null;
  state.checkFeedback = "";
  switchModule(q.module);
  showToast("Soru Adım 1'e yüklendi — önce tahmin edin!");
};

/* --------------------------------------------------------------------------
 * UYGULAMA DURUMU & ADIM ADIM SİHİRBAZ YÖNETİMİ
 * -------------------------------------------------------------------------- */
const MODULES = { m1: M1_CONFIG, m2: M2_CONFIG, m3: M3_CONFIG, m4: M4_CONFIG };
const SOLVERS = { m1: solveM1, m2: solveM2, m3: solveM3, m4: solveM4 };

const state = {
  module: "m1",
  topology: { m1: "parallel_diodes", m2: "series_clipper", m3: "zener_reg", m4: "divider" },
  params: { m1: {}, m2: {}, m3: {}, m4: {} },
  activePlotIdx: 0,
  currentStep: 0,
  showAllSteps: false,
  quizSelection: null,
  checkInputVal: "",
  checkFeedback: null
};

Object.keys(MODULES).forEach((mKey) => {
  const cfg = MODULES[mKey];
  cfg.topologies.forEach((t) => {
    const defaults = {};
    cfg.paramsSchema[t.id].forEach((s) => { defaults[s.key] = s.def; });
    state.params[mKey][t.id] = defaults;
  });
});

function buildControls() {
  const mKey = state.module;
  const cfg = MODULES[mKey];
  const topoId = state.topology[mKey];

  document.getElementById("moduleWeekBadge").textContent = cfg.week;

  const topoSel = document.getElementById("topologySelect");
  topoSel.innerHTML = cfg.topologies.map((t) => `<option value="${t.id}" ${t.id === topoId ? "selected" : ""}>${t.name}</option>`).join("");

  const presets = cfg.presets[topoId] || [];
  const presetGroup = document.getElementById("presetGroup");
  presetGroup.innerHTML = presets.map((pr, idx) => `<button class="btn btn-preset" data-preset-idx="${idx}">${pr.label}</button>`).join("");
  presetGroup.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.presetIdx);
      state.params[mKey][topoId] = { ...presets[idx].val };
      state.quizSelection = null;
      state.checkFeedback = null;
      buildControls();
      updateSimulation();
    });
  });

  const container = document.getElementById("controlsContainer");
  const schema = cfg.paramsSchema[topoId];
  const curVals = state.params[mKey][topoId];

  container.innerHTML = schema.map((s) => {
    const val = curVals[s.key];
    if (s.type === "select") {
      const opts = s.options.map((o) => `<option value="${o.v}" ${o.v === val ? "selected" : ""}>${o.t}</option>`).join("");
      return `
        <div class="control-group">
          <div class="control-row"><label>${s.label}</label></div>
          <select data-param="${s.key}">${opts}</select>
        </div>
      `;
    }
    return `
      <div class="control-group">
        <div class="control-row">
          <label>${s.label}</label>
          <input type="number" data-param-num="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${val}" />
        </div>
        <input type="range" data-param-range="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${val}" />
      </div>
    `;
  }).join("");

  const onParamChange = () => {
    state.quizSelection = null;
    state.checkFeedback = null;
    updateSimulation();
  };

  container.querySelectorAll("select[data-param]").forEach((sel) => {
    sel.addEventListener("change", () => { curVals[sel.dataset.param] = sel.value; onParamChange(); });
  });

  container.querySelectorAll("input[data-param-range]").forEach((rng) => {
    rng.addEventListener("input", () => {
      const key = rng.dataset.paramRange;
      const numVal = parseFloat(rng.value);
      curVals[key] = numVal;
      const numEl = container.querySelector(`input[data-param-num="${key}"]`);
      if (numEl) numEl.value = numVal;
      onParamChange();
    });
  });

  container.querySelectorAll("input[data-param-num]").forEach((num) => {
    num.addEventListener("input", () => {
      const key = num.dataset.paramNum;
      const val = parseFloat(num.value);
      if (Number.isNaN(val)) return;
      curVals[key] = val;
      const rngEl = container.querySelector(`input[data-param-range="${key}"]`);
      if (rngEl) rngEl.value = val;
      onParamChange();
    });
  });
}

let lastSpiceText = "";

function renderQuizBlock(quiz) {
  if (!quiz) return "";
  const answered = state.quizSelection !== null;
  const isCorrect = answered && state.quizSelection === quiz.correctIdx;

  const optsHtml = quiz.options.map((opt, idx) => {
    let cls = "quiz-opt";
    if (answered) {
      if (idx === quiz.correctIdx) cls += " correct";
      else if (idx === state.quizSelection) cls += " wrong";
    }
    return `<button class="${cls}" data-quiz-idx="${idx}">${opt}</button>`;
  }).join("");

  return `
    <div class="quiz-box">
      <div class="quiz-title">Etkileşim: Önce Sen Karar Ver!</div>
      <div class="quiz-question">${quiz.question}</div>
      <div class="quiz-options">${optsHtml}</div>
      <div class="quiz-feedback ${answered ? `show ${isCorrect ? "ok" : "err"}` : ""}">
        ${answered ? `<strong>${isCorrect ? "Tebrikler, Doğru!" : "Dikkat, Sınav Tuzağı:"}</strong> ${quiz.explanation}` : ""}
      </div>
    </div>
  `;
}

function renderCheckBlock(checkTarget) {
  if (!checkTarget) return "";
  const fb = state.checkFeedback;
  return `
    <div class="check-box">
      <div class="section-label" style="color: var(--accent-blue); margin-bottom: 4px;">Kendi Hesabını Test Et (Opsiyonel)</div>
      <div style="font-size: 0.85rem; color: var(--text-secondary);">
        Kağıtta bulduğun <strong>${checkTarget.label}</strong> değerini yazıp doğrula:
      </div>
      <div class="check-input-row">
        <input type="number" step="0.01" id="userCheckInput" placeholder="Örn: ${fmt(checkTarget.expected)}" value="${state.checkInputVal}" />
        <span style="font-weight: 700; color: var(--text-secondary);">${checkTarget.unit}</span>
        <button class="btn btn-primary" id="runCheckBtn">Kontrol Et</button>
      </div>
      ${fb ? `<div class="quiz-feedback show ${fb.ok ? "ok" : "err"}" style="margin-top:8px;">${fb.msg}</div>` : ""}
    </div>
  `;
}

function renderStepCard(st, num) {
  return `
    <div class="step-card ${st.tone || ""}">
      <div class="step-head"><span class="step-pill-num" style="background: var(--accent-blue); color: #fff;">${num}</span><span>${st.title}</span></div>
      <div class="step-body">${st.body}</div>
      ${st.formula ? `<div class="formula-box">${st.formula}</div>` : ""}
    </div>
  `;
}

function renderSummaryAndSpice(res) {
  const kpisHtml = `
    <div class="kpi-grid">
      ${res.kpis.map((k) => `
        <div class="kpi-box">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-val ${k.cls || ""}">${k.val}</div>
        </div>
      `).join("")}
    </div>
  `;
  const spiceHtml = `
    <div>
      <div class="spice-header">
        <span class="section-label" style="margin: 0;">Otomatik SPICE Netlist (.cir)</span>
        <div style="display: flex; gap: 6px;">
          <button class="btn" id="copySpiceBtn">Kopyala</button>
          <button class="btn btn-primary" id="downloadSpiceBtn">.cir İndir</button>
        </div>
      </div>
      <pre class="spice-code">${res.spice}</pre>
    </div>
  `;
  return kpisHtml + spiceHtml;
}

function bindWizardInteractions(res) {
  const stage = document.getElementById("wizardStage");
  stage.querySelectorAll("button[data-quiz-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.quizSelection = Number(btn.dataset.quizIdx);
      updateSimulation();
    });
  });

  const checkInput = document.getElementById("userCheckInput");
  const checkBtn = document.getElementById("runCheckBtn");
  if (checkInput && checkBtn && res.checkTarget) {
    checkInput.addEventListener("input", () => { state.checkInputVal = checkInput.value; });
    checkBtn.addEventListener("click", () => {
      const val = parseFloat(checkInput.value);
      if (Number.isNaN(val)) {
        state.checkFeedback = { ok: false, msg: "Lütfen sayısal bir değer girin." };
      } else {
        const exp = res.checkTarget.expected;
        const tol = Math.max(0.08, Math.abs(exp) * 0.05);
        const ok = Math.abs(val - exp) <= tol;
        state.checkFeedback = ok
          ? { ok: true, msg: `Doğru! Hesabın (${fmt(val)} ${res.checkTarget.unit}) beklenen sonuçla (${fmt(exp)} ${res.checkTarget.unit}) uyuşuyor.` }
          : { ok: false, msg: `Girdiğin değer (${fmt(val)} ${res.checkTarget.unit}), beklenen değerden (${fmt(exp)} ${res.checkTarget.unit}) farklı. Aşağıdaki KVL/KCL adımlarını inceleyebilirsin.` };
      }
      updateSimulation();
    });
  }

  const copyBtn = document.getElementById("copySpiceBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(lastSpiceText);
        showToast("SPICE netlist panoya kopyalandı!");
      } catch {
        showToast("Kopyalama için metni seçip Ctrl+C kullanabilirsiniz.");
      }
    });
  }

  const dlBtn = document.getElementById("downloadSpiceBtn");
  if (dlBtn) {
    dlBtn.addEventListener("click", () => {
      const blob = new Blob([lastSpiceText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${state.module}_${state.topology[state.module]}.cir`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(".cir SPICE dosyası indirildi!");
    });
  }
}

function updateSimulation() {
  const mKey = state.module;
  if (mKey === "m5") return;
  const topoId = state.topology[mKey];
  const params = state.params[mKey][topoId];
  const effectiveStep = state.showAllSteps ? 3 : state.currentStep;
  const res = SOLVERS[mKey](topoId, params, effectiveStep);
  lastSpiceText = res.spice;

  const badge = document.getElementById("circuitStatusBadge");
  badge.textContent = res.statusText;
  badge.className = `badge-tag ${res.statusTone}`;

  document.getElementById("schematicContainer").innerHTML = res.svg;

  // Stepper durumları
  document.querySelectorAll("#wizardStepper .step-pill").forEach((pill) => {
    const s = Number(pill.dataset.step);
    pill.classList.toggle("active", !state.showAllSteps && s === state.currentStep);
    pill.classList.toggle("done", state.showAllSteps || s < state.currentStep);
  });

  document.getElementById("toggleAllStepsBtn").textContent = state.showAllSteps ? "Adım Adım Moduna Dön" : "Tüm Adımları Göster";
  document.getElementById("prevStepBtn").disabled = state.showAllSteps || state.currentStep === 0;
  document.getElementById("nextStepBtn").disabled = state.showAllSteps || state.currentStep === 3;
  document.getElementById("stepCounterLabel").textContent = state.showAllSteps ? "Tüm Adımlar Açık" : `Adım ${state.currentStep + 1} / 4`;

  // Wizard stage render
  const stage = document.getElementById("wizardStage");
  if (state.showAllSteps) {
    stage.innerHTML = `
      <div class="method-intro">${res.intro}</div>
      ${renderQuizBlock(res.quiz)}
      ${res.steps.map((st, idx) => renderStepCard(st, idx + 1)).join("")}
      ${renderCheckBlock(res.checkTarget)}
      ${renderSummaryAndSpice(res)}
    `;
  } else if (state.currentStep === 0) {
    stage.innerHTML = `
      <div class="method-intro">${res.intro}</div>
      ${renderQuizBlock(res.quiz)}
      <p style="font-size:0.83rem; color:var(--text-muted);">
        Tahminini yaptıktan sonra <strong>"Sonraki Adım ▶"</strong> butonuna basarak eşdeğer devreyi ve kuralı görebilirsin.
      </p>
    `;
  } else if (state.currentStep === 1) {
    stage.innerHTML = `
      ${renderStepCard(res.steps[0], 1)}
      <p style="font-size:0.83rem; color:var(--text-muted);">
        Şema artık aktif durumu gösteriyor. Sayısal hesaplama ve kendi sonucunu test etmek için <strong>"Sonraki Adım ▶"</strong> butonuna geç.
      </p>
    `;
  } else if (state.currentStep === 2) {
    stage.innerHTML = `
      ${renderCheckBlock(res.checkTarget)}
      ${res.steps.slice(1).map((st, idx) => renderStepCard(st, idx + 2)).join("")}
    `;
  } else {
    stage.innerHTML = renderSummaryAndSpice(res);
  }

  bindWizardInteractions(res);

  // Plotlar
  const plots = res.plots || [];
  if (state.activePlotIdx >= plots.length) state.activePlotIdx = 0;
  const tabsEl = document.getElementById("plotTabs");
  tabsEl.innerHTML = plots.map((pl, i) => `
    <button class="plot-tab-btn ${i === state.activePlotIdx ? "active" : ""}" data-plot-idx="${i}">${pl.title.split(":")[0]}</button>
  `).join("");
  tabsEl.querySelectorAll("button").forEach((b) => {
    b.addEventListener("click", () => {
      state.activePlotIdx = Number(b.dataset.plotIdx);
      updateSimulation();
    });
  });

  if (plots[state.activePlotIdx]) {
    const activePlot = plots[state.activePlotIdx];
    document.getElementById("plotTitle").textContent = activePlot.title;
    drawAxesPlot(document.getElementById("mainCanvas"), activePlot.cfg, lastProbeX);
  }
}

function switchModule(mKey) {
  state.module = mKey;
  state.activePlotIdx = 0;
  lastProbeX = null;
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.module === mKey);
  });
  const simLayout = document.getElementById("simulatorLayout");
  const examLayout = document.getElementById("examLayout");
  if (mKey === "m5") {
    simLayout.style.display = "none";
    examLayout.style.display = "block";
    renderExamModule();
  } else {
    simLayout.style.display = "grid";
    examLayout.style.display = "none";
    buildControls();
    updateSimulation();
  }
}

function init() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentStep = 0;
      state.quizSelection = null;
      state.checkFeedback = null;
      switchModule(btn.dataset.module);
    });
  });

  document.getElementById("topologySelect").addEventListener("change", (e) => {
    state.topology[state.module] = e.target.value;
    state.activePlotIdx = 0;
    state.currentStep = 0;
    state.quizSelection = null;
    state.checkFeedback = null;
    buildControls();
    updateSimulation();
  });

  // Stepper & Wizard navigation
  document.querySelectorAll("#wizardStepper .step-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      state.showAllSteps = false;
      state.currentStep = Number(pill.dataset.step);
      updateSimulation();
    });
  });

  document.getElementById("prevStepBtn").addEventListener("click", () => {
    if (state.currentStep > 0) {
      state.currentStep -= 1;
      updateSimulation();
    }
  });

  document.getElementById("nextStepBtn").addEventListener("click", () => {
    if (state.currentStep < 3) {
      state.currentStep += 1;
      updateSimulation();
    }
  });

  document.getElementById("toggleAllStepsBtn").addEventListener("click", () => {
    state.showAllSteps = !state.showAllSteps;
    updateSimulation();
  });

  // Canvas Interactive Probe
  const canvas = document.getElementById("mainCanvas");
  canvas.addEventListener("mousemove", (e) => {
    if (!currentPlotCfg) return;
    const rect = canvas.getBoundingClientRect();
    const padL = 56, padR = 24;
    const pw = (rect.width || 680) - padL - padR;
    const relX = (e.clientX - rect.left - padL) / pw;
    if (relX >= 0 && relX <= 1) {
      lastProbeX = currentPlotCfg.xMin + relX * (currentPlotCfg.xMax - currentPlotCfg.xMin);
      drawAxesPlot(canvas, currentPlotCfg, lastProbeX);
    }
  });

  canvas.addEventListener("mouseleave", () => {
    lastProbeX = null;
    if (currentPlotCfg) drawAxesPlot(canvas, currentPlotCfg, null);
  });

  window.addEventListener("resize", () => {
    if (state.module !== "m5") updateSimulation();
  });

  switchModule("m1");
}

document.addEventListener("DOMContentLoaded", init);
