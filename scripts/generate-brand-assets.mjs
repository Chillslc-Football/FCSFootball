import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '..', 'assets');

const NAVY = '#081B36';
const GOLD = '#D8B14B';
const WHITE = '#FFFFFF';

/** Shared football + pulse mark (viewBox 0 0 200 200). */
function pulseMarkSvg({ footballFill = WHITE, arcStroke = GOLD, laceFill = NAVY }) {
  return `
    <g transform="translate(100 100) rotate(-35)">
      <ellipse cx="0" cy="0" rx="52" ry="34" fill="${footballFill}" />
      <rect x="-4" y="-18" width="8" height="36" rx="2" fill="${laceFill}" />
      <rect x="-10" y="-12" width="20" height="3.5" rx="1" fill="${laceFill}" />
      <rect x="-10" y="-4" width="20" height="3.5" rx="1" fill="${laceFill}" />
      <rect x="-10" y="4" width="20" height="3.5" rx="1" fill="${laceFill}" />
      <rect x="-10" y="12" width="20" height="3.5" rx="1" fill="${laceFill}" />
      <path d="M 34 -8 Q 44 -2 34 8" fill="none" stroke="${laceFill}" stroke-width="2.5" stroke-linecap="round" />
    </g>
    <g fill="none" stroke="${arcStroke}" stroke-width="3.2" stroke-linecap="round">
      <path d="M 58 52 C 78 34, 98 34, 118 52" />
      <path d="M 50 44 C 78 18, 106 18, 134 44" />
      <path d="M 42 36 C 78 2, 114 2, 150 36" />
      <path d="M 142 148 C 122 166, 102 166, 82 148" />
      <path d="M 150 156 C 122 182, 94 182, 66 156" />
      <path d="M 158 164 C 122 198, 86 198, 50 164" />
    </g>
  `;
}

function iconSvg(size) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${NAVY}" />
      <svg x="${size * 0.18}" y="${size * 0.18}" width="${size * 0.64}" height="${size * 0.64}" viewBox="0 0 200 200">
        ${pulseMarkSvg({})}
      </svg>
    </svg>
  `;
}

function adaptiveForegroundSvg(size) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <svg x="${size * 0.17}" y="${size * 0.17}" width="${size * 0.66}" height="${size * 0.66}" viewBox="0 0 200 200">
        ${pulseMarkSvg({})}
      </svg>
    </svg>
  `;
}

function adaptiveMonochromeSvg(size) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${WHITE}" />
      <svg x="${size * 0.17}" y="${size * 0.17}" width="${size * 0.66}" height="${size * 0.66}" viewBox="0 0 200 200">
        ${pulseMarkSvg({ footballFill: NAVY, arcStroke: NAVY, laceFill: WHITE })}
      </svg>
    </svg>
  `;
}

function ekgLineSvg(width) {
  const mid = width / 2;
  const h = 24;
  return `
    <svg width="${width}" height="${h}" viewBox="0 0 ${width} ${h}" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M 0 ${h / 2} L ${mid - 72} ${h / 2} L ${mid - 52} ${h / 2} L ${mid - 40} ${h - 2} L ${mid - 24} 2 L ${mid - 8} ${h - 2} L ${mid + 8} ${h / 2} L ${mid + 52} ${h / 2} L ${width} ${h / 2}"
        fill="none"
        stroke="${GOLD}"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `;
}

function splashSvg(width, height) {
  const markSize = Math.round(Math.min(width, height) * 0.22);
  const fcsSize = Math.round(width * 0.19);
  const pulseSize = Math.round(width * 0.155);
  const tagSize = Math.round(width * 0.034);
  const lineWidth = Math.round(width * 0.52);
  const centerX = width / 2;
  const markY = Math.round(height * 0.27);
  const fcsY = markY + markSize + Math.round(height * 0.05);
  const pulseY = fcsY + Math.round(fcsSize * 1.05);
  const lineY = pulseY + Math.round(pulseSize * 0.85);
  const tagY = lineY + Math.round(height * 0.055);

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${NAVY}" />
      <svg x="${centerX - markSize / 2}" y="${markY - markSize / 2}" width="${markSize}" height="${markSize}" viewBox="0 0 200 200">
        ${pulseMarkSvg({})}
      </svg>
      <text
        x="${centerX}"
        y="${fcsY}"
        text-anchor="middle"
        fill="${WHITE}"
        font-family="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
        font-style="italic"
        font-weight="900"
        font-size="${fcsSize}px"
        letter-spacing="2"
      >FCS</text>
      <text
        x="${centerX}"
        y="${pulseY}"
        text-anchor="middle"
        fill="${GOLD}"
        font-family="'Arial Black', 'Helvetica Neue', Arial, sans-serif"
        font-style="italic"
        font-weight="900"
        font-size="${pulseSize}px"
        letter-spacing="4"
      >PULSE</text>
      <svg x="${centerX - lineWidth / 2}" y="${lineY}" width="${lineWidth}" height="24">
        ${ekgLineSvg(lineWidth)}
      </svg>
      <text
        x="${centerX}"
        y="${tagY}"
        text-anchor="middle"
        fill="${GOLD}"
        font-family="'Helvetica Neue', Arial, sans-serif"
        font-weight="600"
        font-size="${tagSize}px"
        letter-spacing="3"
      >THE PULSE OF FCS FOOTBALL</text>
    </svg>
  `;
}

async function writeSvgPng(svg, outputPath, width, height) {
  await sharp(Buffer.from(svg)).resize(width, height).png().toFile(outputPath);
}

async function main() {
  await writeSvgPng(iconSvg(1024), path.join(assetsDir, 'icon.png'), 1024, 1024);
  await writeSvgPng(
    adaptiveForegroundSvg(1024),
    path.join(assetsDir, 'adaptive-icon.png'),
    1024,
    1024,
  );
  await writeSvgPng(
    adaptiveMonochromeSvg(1024),
    path.join(assetsDir, 'adaptive-icon-monochrome.png'),
    1024,
    1024,
  );
  await writeSvgPng(splashSvg(1284, 2778), path.join(assetsDir, 'splash.png'), 1284, 2778);
  await sharp(path.join(assetsDir, 'icon.png')).resize(48, 48).png().toFile(path.join(assetsDir, 'favicon.png'));

  console.log('Generated brand assets in assets/');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
