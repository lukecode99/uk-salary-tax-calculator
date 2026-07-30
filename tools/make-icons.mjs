/**
 * Regenerates assets/icon.png, assets/adaptive-icon.png and assets/splash.png.
 *
 * The brand mark is a £ in the app's own palette (see src/theme.ts): near-black
 * #0D0D0D on acid lime #BAFF29. Option "B" — black £ on a lime field — was
 * chosen by Luke on 30-Jul-2026 because a solid lime tile is the most legible
 * thing on a home screen full of dark icons.
 *
 * Run:  node tools/make-icons.mjs
 * Needs sharp. Nothing else in the project depends on it, so it is not a
 * dependency — install it ad hoc if you need to regenerate.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets');

const LIME = '#BAFF29';
const BLACK = '#0D0D0D';

/**
 * Renders a glyph on transparency and trims to its true ink bounds. Font
 * metrics include ascender/descender space that a single character does not
 * fill, so trimming is the only way to centre one accurately.
 */
async function glyph(char, colour) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600">
    <text x="800" y="1100" font-family="Liberation Sans" font-weight="bold"
          font-size="760" fill="${colour}" text-anchor="middle">${char}</text>
  </svg>`;
  const rendered = await sharp(Buffer.from(svg)).png().toBuffer();
  return sharp(rendered).trim().toBuffer({ resolveWithObject: true });
}

/** Scales the trimmed glyph so its larger side hits `target`, then centres it. */
async function compose({ width, height, background, mark, target, dy = 0, flatten = true }) {
  const scale = target / Math.max(mark.info.width, mark.info.height);
  const w = Math.round(mark.info.width * scale);
  const h = Math.round(mark.info.height * scale);
  const resized = await sharp(mark.data).resize(w, h).toBuffer();
  const out = await sharp({
    create: { width, height, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, left: Math.round((width - w) / 2), top: Math.round((height - h) / 2) + dy }])
    .png()
    .toBuffer();
  // sharp applies flatten before composite regardless of call order, so alpha
  // has to come off in a second pass. Apple rejects app icons carrying alpha.
  return flatten ? sharp(out).removeAlpha().png().toBuffer() : out;
}

const blackMark = await glyph('£', BLACK);
const limeMark = await glyph('£', LIME);

// App icon — black £ on lime, full bleed. No rounded corners: iOS masks these
// itself, and baking them in leaves dark fringes on the mask edge.
fs.writeFileSync(
  path.join(ASSETS, 'icon.png'),
  await compose({ width: 1024, height: 1024, background: LIME, mark: blackMark, target: 560 })
);

// Android adaptive icon — transparent foreground, lime supplied by
// `android.adaptiveIcon.backgroundColor` in app.json. The mark is kept small
// because launchers crop to a circle roughly 66% of the canvas.
fs.writeFileSync(
  path.join(ASSETS, 'adaptive-icon.png'),
  await compose({ width: 1024, height: 1024, background: null, mark: blackMark, target: 380, flatten: false })
);

// Splash — inverted, so the launch screen matches the app's dark chrome rather
// than flashing a full lime screen before a dark UI.
fs.writeFileSync(
  path.join(ASSETS, 'splash.png'),
  await compose({ width: 1242, height: 2436, background: BLACK, mark: limeMark, target: 380 })
);

for (const f of ['icon.png', 'adaptive-icon.png', 'splash.png']) {
  const m = await sharp(path.join(ASSETS, f)).metadata();
  console.log(`${f}  ${m.width}x${m.height}  alpha=${!!m.hasAlpha}`);
}
