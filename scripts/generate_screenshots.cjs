const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const publicDir = path.join(__dirname, '..', 'public');

// 1. Mobile Screenshot SVG (1080x1920)
const mobileSvg = `<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0A1F44"/>
      <stop offset="100%" stop-color="#061228"/>
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

  <!-- Background -->
  <rect width="1080" height="1920" fill="url(#bgGrad)"/>

  <!-- Top Navigation Header Bar -->
  <rect width="1080" height="180" fill="#06142E"/>
  <line x1="0" y1="180" x2="1080" y2="180" stroke="#00D18F" stroke-width="4"/>

  <!-- Header Branding -->
  <g transform="translate(60, 45)">
    <!-- Small 3D Box Icon -->
    <rect x="0" y="0" width="90" height="90" rx="20" fill="#0A1F44" stroke="#00D18F" stroke-width="4"/>
    <path d="M 45,20 L 70,35 L 45,50 L 20,35 Z" fill="#00FFB2"/>
    <path d="M 20,35 L 45,50 L 45,75 L 20,60 Z" fill="#00C483"/>
    <path d="M 45,50 L 70,35 L 70,60 L 45,75 Z" fill="#008A5B"/>
    <path d="M 52,48 L 62,58 L 78,38" fill="none" stroke="#00FFB2" stroke-width="6" stroke-linecap="round"/>

    <!-- App Title Text -->
    <text x="120" y="52" fill="#FFFFFF" font-size="44" font-weight="800" letter-spacing="1">TrackPack</text>
    <text x="120" y="82" fill="#00D18F" font-size="22" font-weight="600" letter-spacing="2">WAYBILL TRACKING</text>
  </g>

  <!-- Main Search Card -->
  <g transform="translate(60, 230)">
    <rect width="960" height="360" rx="32" fill="url(#cardGrad)" stroke="#1E3E75" stroke-width="2"/>
    <text x="50" y="70" fill="#FFFFFF" font-size="36" font-weight="700">Track Motor Park Waybill</text>
    <text x="50" y="110" fill="#8A9BB5" font-size="24">Enter your tracking code or phone number</text>

    <!-- Search Input Box -->
    <rect x="50" y="145" width="860" height="100" rx="20" fill="#081735" stroke="#00D18F" stroke-width="3"/>
    <text x="90" y="208" fill="#FFFFFF" font-size="32" font-weight="600">TP-89204-NG</text>
    
    <!-- Track Button -->
    <rect x="670" y="155" width="230" height="80" rx="16" fill="url(#brandGrad)"/>
    <text x="735" y="206" fill="#061228" font-size="28" font-weight="800">TRACK</text>
  </g>

  <!-- Active Tracking Result Card -->
  <g transform="translate(60, 630)">
    <rect width="960" height="880" rx="32" fill="url(#cardGrad)" stroke="#1E3E75" stroke-width="2"/>

    <!-- Card Header Info -->
    <text x="50" y="70" fill="#8A9BB5" font-size="22" font-weight="600">WAYBILL NUMBER</text>
    <text x="50" y="115" fill="#FFFFFF" font-size="42" font-weight="800">#TP-89204-NG</text>

    <!-- Status Badge -->
    <rect x="690" y="60" width="220" height="60" rx="30" fill="#00D18F" opacity="0.2"/>
    <rect x="690" y="60" width="220" height="60" rx="30" fill="none" stroke="#00D18F" stroke-width="2"/>
    <circle cx="725" cy="90" r="8" fill="#00FFB2"/>
    <text x="745" y="99" fill="#00FFB2" font-size="22" font-weight="800">IN TRANSIT</text>

    <!-- Route Info -->
    <rect x="50" y="160" width="860" height="150" rx="20" fill="#081735"/>
    <text x="90" y="210" fill="#8A9BB5" font-size="22">FROM</text>
    <text x="90" y="250" fill="#FFFFFF" font-size="30" font-weight="700">Lagos (Jibowu Park)</text>
    
    <text x="530" y="210" fill="#8A9BB5" font-size="22">TO</text>
    <text x="530" y="250" fill="#FFFFFF" font-size="30" font-weight="700">Abuja (Utako Park)</text>

    <line x1="50" y1="350" x2="910" y2="350" stroke="#1E3E75" stroke-width="2"/>

    <!-- Timeline Progress -->
    <text x="50" y="410" fill="#FFFFFF" font-size="32" font-weight="700">Tracking Timeline</text>

    <!-- Timeline Steps -->
    <!-- Step 1 -->
    <circle cx="90" cy="480" r="20" fill="#00D18F"/>
    <path d="M 82,480 L 88,486 L 98,474" fill="none" stroke="#061228" stroke-width="4" stroke-linecap="round"/>
    <line x1="90" y1="500" x2="90" y2="580" stroke="#00D18F" stroke-width="6"/>
    <text x="140" y="475" fill="#FFFFFF" font-size="28" font-weight="700">Waybill Registered &amp; Received</text>
    <text x="140" y="505" fill="#8A9BB5" font-size="22">Jibowu Motor Park, Lagos • 08:30 AM</text>

    <!-- Step 2 -->
    <circle cx="90" cy="600" r="20" fill="#00D18F"/>
    <path d="M 82,600 L 88,606 L 98,594" fill="none" stroke="#061228" stroke-width="4" stroke-linecap="round"/>
    <line x1="90" y1="620" x2="90" y2="700" stroke="#00D18F" stroke-width="6"/>
    <text x="140" y="595" fill="#FFFFFF" font-size="28" font-weight="700">Dispatched in Bus #104</text>
    <text x="140" y="625" fill="#8A9BB5" font-size="22">GUO Transport Line • 09:45 AM</text>

    <!-- Step 3 (Active) -->
    <circle cx="90" cy="720" r="24" fill="#00FFB2"/>
    <circle cx="90" cy="720" r="10" fill="#061228"/>
    <line x1="90" y1="744" x2="90" y2="810" stroke="#1E3E75" stroke-width="6" stroke-dasharray="8 8"/>
    <text x="140" y="715" fill="#00FFB2" font-size="28" font-weight="800">In Transit - Lokoja Express Way</text>
    <text x="140" y="745" fill="#8A9BB5" font-size="22">On Route to Abuja • Estimated Arrival 04:30 PM</text>

    <!-- Step 4 (Pending) -->
    <circle cx="90" cy="830" r="18" fill="#1E3E75"/>
    <text x="140" y="835" fill="#8A9BB5" font-size="28" font-weight="600">Arrived at Utako Park, Abuja</text>
  </g>

  <!-- Bottom Navigation Bar -->
  <rect y="1740" width="1080" height="180" fill="#06142E"/>
  <line x1="0" y1="1740" x2="1080" y2="1740" stroke="#1E3E75" stroke-width="2"/>
  
  <text x="180" y="1830" fill="#00D18F" font-size="26" font-weight="700" text-anchor="middle">Track</text>
  <text x="540" y="1830" fill="#8A9BB5" font-size="26" font-weight="600" text-anchor="middle">Manifests</text>
  <text x="900" y="1830" fill="#8A9BB5" font-size="26" font-weight="600" text-anchor="middle">Parks</text>
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

  <!-- Background -->
  <rect width="1920" height="1080" fill="url(#bgGrad)"/>

  <!-- Left Sidebar (Width 320px) -->
  <rect width="320" height="1080" fill="#06142E"/>
  <line x1="320" y1="0" x2="320" y2="1080" stroke="#1E3E75" stroke-width="2"/>

  <!-- Sidebar Brand Header -->
  <g transform="translate(30, 40)">
    <rect x="0" y="0" width="60" height="60" rx="14" fill="#0A1F44" stroke="#00D18F" stroke-width="3"/>
    <path d="M 30,12 L 48,22 L 30,32 L 12,22 Z" fill="#00FFB2"/>
    <path d="M 12,22 L 30,32 L 30,48 L 12,38 Z" fill="#00C483"/>
    <path d="M 30,32 L 48,22 L 48,38 L 30,48 Z" fill="#008A5B"/>
    <path d="M 35,31 L 41,37 L 51,25" fill="none" stroke="#00FFB2" stroke-width="4" stroke-linecap="round"/>

    <text x="80" y="38" fill="#FFFFFF" font-size="30" font-weight="800">TrackPack</text>
    <text x="80" y="58" fill="#00D18F" font-size="14" font-weight="700" letter-spacing="1">WAYBILL PLATFORM</text>
  </g>

  <!-- Sidebar Menu Items -->
  <g transform="translate(20, 150)">
    <!-- Active item -->
    <rect x="0" y="0" width="280" height="54" rx="14" fill="#00D18F" opacity="0.15"/>
    <rect x="0" y="0" width="6" height="54" rx="3" fill="#00D18F"/>
    <text x="60" y="35" fill="#00FFB2" font-size="20" font-weight="700">Waybill Tracker</text>

    <text x="60" y="100" fill="#8A9BB5" font-size="20" font-weight="600">Park Manifests</text>
    <text x="60" y="160" fill="#8A9BB5" font-size="20" font-weight="600">Motor Parks Directory</text>
    <text x="60" y="220" fill="#8A9BB5" font-size="20" font-weight="600">Analytics &amp; Revenue</text>
    <text x="60" y="280" fill="#8A9BB5" font-size="20" font-weight="600">Settings</text>
  </g>

  <!-- Top Navigation Header Bar -->
  <g transform="translate(320, 0)">
    <rect width="1600" height="90" fill="#081735"/>
    <line x1="0" y1="90" x2="1600" y2="90" stroke="#1E3E75" stroke-width="2"/>

    <!-- Search Input Bar -->
    <rect x="40" y="18" width="540" height="54" rx="14" fill="#0A1F44" stroke="#1E3E75" stroke-width="2"/>
    <text x="70" y="52" fill="#8A9BB5" font-size="18">Search waybill code, phone, or park...</text>

    <!-- User Profile Badge -->
    <rect x="1320" y="20" width="240" height="50" rx="25" fill="#122B59"/>
    <circle cx="1348" cy="45" r="16" fill="#00D18F"/>
    <text x="1342" y="51" fill="#061228" font-size="16" font-weight="800">JP</text>
    <text x="1375" y="42" fill="#FFFFFF" font-size="16" font-weight="700">Jibowu Park</text>
    <text x="1375" y="58" fill="#00D18F" font-size="12" font-weight="600">ADMIN</text>
  </g>

  <!-- Main Content Dashboard -->
  <g transform="translate(360, 120)">
    <!-- Metrics Cards Row -->
    <!-- Metric 1 -->
    <rect x="0" y="0" width="360" height="130" rx="20" fill="url(#cardGrad)" stroke="#1E3E75" stroke-width="2"/>
    <text x="30" y="40" fill="#8A9BB5" font-size="16" font-weight="600">TOTAL WAYBILLS TODAY</text>
    <text x="30" y="85" fill="#FFFFFF" font-size="36" font-weight="800">1,482</text>
    <text x="210" y="85" fill="#00FFB2" font-size="16" font-weight="700">+14% vs yesterday</text>

    <!-- Metric 2 -->
    <rect x="390" y="0" width="360" height="130" rx="20" fill="url(#cardGrad)" stroke="#1E3E75" stroke-width="2"/>
    <text x="420" y="40" fill="#8A9BB5" font-size="16" font-weight="600">IN TRANSIT PARCELS</text>
    <text x="420" y="85" fill="#00FFB2" font-size="36" font-weight="800">342</text>
    <text x="590" y="85" fill="#8A9BB5" font-size="16">Active Buses: 48</text>

    <!-- Metric 3 -->
    <rect x="780" y="0" width="360" height="130" rx="20" fill="url(#cardGrad)" stroke="#1E3E75" stroke-width="2"/>
    <text x="810" y="40" fill="#8A9BB5" font-size="16" font-weight="600">DELIVERED &amp; CLAIMED</text>
    <text x="810" y="85" fill="#FFFFFF" font-size="36" font-weight="800">1,140</text>
    <text x="980" y="85" fill="#00D18F" font-size="16" font-weight="700">97.1% Success</text>

    <!-- Main Live Tracker Card -->
    <g transform="translate(0, 160)">
      <rect width="1140" height="740" rx="24" fill="url(#cardGrad)" stroke="#1E3E75" stroke-width="2"/>

      <text x="40" y="55" fill="#FFFFFF" font-size="26" font-weight="800">Waybill Live Status &amp; Manifest</text>

      <!-- Active Search bar -->
      <rect x="40" y="80" width="800" height="60" rx="14" fill="#081735" stroke="#00D18F" stroke-width="2"/>
      <text x="70" y="118" fill="#FFFFFF" font-size="22" font-weight="600">TP-89204-NG</text>

      <rect x="860" y="80" width="240" height="60" rx="14" fill="url(#brandGrad)"/>
      <text x="920" y="118" fill="#061228" font-size="20" font-weight="800">TRACK NOW</text>

      <!-- Waybill Details Table View -->
      <rect x="40" y="170" width="1060" height="520" rx="16" fill="#081735"/>

      <!-- Table Header -->
      <rect x="40" y="170" width="1060" height="60" rx="16" fill="#0C1D3F"/>
      <text x="70" y="208" fill="#8A9BB5" font-size="16" font-weight="700">WAYBILL ID</text>
      <text x="240" y="208" fill="#8A9BB5" font-size="16" font-weight="700">ROUTE</text>
      <text x="500" y="208" fill="#8A9BB5" font-size="16" font-weight="700">PARK / LINE</text>
      <text x="740" y="208" fill="#8A9BB5" font-size="16" font-weight="700">STATUS</text>
      <text x="940" y="208" fill="#8A9BB5" font-size="16" font-weight="700">TIMESTAMP</text>

      <!-- Row 1 -->
      <text x="70" y="270" fill="#00FFB2" font-size="18" font-weight="700">#TP-89204-NG</text>
      <text x="240" y="270" fill="#FFFFFF" font-size="18">Lagos ➔ Abuja</text>
      <text x="500" y="270" fill="#FFFFFF" font-size="18">GUO Transport (Jibowu)</text>
      <rect x="740" y="248" width="140" height="32" rx="16" fill="#00D18F" opacity="0.2"/>
      <text x="762" y="270" fill="#00FFB2" font-size="14" font-weight="800">IN TRANSIT</text>
      <text x="940" y="270" fill="#8A9BB5" font-size="16">Today, 09:45 AM</text>

      <line x1="70" y1="300" x2="1060" y2="300" stroke="#122B59" stroke-width="1"/>

      <!-- Row 2 -->
      <text x="70" y="340" fill="#00FFB2" font-size="18" font-weight="700">#TP-77102-PH</text>
      <text x="240" y="340" fill="#FFFFFF" font-size="18">Port Harcourt ➔ Benin</text>
      <text x="500" y="340" fill="#FFFFFF" font-size="18">Young Shall Grow</text>
      <rect x="740" y="318" width="140" height="32" rx="16" fill="#00E699" opacity="0.3"/>
      <text x="765" y="340" fill="#FFFFFF" font-size="14" font-weight="800">DELIVERED</text>
      <text x="940" y="340" fill="#8A9BB5" font-size="16">Today, 08:12 AM</text>

      <line x1="70" y1="370" x2="1060" y2="370" stroke="#122B59" stroke-width="1"/>

      <!-- Row 3 -->
      <text x="70" y="410" fill="#00FFB2" font-size="18" font-weight="700">#TP-66209-KD</text>
      <text x="240" y="410" fill="#FFFFFF" font-size="18">Kaduna ➔ Kano</text>
      <text x="500" y="410" fill="#FFFFFF" font-size="18">GIG Logistics / Bus Line</text>
      <rect x="740" y="388" width="140" height="32" rx="16" fill="#00D18F" opacity="0.2"/>
      <text x="762" y="410" fill="#00FFB2" font-size="14" font-weight="800">IN TRANSIT</text>
      <text x="940" y="410" fill="#8A9BB5" font-size="16">Today, 10:30 AM</text>

      <line x1="70" y1="440" x2="1060" y2="440" stroke="#122B59" stroke-width="1"/>

      <!-- Row 4 -->
      <text x="70" y="480" fill="#00FFB2" font-size="18" font-weight="700">#TP-55410-EN</text>
      <text x="240" y="480" fill="#FFFFFF" font-size="18">Enugu ➔ Onitsha</text>
      <text x="500" y="480" fill="#FFFFFF" font-size="18">Peace Mass Transit</text>
      <rect x="740" y="458" width="140" height="32" rx="16" fill="#FFC107" opacity="0.2"/>
      <text x="762" y="480" fill="#FFD54F" font-size="14" font-weight="800">DISPATCHED</text>
      <text x="940" y="480" fill="#8A9BB5" font-size="16">Today, 11:15 AM</text>
    </g>
  </g>
</svg>`;

const tmpMobileSvg = path.join('/tmp', 'screenshot_mobile.svg');
const tmpDesktopSvg = path.join('/tmp', 'screenshot_desktop.svg');

fs.writeFileSync(tmpMobileSvg, mobileSvg);
fs.writeFileSync(tmpDesktopSvg, desktopSvg);

// Generate crisp PNG screenshots
execSync(`ffmpeg -y -i ${tmpMobileSvg} -s 1080x1920 ${path.join(publicDir, 'screenshot-mobile.png')}`);
execSync(`ffmpeg -y -i ${tmpDesktopSvg} -s 1920x1080 ${path.join(publicDir, 'screenshot-desktop.png')}`);

console.log('Successfully generated clean valid PNG screenshots for PWA!');
