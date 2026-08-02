const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

function createIcon(size) {
  const png = new PNG({ width: size, height: size });
  
  // Colors
  const bgR = 0x0A, bgG = 0x1F, bgB = 0x44; // #0A1F44 Navy
  const brandR = 0x00, brandG = 0xD1, brandB = 0x8F; // #00D18F Emerald Green
  const whiteR = 0xFF, whiteG = 0xFF, whiteB = 0xFF;

  const center = size / 2;
  const outerRadius = size * 0.42;
  const innerRadius = size * 0.32;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      
      // Default Navy background
      let r = bgR, g = bgG, b = bgB, a = 255;

      // Distance from center for rounded badge
      const dx = Math.abs(x - center);
      const dy = Math.abs(y - center);

      // Squircle / rounded box for brand icon badge
      const cornerRadius = size * 0.12;
      const boxHalf = size * 0.28;

      let isInsideBadge = false;
      let isBadgeBorder = false;

      if (dx <= boxHalf && dy <= boxHalf) {
        if (dx > boxHalf - cornerRadius && dy > boxHalf - cornerRadius) {
          const cx = dx - (boxHalf - cornerRadius);
          const cy = dy - (boxHalf - cornerRadius);
          const distSq = cx * cx + cy * cy;
          if (distSq <= cornerRadius * cornerRadius) {
            isInsideBadge = true;
            if (distSq >= (cornerRadius - size * 0.03) * (cornerRadius - size * 0.03)) {
              isBadgeBorder = true;
            }
          }
        } else {
          isInsideBadge = true;
          if (dx >= boxHalf - size * 0.03 || dy >= boxHalf - size * 0.03) {
            isBadgeBorder = true;
          }
        }
      }

      if (isInsideBadge) {
        if (isBadgeBorder) {
          r = brandR; g = brandG; b = brandB;
        } else {
          // Inside badge - dark navy background with green & white package drawing
          r = 0x08; g = 0x16; b = 0x30;

          // Draw package box in center
          const boxSize = size * 0.14;
          if (Math.abs(x - center) < boxSize && Math.abs(y - center) < boxSize) {
            const px = x - center;
            const py = y - center;
            
            // Package checkmark / diagonal lines pattern
            if (Math.abs(px + py) < size * 0.02 || Math.abs(px - py) < size * 0.02) {
              r = brandR; g = brandG; b = brandB;
            } else if (Math.abs(px) < size * 0.10 && Math.abs(py) < size * 0.10) {
              r = whiteR; g = whiteG; b = whiteB;
            }
          }
        }
      }

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  const buffer = PNG.sync.write(png);
  return buffer;
}

const publicDir = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createIcon(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createIcon(512));
fs.writeFileSync(path.join(publicDir, 'icon-maskable-192.png'), createIcon(192));
fs.writeFileSync(path.join(publicDir, 'icon-maskable-512.png'), createIcon(512));

console.log('Successfully generated clean 192x192, 512x512, and maskable PNG icons!');
