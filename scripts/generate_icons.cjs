const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const publicDir = path.join(__dirname, '..', 'public');

// 1. Standard Logo SVG (512x512) - Exact match to TrackPack 3D Emerald Box on Navy Badge
const standardLogoSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B1D3A"/>
      <stop offset="100%" stop-color="#050E1E"/>
    </linearGradient>
    
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00E699"/>
      <stop offset="50%" stop-color="#00D18F"/>
      <stop offset="100%" stop-color="#00875A"/>
    </linearGradient>

    <linearGradient id="topFace" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00FFB2"/>
      <stop offset="100%" stop-color="#00D18F"/>
    </linearGradient>

    <linearGradient id="leftFace" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#00C483"/>
      <stop offset="100%" stop-color="#008A5B"/>
    </linearGradient>

    <linearGradient id="rightFace" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#00A870"/>
      <stop offset="100%" stop-color="#006642"/>
    </linearGradient>
  </defs>

  <!-- Background Squircle Badge -->
  <rect x="24" y="24" width="464" height="464" rx="120" ry="120" fill="url(#bgGrad)"/>
  <rect x="24" y="24" width="464" height="464" rx="120" ry="120" fill="none" stroke="url(#borderGrad)" stroke-width="16"/>

  <!-- 3D Package Container Group -->
  <g transform="translate(10, 10)">
    <!-- Top Face -->
    <path d="M 246,135 L 360,195 L 246,255 L 132,195 Z" fill="url(#topFace)"/>
    <path d="M 246,135 L 246,255" stroke="#050E1E" stroke-width="8" stroke-linecap="round"/>
    <path d="M 189,165 L 303,225" stroke="#050E1E" stroke-width="6" stroke-linecap="round"/>

    <!-- Left Face -->
    <path d="M 132,195 L 246,255 L 246,365 L 132,305 Z" fill="url(#leftFace)"/>

    <!-- Right Face -->
    <path d="M 246,255 L 360,195 L 360,305 L 246,365 Z" fill="url(#rightFace)"/>

    <!-- Bright Checkmark -->
    <path d="M 285,290 L 335,340 L 420,240" fill="none" stroke="#00FFB2" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 285,290 L 335,340 L 420,240" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
  </g>
</svg>`;

// 2. Maskable Icon SVG (full bleeds with safe zone padding)
const maskableLogoSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B1D3A"/>
      <stop offset="100%" stop-color="#050E1E"/>
    </linearGradient>

    <linearGradient id="topFace" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00FFB2"/>
      <stop offset="100%" stop-color="#00D18F"/>
    </linearGradient>

    <linearGradient id="leftFace" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#00C483"/>
      <stop offset="100%" stop-color="#008A5B"/>
    </linearGradient>

    <linearGradient id="rightFace" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#00A870"/>
      <stop offset="100%" stop-color="#006642"/>
    </linearGradient>
  </defs>

  <!-- Full Bleed Canvas for Maskable Safe Zone -->
  <rect width="512" height="512" fill="url(#bgGrad)"/>

  <!-- Scaled 3D Package Container inside 80% Safe Zone -->
  <g transform="translate(16, 16) scale(0.93)">
    <path d="M 246,135 L 360,195 L 246,255 L 132,195 Z" fill="url(#topFace)"/>
    <path d="M 246,135 L 246,255" stroke="#050E1E" stroke-width="8" stroke-linecap="round"/>
    <path d="M 189,165 L 303,225" stroke="#050E1E" stroke-width="6" stroke-linecap="round"/>

    <path d="M 132,195 L 246,255 L 246,365 L 132,305 Z" fill="url(#leftFace)"/>
    <path d="M 246,255 L 360,195 L 360,305 L 246,365 Z" fill="url(#rightFace)"/>

    <path d="M 285,290 L 335,340 L 420,240" fill="none" stroke="#00FFB2" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 285,290 L 335,340 L 420,240" fill="none" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
  </g>
</svg>`;

const tmpSvg512 = path.join('/tmp', 'logo_512.svg');
const tmpSvgMaskable = path.join('/tmp', 'logo_maskable.svg');

fs.writeFileSync(tmpSvg512, standardLogoSvg);
fs.writeFileSync(tmpSvgMaskable, maskableLogoSvg);

// Generate standard PNGs
execSync(`ffmpeg -y -i ${tmpSvg512} -s 512x512 ${path.join(publicDir, 'icon-512.png')}`);
execSync(`ffmpeg -y -i ${tmpSvg512} -s 192x192 ${path.join(publicDir, 'icon-192.png')}`);
execSync(`ffmpeg -y -i ${tmpSvg512} -s 512x512 ${path.join(publicDir, 'logo.png')}`);
execSync(`ffmpeg -y -i ${tmpSvg512} -s 512x512 ${path.join(publicDir, 'logo_final_v4.jpg')}`);

// Generate maskable PNGs
execSync(`ffmpeg -y -i ${tmpSvgMaskable} -s 512x512 ${path.join(publicDir, 'icon-maskable-512.png')}`);
execSync(`ffmpeg -y -i ${tmpSvgMaskable} -s 192x192 ${path.join(publicDir, 'icon-maskable-192.png')}`);

// Save favicon.svg
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), standardLogoSvg);

console.log('Successfully generated TrackPack logo icons in all sizes!');
