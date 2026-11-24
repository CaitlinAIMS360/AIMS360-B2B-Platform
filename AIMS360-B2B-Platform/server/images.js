// Demo product pictures: a simple garment drawing in the colour's real hex.
// The live version will serve AIMS360 style images instead.
import { getProvider } from './aims360/index.js';

const shapes = {
  Activewear:
    'M150 70 C170 90 230 90 250 70 L300 95 L285 150 L255 140 L260 330 L140 330 L145 140 L115 150 L100 95 Z',
  Tops: 'M140 70 C165 95 235 95 260 70 L330 110 L305 175 L270 160 L270 340 L130 340 L130 160 L95 175 L70 110 Z',
  Dresses: 'M160 60 C180 80 220 80 240 60 L262 120 L245 160 L310 360 L90 360 L155 160 L138 120 Z',
  Bottoms: 'M130 60 L270 60 L285 360 L215 360 L200 150 L185 360 L115 360 Z',
  Accessories: 'M110 130 L290 130 L305 350 L95 350 Z M150 130 C150 60 250 60 250 130 L232 130 C232 82 168 82 168 130 Z'
};

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function styleShape(styleCode, colorCode) {
  const style = getProvider().getStyle(styleCode);
  const color = style?.colors.find((c) => c.color === colorCode);
  if (!style || !color) return null;
  // Activewear mixes tops and bottoms, so pick the drawing from the style name too.
  const bottom = /legging|short|trouser|jean|pant/i.test(style.description);
  return { d: bottom ? shapes.Bottoms : shapes[style.category] || shapes.Tops, hex: color.hex, light: luminance(color.hex) > 0.8, style, color };
}

export function styleImageSvg(styleCode, colorCode) {
  const shape = styleShape(styleCode, colorCode);
  if (!shape) return null;
  const { d, style, color } = shape;
  const stroke = shape.light ? '#b9b3c4' : 'rgba(0,0,0,0.2)';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 420" role="img" aria-label="${style.description} in ${color.colorDescription}">
  <ellipse cx="200" cy="385" rx="120" ry="10" fill="rgba(0,0,0,0.06)"/>
  <path d="${d}" fill="${color.hex}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" fill-rule="evenodd"/>
</svg>`;
}
