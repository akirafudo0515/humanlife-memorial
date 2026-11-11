const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const out = path.join(__dirname, '..', 'public', 'room', 'flower-column.png');

function whiteBloom(cx, cy, s = 1) {
  const r = (n) => n * s;
  return `
    <circle cx="${cx}" cy="${cy - r(12)}" r="${r(15)}" fill="#fffef9"/>
    <circle cx="${cx + r(13)}" cy="${cy + r(2)}" r="${r(14)}" fill="#f8f4ec"/>
    <circle cx="${cx - r(13)}" cy="${cy + r(2)}" r="${r(14)}" fill="#f7f3eb"/>
    <circle cx="${cx + r(7)}" cy="${cy + r(14)}" r="${r(12)}" fill="#f3eee4"/>
    <circle cx="${cx - r(7)}" cy="${cy + r(14)}" r="${r(12)}" fill="#f5f0e7"/>
    <circle cx="${cx}" cy="${cy + r(2)}" r="${r(6)}" fill="#f0e2a8"/>
    <circle cx="${cx}" cy="${cy + r(2)}" r="${r(2.8)}" fill="#c9a84a"/>
  `;
}

function purpleBloom(cx, cy, s = 1) {
  const r = (n) => n * s;
  return `
    <circle cx="${cx}" cy="${cy - r(10)}" r="${r(12)}" fill="#5c3d86"/>
    <circle cx="${cx + r(11)}" cy="${cy + r(1)}" r="${r(11)}" fill="#4a2f6e"/>
    <circle cx="${cx - r(11)}" cy="${cy + r(1)}" r="${r(11)}" fill="#3f275f"/>
    <circle cx="${cx + r(6)}" cy="${cy + r(11)}" r="${r(10)}" fill="#34204f"/>
    <circle cx="${cx - r(6)}" cy="${cy + r(11)}" r="${r(10)}" fill="#2c1845"/>
    <circle cx="${cx}" cy="${cy + r(2)}" r="${r(4.5)}" fill="#1d1030"/>
  `;
}

function orchid(cx, cy, rot = 0, s = 1) {
  const r = (n) => n * s;
  return `
    <g transform="translate(${cx} ${cy}) rotate(${rot})">
      <ellipse cx="0" cy="0" rx="${r(22)}" ry="${r(9)}" fill="#fffdf8"/>
      <ellipse cx="${r(-9)}" cy="${r(-9)}" rx="${r(9)}" ry="${r(16)}" fill="#f8f3ea" transform="rotate(-28)"/>
      <ellipse cx="${r(9)}" cy="${r(-9)}" rx="${r(9)}" ry="${r(16)}" fill="#f6f1e7" transform="rotate(28)"/>
      <circle cx="0" cy="${r(2)}" r="${r(4.5)}" fill="#f0d5e4"/>
      <circle cx="0" cy="${r(2)}" r="${r(2.2)}" fill="#c27a98"/>
    </g>
  `;
}

function lily(cx, cy, rot = 0, s = 1) {
  const r = (n) => n * s;
  return `
    <g transform="translate(${cx} ${cy}) rotate(${rot})">
      <ellipse cx="0" cy="${r(-18)}" rx="${r(8)}" ry="${r(22)}" fill="#fffef9"/>
      <ellipse cx="${r(17)}" cy="${r(5)}" rx="${r(8)}" ry="${r(22)}" fill="#f7f2e9" transform="rotate(72)"/>
      <ellipse cx="${r(-17)}" cy="${r(5)}" rx="${r(8)}" ry="${r(22)}" fill="#f4efe5" transform="rotate(-72)"/>
      <circle cx="0" cy="0" r="${r(5)}" fill="#efe3ad"/>
      <circle cx="0" cy="0" r="${r(2.4)}" fill="#6d8f45"/>
    </g>
  `;
}

function leaf(cx, cy, rot, rx, ry) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#4f7a3f" transform="rotate(${rot} ${cx} ${cy})"/>`;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="980" viewBox="0 0 420 980">
  <defs>
    <linearGradient id="col" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#d2ccc2"/>
      <stop offset="20%" stop-color="#f4f0e8"/>
      <stop offset="50%" stop-color="#ffffff"/>
      <stop offset="80%" stop-color="#efe9df"/>
      <stop offset="100%" stop-color="#c8c0b4"/>
    </linearGradient>
    <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5f0e6"/>
      <stop offset="100%" stop-color="#c4baaa"/>
    </linearGradient>
    <linearGradient id="ribbonP" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#63428f"/>
      <stop offset="100%" stop-color="#2a1744"/>
    </linearGradient>
    <linearGradient id="ribbonC" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f8f2e5"/>
      <stop offset="100%" stop-color="#d6c8ae"/>
    </linearGradient>
  </defs>

  <!-- ribbons -->
  <path d="M160 318 C145 410 140 500 148 600 C154 670 142 740 136 820" fill="none" stroke="url(#ribbonP)" stroke-width="11" stroke-linecap="round"/>
  <path d="M190 325 C204 420 210 510 198 610 C190 685 204 755 210 835" fill="none" stroke="url(#ribbonC)" stroke-width="9" stroke-linecap="round"/>
  <path d="M250 315 C272 415 280 510 264 615 C254 690 272 760 278 840" fill="none" stroke="url(#ribbonP)" stroke-width="12" stroke-linecap="round"/>
  <path d="M288 328 C308 420 314 515 300 615 C292 685 306 760 312 845" fill="none" stroke="url(#ribbonC)" stroke-width="8" stroke-linecap="round"/>

  <!-- column -->
  <rect x="168" y="355" width="84" height="525" rx="5" fill="url(#col)"/>
  <g opacity="0.28" stroke="#8f8678" stroke-width="2.2">
    <line x1="179" y1="362" x2="179" y2="872"/>
    <line x1="191" y1="362" x2="191" y2="872"/>
    <line x1="203" y1="362" x2="203" y2="872"/>
    <line x1="215" y1="362" x2="215" y2="872"/>
    <line x1="227" y1="362" x2="227" y2="872"/>
    <line x1="239" y1="362" x2="239" y2="872"/>
  </g>
  <path d="M150 345 h120 l-12 24 H162 z" fill="url(#base)"/>
  <ellipse cx="164" cy="343" rx="17" ry="9" fill="#f8f4ec"/>
  <ellipse cx="256" cy="343" rx="17" ry="9" fill="#f8f4ec"/>
  <rect x="158" y="326" width="104" height="20" rx="4" fill="#f2ede3"/>
  <rect x="146" y="868" width="128" height="18" rx="3" fill="url(#base)"/>
  <rect x="132" y="886" width="156" height="22" rx="4" fill="url(#base)"/>
  <rect x="118" y="908" width="184" height="30" rx="4" fill="#b3a898"/>

  <!-- leaves -->
  ${leaf(105, 215, -38, 56, 26)}
  ${leaf(318, 205, 32, 60, 28)}
  ${leaf(88, 275, -20, 50, 23)}
  ${leaf(335, 270, 18, 52, 24)}
  ${leaf(135, 148, -48, 38, 17)}
  ${leaf(285, 142, 46, 40, 18)}
  ${leaf(210, 118, -6, 46, 15)}
  ${leaf(170, 300, -12, 34, 14)}
  ${leaf(260, 298, 14, 36, 15)}

  <!-- purple -->
  ${purpleBloom(148, 198, 1.05)}
  ${purpleBloom(252, 182, 0.95)}
  ${purpleBloom(198, 248, 1.12)}
  ${purpleBloom(285, 242, 0.88)}
  ${purpleBloom(120, 252, 0.82)}
  ${purpleBloom(222, 152, 0.78)}
  ${purpleBloom(310, 215, 0.72)}
  ${purpleBloom(168, 268, 0.7)}

  <!-- white blooms -->
  ${whiteBloom(178, 172, 1.15)}
  ${whiteBloom(232, 190, 1.02)}
  ${whiteBloom(158, 230, 0.92)}
  ${whiteBloom(262, 218, 0.96)}
  ${whiteBloom(205, 216, 0.88)}
  ${whiteBloom(128, 208, 0.8)}
  ${whiteBloom(302, 228, 0.78)}
  ${whiteBloom(175, 278, 0.72)}
  ${whiteBloom(245, 272, 0.74)}
  ${whiteBloom(210, 178, 0.7)}
  ${whiteBloom(190, 130, 0.68)}

  <!-- orchids -->
  ${orchid(142, 305, -28, 1.05)}
  ${orchid(172, 328, -12, 0.95)}
  ${orchid(258, 312, 20, 1)}
  ${orchid(288, 338, 30, 0.9)}
  ${orchid(210, 318, 4, 0.82)}

  <!-- lilies -->
  ${lily(200, 140, 0, 1.08)}
  ${lily(152, 162, -22, 0.86)}
  ${lily(258, 156, 18, 0.9)}
</svg>`;

async function main() {
  await sharp(Buffer.from(svg)).png().toFile(out);
  console.log('wrote', out, fs.statSync(out).size);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
