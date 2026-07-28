const fs = require('fs');
let code = fs.readFileSync('src/pages/SenderView.tsx', 'utf8');

code = code.replace(
  /getParks\(\)\.then\(data => {\s*setParks\(data\.filter\(p => p !== user\?\.park\)\);\s*}\);/,
  `if (user?.companyId) {
      getCompanyById(user.companyId).then(comp => {
        if (comp) setParks(comp.parks.filter(p => p !== user.park));
      });
    }`
);

code = code.replace(
  /const data = await getStaffParkManifest\(user\.park\);/,
  `const data = await getSenderManifest(user.park);`
);

fs.writeFileSync('src/pages/SenderView.tsx', code);
