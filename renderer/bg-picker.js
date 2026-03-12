const previewEl = document.getElementById('preview');
const btnChoose = document.getElementById('btn-choose');

// Resolve a preset name to an absolute file URL and pathname using the document location.
// This avoids any dependency on window.picker.assetsDir().
function presetFileUrl(name) {
  return new URL(`../assets/${name}.png`, window.location.href).href;
}
function presetAbsPath(name) {
  return new URL(`../assets/${name}.png`, window.location.href).pathname;
}

// ── Color helpers ─────────────────────────────────────────────────────────────
function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6;
  }
  return [h, s, l];
}

function hslToHex(h, s, l) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const r = Math.round(hue(h + 1/3) * 255);
  const g = Math.round(hue(h)       * 255);
  const b = Math.round(hue(h - 1/3) * 255);
  return `#${[r,g,b].map(v => v.toString(16).padStart(2,'0')).join('')}`;
}

// ── Sample image center and derive themed text color ──────────────────────────
function updateColors(src) {
  const img = new Image();
  img.onload = () => {
    const size = 80;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, img.width * 0.25, img.height * 0.1, img.width * 0.5, img.height * 0.55, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    let r = 0, g = 0, b = 0, lum = 0;
    const px = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i+1]; b += data[i+2];
      lum += (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]) / 255;
    }
    r /= px; g /= px; b /= px; lum /= px;

    const [h, s] = rgbToHsl(r/255, g/255, b/255);
    const isDark = lum < 0.5;

    let textColor, glowRgb;
    if (isDark) {
      textColor = '#ffffff';
      glowRgb   = '0, 0, 0';
    } else {
      textColor = hslToHex(h, Math.min(1, s * 1.4 + 0.25), 0.18);
      glowRgb   = '255, 255, 255';
    }

    document.documentElement.style.setProperty('--text-color', textColor);
    document.documentElement.style.setProperty('--glow-rgb',   glowRgb);
  };
  img.src = src;
}

// ── Preview ───────────────────────────────────────────────────────────────────
function setPreview(fileUrl) {
  previewEl.style.backgroundImage = `url('${fileUrl}')`;
  updateColors(fileUrl);
}

function setSelected(absPath) {
  document.querySelectorAll('.thumb').forEach(el => {
    el.classList.toggle('selected', presetAbsPath(el.dataset.preset) === absPath);
  });
}

// ── Preset click handlers ─────────────────────────────────────────────────────
document.querySelectorAll('.thumb').forEach(el => {
  el.addEventListener('click', () => {
    const abs = presetAbsPath(el.dataset.preset);
    setSelected(abs);
    setPreview(presetFileUrl(el.dataset.preset));
    window.picker.select(abs);
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────
window.picker.onInit((currentPath) => {
  if (currentPath) {
    setPreview(`file://${currentPath.replace(/\\/g, '/')}`);
    setSelected(currentPath);
  } else {
    setPreview(presetFileUrl('bg-1'));
    setSelected(presetAbsPath('bg-1'));
  }
});

// ── Preview update after upload ───────────────────────────────────────────────
window.picker.onPreview((p) => {
  setPreview(`file://${p.replace(/\\/g, '/')}`);
  setSelected(p); // won't match any preset thumb, which is correct
});

// ── Buttons ───────────────────────────────────────────────────────────────────
btnChoose.addEventListener('click', () => window.picker.choose());
document.getElementById('btn-close').addEventListener('click', () => window.picker.close());
