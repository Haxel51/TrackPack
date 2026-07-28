import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const snap = await getDocs(collection(db, 'staff'));
  console.log("Total staff:", snap.size);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(d.id, "name:", data.name, "companyId:", data.companyId);
  });
  process.exit(0);
}
run();
