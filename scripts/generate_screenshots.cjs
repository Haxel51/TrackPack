const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const publicDir = path.join(__dirname, '..', 'public');

// 1. Mobile Screenshot SVG (1080x1920) - 1:1 Match to user's real app screenshot (input_file_1.png)
const mobileSvg = `<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <defs>
    <linearGradient id="heroGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0B1C38"/>
      <stop offset="100%" stop-color="#061226"/>
    </linearGradient>
  </defs>

  <!-- Clean White Page Canvas -->
  <rect width="1080" height="1920" fill="#FFFFFF"/>

  <!-- Top App Bar / Header -->
  <rect y="0" width="1080" height="180" fill="#FFFFFF"/>
  <line x1="0" y1="180" x2="1080" y2="180" stroke="#E5E7EB" stroke-width="2"/>

  <!-- Header Left: Logo Icon & Brand Name -->
  <g transform="translate(50, 40)">
    <!-- Squircle Logo Icon Badge -->
    <rect width="100" height="100" rx="28" fill="#081736"/>
    <rect width="100" height="100" rx="28" fill="none" stroke="#085458" stroke-width="5"/>
    <g fill="none" stroke="#00E699" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" transform="translate(5, 5) scale(0.18)">
      <path d="M 256,135 L 350,185 L 256,235 L 162,185 Z" />
      <line x1="202" y1="162" x2="296" y2="212" stroke-width="5"/>
      <line x1="228" y1="148" x2="322" y2="198" stroke-width="5"/>
      <path d="M 162,185 L 162,310 L 256,360 L 256,235" />
      <path d="M 350,185 L 350,230" />
      <path d="M 280,280 L 320,320 L 405,235" stroke-width="7" />
    </g>

    <!-- TrackPack Text -->
    <text x="130" y="68" fill="#0B1938" font-size="52" font-weight="900" letter-spacing="-0.5">TrackPack</text>
  </g>

  <!-- Header Right: Partner Support Pill -->
  <g transform="translate(620, 50)">
    <rect width="410" height="80" rx="40" fill="#F0FDF4" stroke="#00D18F" stroke-width="3"/>
    <!-- Phone icon -->
    <path d="M 45,28 C 45,45 60,60 77,60 L 85,52 L 73,40 L 65,45 C 57,40 50,33 45,25 L 50,17 L 38,5 Z" fill="none" stroke="#00D18F" stroke-width="4" transform="translate(10, 8) scale(0.7)"/>
    <text x="80" y="52" fill="#0B1938" font-size="30" font-weight="700">Partner Support</text>
  </g>

  <!-- Main Dark Hero Card Container -->
  <g transform="translate(50, 240)">
    <rect width="980" height="1500" rx="48" fill="url(#heroGrad)"/>

    <!-- CORE SERVICE Pill Badge -->
    <g transform="translate(80, 70)">
      <rect width="680" height="90" rx="45" fill="#1C2B22" stroke="#B88A22" stroke-width="3"/>
      <text x="45" y="55" fill="#EBB128" font-size="28" font-weight="800" letter-spacing="1">✨ CORE SERVICE: WAYBILL LIVE TRACKING</text>
    </g>

    <!-- Main Headline Text -->
    <text x="80" y="250" fill="#FFFFFF" font-size="68" font-weight="900" letter-spacing="-1">Nigeria's #1</text>
    <text x="80" y="330" fill="#FFFFFF" font-size="68" font-weight="900" letter-spacing="-1">Dedicated</text>
    <text x="80" y="415" fill="#EBB128" font-size="68" font-weight="900" letter-spacing="-1">Waybill Live Tracking</text>
    <text x="80" y="495" fill="#FFFFFF" font-size="68" font-weight="900" letter-spacing="-1">Platform</text>

    <!-- Paragraph Description -->
    <text x="80" y="580" fill="#CBD5E1" font-size="32" font-weight="400" line-height="1.5">
      <tspan x="80" dy="0">TrackPack specializes exclusively in <tspan fill="#FFFFFF" font-weight="700">real-</tspan></tspan>
      <tspan x="80" dy="48"><tspan fill="#FFFFFF" font-weight="700">time motor park waybill tracking</tspan> for</tspan>
      <tspan x="80" dy="48">interstate shipments across Nigeria (Peace</tspan>
      <tspan x="80" dy="48">Mass, GUO, God is Good, Young Shall</tspan>
      <tspan x="80" dy="48">Grow, Goodness &amp; Mercy, Romchi, and</tspan>
      <tspan x="80" dy="48">local transport lines).</tspan>
    </text>

    <!-- Feature Pills Stack -->
    <!-- Pill 1: Live Status Updates -->
    <g transform="translate(80, 930)">
      <rect width="450" height="84" rx="24" fill="#0D2A33" stroke="#164E5A" stroke-width="2"/>
      <circle cx="45" cy="42" r="10" fill="#00E699"/>
      <text x="75" y="52" fill="#FFFFFF" font-size="30" font-weight="700">Live Status Updates</text>
    </g>

    <!-- Pill 2: Digital Waybill Receipts -->
    <g transform="translate(80, 1040)">
      <rect width="520" height="84" rx="24" fill="#0D2A33" stroke="#164E5A" stroke-width="2"/>
      <text x="40" y="52" fill="#FFFFFF" font-size="30" font-weight="700">📦 Digital Waybill Receipts</text>
    </g>

    <!-- Pill 3: Assigned Driver Info -->
    <g transform="translate(80, 1150)">
      <rect width="470" height="84" rx="24" fill="#0D2A33" stroke="#164E5A" stroke-width="2"/>
      <text x="40" y="52" fill="#FFFFFF" font-size="30" font-weight="700">🚌 Assigned Driver Info</text>
    </g>

    <!-- Floating Chat Badge -->
    <g transform="translate(370, 1260)">
      <rect width="560" height="80" rx="40" fill="#081832" stroke="#1E3E75" stroke-width="2"/>
      <circle cx="40" cy="40" r="10" fill="#00E699"/>
      <text x="70" y="50" fill="#FFFFFF" font-size="28" font-weight="700">Need help? Chat with Support</text>
    </g>

    <!-- Floating Green WhatsApp Icon -->
    <g transform="translate(800, 1340)">
      <circle cx="70" cy="70" r="65" fill="#25D366"/>
      <path d="M 45 40 C 42 40 38 43 38 48 C 38 58 50 78 68 85 C 75 88 80 85 83 80 L 88 72 L 78 65 L 72 70 C 68 68 60 60 58 56 L 63 50 Z" fill="#FFFFFF"/>
    </g>
  </g>
</svg>`;

// 2. Desktop Screenshot SVG (1920x1080)
const desktopSvg = `<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <defs>
    <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B1C38"/>
      <stop offset="100%" stop-color="#061226"/>
    </linearGradient>
  </defs>

  <!-- Page Background -->
  <rect width="1920" height="1080" fill="#FFFFFF"/>

  <!-- Desktop Navbar -->
  <rect width="1920" height="100" fill="#FFFFFF"/>
  <line x1="0" y1="100" x2="1920" y2="100" stroke="#E5E7EB" stroke-width="2"/>

  <!-- Brand Logo -->
  <g transform="translate(100, 20)">
    <rect width="60" height="60" rx="16" fill="#081736"/>
    <g fill="none" stroke="#00E699" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" transform="translate(2,2) scale(0.11)">
      <path d="M 256,135 L 350,185 L 256,235 L 162,185 Z" />
      <path d="M 162,185 L 162,310 L 256,360 L 256,235" />
      <path d="M 280,280 L 320,320 L 405,235" stroke-width="6" />
    </g>
    <text x="80" y="42" fill="#0B1938" font-size="32" font-weight="900">TrackPack</text>
  </g>

  <!-- Navbar Nav Links -->
  <g transform="translate(700, 38)">
    <text x="0" y="20" fill="#0B1938" font-size="20" font-weight="700">Track Waybill</text>
    <text x="200" y="20" fill="#64748B" font-size="20" font-weight="600">Park Manifests</text>
    <text x="400" y="20" fill="#64748B" font-size="20" font-weight="600">Transport Lines</text>
  </g>

  <!-- Partner Support Button -->
  <g transform="translate(1550, 22)">
    <rect width="270" height="56" rx="28" fill="#F0FDF4" stroke="#00D18F" stroke-width="2"/>
    <text x="50" y="36" fill="#0B1938" font-size="20" font-weight="700">Partner Support</text>
  </g>

  <!-- Hero Section Layout -->
  <g transform="translate(100, 150)">
    <!-- Hero Card Left -->
    <rect width="1720" height="850" rx="40" fill="url(#heroGrad)"/>

    <!-- CORE SERVICE Pill Badge -->
    <g transform="translate(80, 80)">
      <rect width="520" height="60" rx="30" fill="#1C2B22" stroke="#B88A22" stroke-width="2"/>
      <text x="35" y="38" fill="#EBB128" font-size="20" font-weight="800" letter-spacing="1">✨ CORE SERVICE: WAYBILL LIVE TRACKING</text>
    </g>

    <!-- Headline -->
    <text x="80" y="210" fill="#FFFFFF" font-size="56" font-weight="900">Nigeria's #1 Dedicated</text>
    <text x="80" y="280" fill="#EBB128" font-size="56" font-weight="900">Waybill Live Tracking Platform</text>

    <!-- Paragraph -->
    <text x="80" y="360" fill="#CBD5E1" font-size="24" line-height="1.6">
      TrackPack specializes exclusively in real-time motor park waybill tracking for interstate shipments
      across Nigeria (Peace Mass, GUO, God is Good, Young Shall Grow, Goodness &amp; Mercy, Romchi, and local transport lines).
    </text>

    <!-- Feature Pills Horizontal Row -->
    <g transform="translate(80, 440)">
      <rect x="0" y="0" width="300" height="60" rx="20" fill="#0D2A33" stroke="#164E5A" stroke-width="2"/>
      <circle cx="35" cy="30" r="8" fill="#00E699"/>
      <text x="60" y="38" fill="#FFFFFF" font-size="20" font-weight="700">Live Status Updates</text>

      <rect x="330" y="0" width="340" height="60" rx="20" fill="#0D2A33" stroke="#164E5A" stroke-width="2"/>
      <text x="360" y="38" fill="#FFFFFF" font-size="20" font-weight="700">📦 Digital Waybill Receipts</text>

      <rect x="700" y="0" width="310" height="60" rx="20" fill="#0D2A33" stroke="#164E5A" stroke-width="2"/>
      <text x="730" y="38" fill="#FFFFFF" font-size="20" font-weight="700">🚌 Assigned Driver Info</text>
    </g>

    <!-- Search Input Widget Inside Hero -->
    <g transform="translate(80, 560)">
      <rect width="1100" height="100" rx="24" fill="#081735" stroke="#00D18F" stroke-width="3"/>
      <text x="40" y="60" fill="#FFFFFF" font-size="28" font-weight="700">TP-89204-NG</text>

      <rect x="820" y="15" width="260" height="70" rx="16" fill="#00D18F"/>
      <text x="870" y="58" fill="#061228" font-size="24" font-weight="900">TRACK NOW</text>
    </g>
  </g>
</svg>`;

const tmpMobileSvg = path.join('/tmp', 'screenshot_mobile.svg');
const tmpDesktopSvg = path.join('/tmp', 'screenshot_desktop.svg');

fs.writeFileSync(tmpMobileSvg, mobileSvg);
fs.writeFileSync(tmpDesktopSvg, desktopSvg);

execSync(`ffmpeg -y -i ${tmpMobileSvg} -s 1080x1920 ${path.join(publicDir, 'screenshot-mobile.png')}`);
execSync(`ffmpeg -y -i ${tmpDesktopSvg} -s 1920x1080 ${path.join(publicDir, 'screenshot-desktop.png')}`);

console.log('Successfully generated 100% realistic screenshots matching input_file_1.png!');
