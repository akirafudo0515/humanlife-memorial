const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const src = path.join(__dirname, '..', 'public', 'room', 'flower-column.jpg');
const out = path.join(__dirname, '..', 'public', 'room', 'flower-column.png');

function classify(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const warm = r - b;
  const cool = b - r;

  // purple / violet blooms & ribbons
  if (b >= 55 && sat > 0.14 && (cool > -15 || b >= g) && b / (max + 1) > 0.32) return 'fg';
  // green leaves
  if (g > 55 && g >= r + 6 && g >= b + 4 && sat > 0.1) return 'fg';
  // white / cream flowers & marble column (cool-neutral bright)
  if (max > 168 && sat < 0.16 && warm < 42) return 'fg';
  if (max > 145 && sat < 0.22 && warm < 50 && Math.abs(r - g) < 28 && r > 125) return 'fg';
  // soft pink petal
  if (r > 150 && g > 120 && b > 110 && sat < 0.28 && warm < 55 && r - g < 45) return 'fg';
  // dark ribbon / stem cores
  if (max < 48 && sat < 0.55) return 'fg';

  // warm beige wood poles / paneling
  if (r > 125 && g > 105 && b > 70 && warm > 14 && sat > 0.07 && sat < 0.5 && r >= g - 4) return 'bg';
  // gray wall / floor
  if (max < 170 && sat < 0.12 && Math.abs(r - g) < 18 && Math.abs(g - b) < 18) return 'bg';
  if (r > 90 && g > 80 && b > 60 && sat < 0.18 && warm > 5 && warm < 40 && max < 175) return 'bg';

  return 'unk';
}

async function main() {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const label = new Uint8Array(width * height); // 0 unk, 1 fg, 2 bg

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const c = classify(data[i], data[i + 1], data[i + 2]);
      label[y * width + x] = c === 'fg' ? 1 : c === 'bg' ? 2 : 0;
    }
  }

  // hard wipe watermark / UI bands unless clearly flower purple/green/white
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const flowerish =
        (b > 70 && sat > 0.18) ||
        (g > r + 8 && g > b + 6) ||
        (max > 175 && sat < 0.14);
      if (x > width * 0.78 && !flowerish) label[y * width + x] = 2;
      if (y > height * 0.9 && x < width * 0.22) label[y * width + x] = 2;
      if (y > height * 0.93) label[y * width + x] = 2;
    }
  }

  // propagate bg / fg into uncertain via BFS
  const q = [];
  for (let i = 0; i < label.length; i += 1) {
    if (label[i] === 2 || label[i] === 1) q.push(i);
  }
  while (q.length) {
    const idx = q.pop();
    const cur = label[idx];
    const x = idx % width;
    const y = (idx - x) / width;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = ny * width + nx;
      if (label[n] !== 0) continue;
      // prefer bg when neighbor is bg; fg only if not wood-looking
      if (cur === 2) {
        label[n] = 2;
        q.push(n);
      } else if (cur === 1) {
        const i = n * 4;
        const c = classify(data[i], data[i + 1], data[i + 2]);
        if (c !== 'bg') {
          label[n] = 1;
          q.push(n);
        }
      }
    }
  }

  // remaining unk → bg
  for (let i = 0; i < label.length; i += 1) {
    if (label[i] === 0) label[i] = 2;
  }

  // keep only largest FG component (the column)
  const seen = new Uint8Array(width * height);
  let best = [];
  for (let start = 0; start < label.length; start += 1) {
    if (label[start] !== 1 || seen[start]) continue;
    const stack = [start];
    const comp = [];
    seen[start] = 1;
    while (stack.length) {
      const idx = stack.pop();
      comp.push(idx);
      const x = idx % width;
      const y = (idx - x) / width;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (seen[n] || label[n] !== 1) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (comp.length > best.length) best = comp;
  }
  const keep = new Uint8Array(width * height);
  for (const idx of best) keep[idx] = 1;

  // light dilate to recover thin ribbons/edges
  const dilate = new Uint8Array(keep);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (keep[y * width + x]) continue;
      let hit = 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (keep[(y + dy) * width + (x + dx)]) hit += 1;
      }
      if (!hit) continue;
      const i = (y * width + x) * 4;
      if (classify(data[i], data[i + 1], data[i + 2]) === 'fg') dilate[y * width + x] = 1;
    }
  }

  for (let i = 0; i < width * height; i += 1) {
    data[i * 4 + 3] = dilate[i] ? 255 : 0;
  }

  // soft fringe: lower alpha for near-bg edge pixels that look warm
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      if (!dilate[idx]) continue;
      let nearBg = 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (!dilate[(y + dy) * width + (x + dx)]) nearBg += 1;
      }
      if (!nearBg) continue;
      const i = idx * 4;
      if (classify(data[i], data[i + 1], data[i + 2]) === 'bg') data[i + 3] = 0;
      else if (nearBg >= 2) data[i + 3] = 200;
    }
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  await sharp(data, { raw: info })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toFile(out);

  console.log('wrote', out, fs.statSync(out).size, `${maxX - minX + 1}x${maxY - minY + 1}`, 'fg', best.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
