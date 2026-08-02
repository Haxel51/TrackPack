const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const publicDir = path.join(__dirname, '..', 'public');

// 1. Precise Vector SVG matching the user's logo (input_file_0.png)
// Dark Navy background (#081736), Teal Border (#085458), Mint Green Box & Checkmark (#00E699 / #00D18F)
const logoSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="squircleClip">
      <rect x="20" y="20" width="472" height="472" rx="100" ry="100"/>
    </clipPath>
  </defs>

  <!-- Dark Navy Squircle Background -->
  <rect x="20" y="20" width="472" height="472" rx="100" ry="100" fill="#081736"/>
  <!-- Teal Border Ring -->
  <rect x="20" y="20" width="472" height="472" rx="100" ry="100" fill="none" stroke="#085458" stroke-width="24"/>

  <!-- Mint Green Isometric Box with Checkmark -->
  <g fill="none" stroke="#00E699" stroke-width="26" stroke-linecap="round" stroke-linejoin="round">
    <!-- Outer Box Top Parallelogram -->
    <path d="M 256,135 L 350,185 L 256,235 L 162,185 Z" />
    
    <!-- Top Face Tape Lines -->
    <line x1="202" y1="162" x2="296" y2="212" stroke-width="22"/>
    <line x1="228" y1="148" x2="322" y2="198" stroke-width="22"/>

    <!-- Left Vertical Edge & Left Bottom Line -->
    <path d="M 162,185 L 162,310 L 256,360 L 256,235" />

    <!-- Right Side Connection & Integrated Checkmark -->
    <path d="M 350,185 L 350,230" />
    <path d="M 280,280 L 320,320 L 405,235" stroke-width="32" />
  </g>
</svg>`;

const maskableSvg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Full Bleed Background for Safe Zone -->
  <rect width="512" height="512" fill="#081736"/>
  
  <g transform="translate(25, 25) scale(0.9)">
    <rect x="20" y="20" width="472" height="472" rx="100" ry="100" fill="#081736"/>
    <rect x="20" y="20" width="472" height="472" rx="100" ry="100" fill="none" stroke="#085458" stroke-width="24"/>

    <g fill="none" stroke="#00E699" stroke-width="26" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 256,135 L 350,185 L 256,235 L 162,185 Z" />
      <line x1="202" y1="162" x2="296" y2="212" stroke-width="22"/>
      <line x1="228" y1="148" x2="322" y2="198" stroke-width="22"/>
      <path d="M 162,185 L 162,310 L 256,360 L 256,235" />
      <path d="M 350,185 L 350,230" />
      <path d="M 280,280 L 320,320 L 405,235" stroke-width="32" />
    </g>
  </g>
</svg>`;

const tmpLogo = path.join('/tmp', 'logo_exact.svg');
const tmpMaskable = path.join('/tmp', 'maskable_exact.svg');

fs.writeFileSync(tmpLogo, logoSvg);
fs.writeFileSync(tmpMaskable, maskableSvg);

// Export all required PWA icons
execSync(`ffmpeg -y -i ${tmpLogo} -s 512x512 ${path.join(publicDir, 'icon-512.png')}`);
execSync(`ffmpeg -y -i ${tmpLogo} -s 192x192 ${path.join(publicDir, 'icon-192.png')}`);
execSync(`ffmpeg -y -i ${tmpLogo} -s 512x512 ${path.join(publicDir, 'logo.png')}`);
execSync(`ffmpeg -y -i ${tmpLogo} -s 512x512 ${path.join(publicDir, 'logo_final_v4.jpg')}`);

execSync(`ffmpeg -y -i ${tmpMaskable} -s 512x512 ${path.join(publicDir, 'icon-maskable-512.png')}`);
execSync(`ffmpeg -y -i ${tmpMaskable} -s 192x192 ${path.join(publicDir, 'icon-maskable-192.png')}`);

fs.writeFileSync(path.join(publicDir, 'favicon.svg'), logoSvg);

console.log('Generated exact logo files matching user logo!');
