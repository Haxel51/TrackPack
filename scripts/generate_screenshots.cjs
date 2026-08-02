const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const publicDir = path.join(__dirname, '..', 'public');

// 1. Mobile Screenshot SVG (1080x1920) - High Contrast & Large Legible Text
const mobileSvg = `<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0A1F44"/>
      <stop offset="100%" stop-color="#050E1E"/>
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#122B59"/>
      <stop offset="100%" stop-color="#0E2145"/>
    </linearGradient>
    <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00E699"/>
      <stop offset="100%" stop-color="#00B87A"/>
    </linearGradient>
  </defs>

  <!-- Canvas Background -->
  <rect width="1080" height="1920" fill="url(#bgGrad)"/>

  <!-- Top Header Bar -->
  <rect width="1080" height="200" fill="#06142E"/>
  <line x1="0" y1="200" x2="1080" y2="200" stroke="#00D18F" stroke-width="6"/>

  <!-- Header Branding -->
  <g transform="translate(60, 40)">
    <!-- 3D Box Logo -->
    <rect x="0" y="0" width="110" height="110" rx="24" fill="#0A1F44" stroke="#00D18F" stroke-width="5"/>
    <path d="M 55,25 L 85,40 L 55,55 L 25,40 Z" fill="#00FFB2"/>
    <path d="M 25,40 L 55,55 L 55,85 L 25,70 Z" fill="#00C483"/>
    <path d="M 55,55 L 85,40 L 85,70 L 55,85 Z" fill="#008A5B"/>
    <path d="M 62,52 L 72,62 L 90,40" fill="none" stroke="#00FFB2" stroke-width="8" stroke-linecap="round"/>

    <!-- App Title Text -->
    <text x="140" y="62" fill="#FFFFFF" font-size="52" font-weight="900" letter-spacing="1">TrackPack</text>
    <text x="140" y="100" fill="#00FFB2" font-size="28" font-weight="800" letter-spacing="2">WAYBILL LIVE TRACKING</text>
  </g>

  <!-- Hero Banner Card -->
  <g transform="translate(60, 250)">
    <rect width="960" height="420" rx="36" fill="url(#cardGrad)" stroke="#1E3E75" stroke-width="3"/>
    
    <rect x="50" y="45" width="480" height="44" rx="22" fill="#FFB800" opacity="0.2"/>
    <text x="75" y="75" fill="#FFB800" font-size="24" font-weight="800">⚡ MOTOR PARK WAYBILL SYSTEM</text>

    <text x="50" y="145" fill="#FFFFFF" font-size="44" font-weight="900">Track Your Motor Park</text>
    <text x="50" y="195" fill="#00FFB2" font-size="44" font-weight="900">Waybill Shipment</text>

    <!-- Search Input Box -->
    <rect x="50" y="240" width="860" height="120" rx="24" fill="#081735" stroke="#00D18F" stroke-width="4"/>
    <text x="90" y="312" fill="#FFFFFF" font-size="38" font-weight="700">TP-89204-NG</text>

    <!-- Track Button -->
    <rect x="640" y="252" width="250" height="96" rx="20" fill="url(#brandGrad)"/>
    <text x="705" y="312" fill="#061228" font-size="32" font-weight="900">TRACK</text>
  </g>

  <!-- Active Tracking Result Card -->
  <g transform="translate(60, 710)">
    <rect width="960" height="960" rx="36" fill="url(#cardGrad)" stroke="#1E3E75" stroke-width="3"/>

    <!-- Status Header -->
    <text x="50" y="75" fill="#8A9BB5" font-size="26" font-weight="700">WAYBILL CODE</text>
    <text x="50" y="130" fill="#FFFFFF" font-size="52" font-weight="900">#TP-89204-NG</text>

    <!-- Status Badge -->
    <rect x="650" y="60" width="260" height="70" rx="35" fill="#00D18F" opacity="0.25"/>
    <rect x="650" y="60" width="260" height="70" rx="35" fill="none" stroke="#00FFB2" stroke-width="3"/>
    <circle cx="690" cy="95" r="12" fill="#00FFB2"/>
    <text x="715" y="105" fill="#00FFB2" font-size="28" font-weight="900">IN TRANSIT</text>

    <!-- Route Badge -->
    <rect x="50" y="170" width="860" height="180" rx="24" fill="#081735"/>
    <text x="90" y="230" fill="#8A9BB5" font-size="26">DISPATCH FROM</text>
    <text x="90" y="280" fill="#FFFFFF" font-size="36" font-weight="800">Lagos (Jibowu Park)</text>

    <text x="530" y="230" fill="#8A9BB5" font-size="26">DESTINATION</text>
    <text x="530" y="280" fill="#FFFFFF" font-size="36" font-weight="800">Abuja (Utako Park)</text>

    <line x1="50" y1="380" x2="910" y2="380" stroke="#1E3E75" stroke-width="3"/>

    <!-- Timeline Heading -->
    <text x="50" y="440" fill="#FFFFFF" font-size="36" font-weight="800">Waybill Live Timeline</text>

    <!-- Timeline Step 1 -->
    <circle cx="90" cy="530" r="24" fill="#00D18F"/>
    <path d="M 80,530 L 88,538 L 100,522" fill="none" stroke="#061228" stroke-width="5" stroke-linecap="round"/>
    <line x1="90" y1="554" x2="90" y2="640" stroke="#00D18F" stroke-width="8"/>
    <text x="140" y="525" fill="#FFFFFF" font-size="32" font-weight="800">Waybill Registered &amp; Received</text>
    <text x="140" y="565" fill="#8A9BB5" font-size="26">Jibowu Park, Lagos • 08:30 AM</text>

    <!-- Timeline Step 2 -->
    <circle cx="90" cy="670" r="24" fill="#00D18F"/>
    <path d="M 80,670 L 88,678 L 100,662" fill="none" stroke="#061228" stroke-width="5" stroke-linecap="round"/>
    <line x1="90" y1="694" x2="90" y2="780" stroke="#00D18F" stroke-width="8"/>
    <text x="140" y="665" fill="#FFFFFF" font-size="32" font-weight="800">Dispatched in Bus #104</text>
    <text x="140" y="705" fill="#8A9BB5" font-size="26">GUO Transport Line • 09:45 AM</text>

    <!-- Timeline Step 3 (Active) -->
    <circle cx="90" cy="810" r="28" fill="#00FFB2"/>
    <circle cx="90" cy="810" r="12" fill="#061228"/>
    <text x="140" y="805" fill="#00FFB2" font-size="32" font-weight="900">In Transit - Lokoja Express</text>
    <text x="140" y="845" fill="#8A9BB5" font-size="26">On Route to Abuja • ETA 04:30 PM</text>
  </g>

  <!-- Bottom Navigation Bar -->
  <rect y="1710" width="1080" height="210" fill="#06142E"/>
  <line x1="0" y1="1710" x2="1080" y2="1710" stroke="#1E3E75" stroke-width="3"/>
  <text x="270" y="1810" fill="#00FFB2" font-size="36" font-weight="800" text-anchor="middle">TRACK</text>
  <text x="810" y="1810" fill="#8A9BB5" font-size="36" font-weight="700" text-anchor="middle">PARKS &amp; MANIFESTS</text>
</svg>`;

// 2. Desktop Screenshot SVG (1920x1080)
const desktopSvg = `<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0A1F44"/>
      <stop offset="100%" stop-color="#050E1E"/>
    </linearGradient>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#122B59"/>
      <stop offset="100%" stop-color="#0E2145"/>
    </linearGradient>
    <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00E699"/>
      <stop offset="100%" stop-color="#00B87A"/>
    </linearGradient>
  </defs>

  <rect width="1920" height="1080" fill="url(#bgGrad)"/>

  <!-- Left Sidebar -->
  <rect width="360" height="1080" fill="#06142E"/>
  <line x1="360" y1="0" x2="360" y2="1080" stroke="#1E3E75" stroke-width="3"/>

  <g transform="translate(30, 45)">
    <rect x="0" y="0" width="70" height="70" rx="16" fill="#0A1F44" stroke="#00D18F" stroke-width="4"/>
    <path d="M 35,14 L 56,26 L 35,38 L 14,26 Z" fill="#00FFB2"/>
    <path d="M 14,26 L 35,38 L 35,56 L 14,44 Z" fill="#00C483"/>
    <path d="M 35,38 L 56,26 L 56,44 L 35,56 Z" fill="#008A5B"/>
    <path d="M 40,36 L 47,43 L 58,29" fill="none" stroke="#00FFB2" stroke-width="5" stroke-linecap="round"/>

    <text x="95" y="44" fill="#FFFFFF" font-size="34" font-weight="900">TrackPack</text>
    <text x="95" y="68" fill="#00FFB2" font-size="16" font-weight="800" letter-spacing="2">MOTOR PARK WAYBILL</text>
  </g>

  <!-- Sidebar Menu -->
  <g transform="translate(24, 160)">
    <rect x="0" y="0" width="312" height="60" rx="16" fill="#00D18F" opacity="0.2"/>
    <rect x="0" y="0" width="8" height="60" rx="4" fill="#00FFB2"/>
    <text x="65" y="38" fill="#00FFB2" font-size="22" font-weight="800">Waybill Tracker</text>

    <text x="65" y="115" fill="#8A9BB5" font-size="22" font-weight="700">Park Manifests</text>
    <text x="65" y="185" fill="#8A9BB5" font-size="22" font-weight="700">Motor Parks Directory</text>
    <text x="65" y="255" fill="#8A9BB5" font-size="22" font-weight="700">Analytics &amp; Revenue</text>
  </g>

  <!-- Top Header Bar -->
  <g transform="translate(360, 0)">
    <rect width="1560" height="100" fill="#081735"/>
    <line x1="0" y1="100" x2="1560" y2="100" stroke="#1E3E75" stroke-width="2"/>

    <text x="60" y="60" fill="#FFFFFF" font-size="32" font-weight="800">Nigeria Motor Park Waybill Dashboard</text>
  </g>

  <!-- Main Content -->
  <g transform="translate(420, 140)">
    <!-- Metrics Row -->
    <rect x="0" y="0" width="440" height="140" rx="24" fill="url(#cardGrad)" stroke="#1E3E75" stroke-width="2"/>
    <text x="35" y="45" fill="#8A9BB5" font-size="18" font-weight="700">TOTAL WAYBILLS TODAY</text>
    <text x="35" y="95" fill="#FFFFFF" font-size="44" font-weight="900">1,482</text>

    <rect x="480" y="0" width="440" height="140" rx="24" fill="url(#cardGrad)" stroke="#1E3E75" stroke-width="2"/>
    <text x="515" y="45" fill="#8A9BB5" font-size="18" font-weight="700">IN TRANSIT PARCELS</text>
    <text x="515" y="95" fill="#00FFB2" font-size="44" font-weight="900">342</text>

    <rect x="960" y="0" width="480" height="140" rx="24" fill="url(#cardGrad)" stroke="#1E3E75" stroke-width="2"/>
    <text x="995" y="45" fill="#8A9BB5" font-size="18" font-weight="700">DELIVERED &amp; CLAIMED</text>
    <text x="995" y="95" fill="#FFFFFF" font-size="44" font-weight="900">1,140</text>

    <!-- Main Waybill Table -->
    <g transform="translate(0, 180)">
      <rect width="1440" height="700" rx="28" fill="url(#cardGrad)" stroke="#1E3E75" stroke-width="2"/>

      <text x="50" y="65" fill="#FFFFFF" font-size="32" font-weight="800">Live Waybill Manifests &amp; Real-Time Tracking</text>

      <rect x="50" y="100" width="980" height="68" rx="16" fill="#081735" stroke="#00D18F" stroke-width="2"/>
      <text x="80" y="143" fill="#FFFFFF" font-size="26" font-weight="700">TP-89204-NG</text>

      <rect x="1050" y="100" width="340" height="68" rx="16" fill="url(#brandGrad)"/>
      <text x="1130" y="143" fill="#061228" font-size="24" font-weight="900">TRACK WAYBILL</text>

      <!-- Table Container -->
      <rect x="50" y="200" width="1340" height="450" rx="20" fill="#081735"/>

      <!-- Table Header -->
      <rect x="50" y="200" width="1340" height="70" rx="20" fill="#0C1D3F"/>
      <text x="90" y="244" fill="#8A9BB5" font-size="20" font-weight="800">WAYBILL CODE</text>
      <text x="340" y="244" fill="#8A9BB5" font-size="20" font-weight="800">ROUTE</text>
      <text x="640" y="244" fill="#8A9BB5" font-size="20" font-weight="800">PARK / TRANSPORT LINE</text>
      <text x="1020" y="244" fill="#8A9BB5" font-size="20" font-weight="800">STATUS</text>

      <!-- Row 1 -->
      <text x="90" y="320" fill="#00FFB2" font-size="24" font-weight="800">#TP-89204-NG</text>
      <text x="340" y="320" fill="#FFFFFF" font-size="22">Lagos ➔ Abuja</text>
      <text x="640" y="320" fill="#FFFFFF" font-size="22">GUO Transport (Jibowu Park)</text>
      <rect x="1020" y="290" width="180" height="44" rx="22" fill="#00D18F" opacity="0.3"/>
      <text x="1050" y="320" fill="#00FFB2" font-size="18" font-weight="900">IN TRANSIT</text>

      <line x1="90" y1="360" x2="1340" y2="360" stroke="#122B59" stroke-width="2"/>

      <!-- Row 2 -->
      <text x="90" y="410" fill="#00FFB2" font-size="24" font-weight="800">#TP-77102-PH</text>
      <text x="340" y="410" fill="#FFFFFF" font-size="22">Port Harcourt ➔ Benin</text>
      <text x="640" y="410" fill="#FFFFFF" font-size="22">Peace Mass Transit</text>
      <rect x="1020" y="380" width="180" height="44" rx="22" fill="#00E699" opacity="0.3"/>
      <text x="1055" y="410" fill="#FFFFFF" font-size="18" font-weight="900">DELIVERED</text>

      <line x1="90" y1="450" x2="1340" y2="450" stroke="#122B59" stroke-width="2"/>

      <!-- Row 3 -->
      <text x="90" y="500" fill="#00FFB2" font-size="24" font-weight="800">#TP-66209-KD</text>
      <text x="340" y="500" fill="#FFFFFF" font-size="22">Kaduna ➔ Kano</text>
      <text x="640" y="500" fill="#FFFFFF" font-size="22">GIG Logistics / Motor Park Line</text>
      <rect x="1020" y="470" width="180" height="44" rx="22" fill="#00D18F" opacity="0.3"/>
      <text x="1050" y="500" fill="#00FFB2" font-size="18" font-weight="900">IN TRANSIT</text>
    </g>
  </g>
</svg>`;

const tmpMobileSvg = path.join('/tmp', 'screenshot_mobile.svg');
const tmpDesktopSvg = path.join('/tmp', 'screenshot_desktop.svg');

fs.writeFileSync(tmpMobileSvg, mobileSvg);
fs.writeFileSync(tmpDesktopSvg, desktopSvg);

execSync(`ffmpeg -y -i ${tmpMobileSvg} -s 1080x1920 ${path.join(publicDir, 'screenshot-mobile.png')}`);
execSync(`ffmpeg -y -i ${tmpDesktopSvg} -s 1920x1080 ${path.join(publicDir, 'screenshot-desktop.png')}`);

console.log('Successfully re-generated high-contrast crisp PNG screenshots for TrackPack PWA!');
