const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

function createMobileScreenshot() {
  const width = 1080;
  const height = 1920;
  const png = new PNG({ width, height });

  const bgR = 0x0A, bgG = 0x1F, bgB = 0x44; // #0A1F44 Navy
  const cardR = 0x13, cardG = 0x2A, cardB = 0x56; // Card bg
  const brandR = 0x00, brandG = 0xD1, brandB = 0x8F; // Emerald Green
  const whiteR = 0xFF, whiteG = 0xFF, whiteB = 0xFF;
  const grayR = 0x8A, grayG = 0x9B, grayB = 0xB5;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      let r = bgR, g = bgG, b = bgB, a = 255;

      // Header bar (0 <= y < 200)
      if (y < 200) {
        r = 0x08; g = 0x17; b = 0x35;
        // Brand line accent at bottom of header
        if (y >= 192 && y < 200) {
          r = brandR; g = brandG; b = brandB;
        }
        // Header title box simulation
        if (x >= 80 && x <= 450 && y >= 80 && y <= 130) {
          r = whiteR; g = whiteG; b = whiteB;
        }
      } 
      // Main Card 1 (Waybill Tracker Card: y between 260 and 660, x between 60 and 1020)
      else if (y >= 260 && y <= 660 && x >= 60 && x <= 1020) {
        r = cardR; g = cardG; b = cardB;
        // Card header accent
        if (y >= 260 && y <= 270) {
          r = brandR; g = brandG; b = brandB;
        }
        // Input box inside card (y 420-520, x 100-980)
        if (y >= 420 && y <= 520 && x >= 100 && x <= 980) {
          r = 0x08; g = 0x17; b = 0x35;
          if (x <= 110 || x >= 970 || y <= 425 || y >= 515) {
            r = grayR; g = grayG; b = grayB;
          }
        }
        // Button inside card (y 550-630, x 100-980)
        if (y >= 550 && y <= 630 && x >= 100 && x <= 980) {
          r = brandR; g = brandG; b = brandB;
        }
      }
      // Main Card 2 (Recent Parcels: y between 720 and 1720, x between 60 and 1020)
      else if (y >= 720 && y <= 1720 && x >= 60 && x <= 1020) {
        r = cardR; g = cardG; b = cardB;
        // List item rows
        const rowOffset = (y - 820);
        if (rowOffset > 0 && rowOffset < 850 && (rowOffset % 120) > 100) {
          r = 0x0A; g = 0x1F; b = 0x44; // divider line
        }
      }

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  return PNG.sync.write(png);
}

function createDesktopScreenshot() {
  const width = 1920;
  const height = 1080;
  const png = new PNG({ width, height });

  const bgR = 0x0A, bgG = 0x1F, bgB = 0x44;
  const sideR = 0x08, sideG = 0x17, sideB = 0x35;
  const cardR = 0x13, cardG = 0x2A, cardB = 0x56;
  const brandR = 0x00, brandG = 0xD1, brandB = 0x8F;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      let r = bgR, g = bgG, b = bgB, a = 255;

      // Sidebar (x < 360)
      if (x < 360) {
        r = sideR; g = sideG; b = sideB;
        if (x >= 354) {
          r = brandR; g = brandG; b = brandB;
        }
      } 
      // Top navbar (y < 100, x >= 360)
      else if (y < 100) {
        r = sideR; g = sideG; b = sideB;
      }
      // Main Content Grid Cards
      else {
        // Card 1
        if (x >= 420 && x <= 1100 && y >= 150 && y <= 550) {
          r = cardR; g = cardG; b = cardB;
        }
        // Card 2
        else if (x >= 1150 && x <= 1840 && y >= 150 && y <= 550) {
          r = cardR; g = cardG; b = cardB;
        }
        // Table Card
        else if (x >= 420 && x <= 1840 && y >= 600 && y <= 1020) {
          r = cardR; g = cardG; b = cardB;
        }
      }

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }

  return PNG.sync.write(png);
}

const publicDir = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(publicDir, 'screenshot-mobile.png'), createMobileScreenshot());
fs.writeFileSync(path.join(publicDir, 'screenshot-desktop.png'), createDesktopScreenshot());

console.log('Successfully generated clean valid PNG screenshots for PWA!');
