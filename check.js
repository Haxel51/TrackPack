import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const snap = await getDocs(collection(db, 'waybills'));
  console.log("Total waybills:", snap.size);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(d.id, data.status, "dest:", data.destinationPark, "bus:", data.busNumber, "origin:", data.originPark);
  });
  process.exit(0);
}
run();
