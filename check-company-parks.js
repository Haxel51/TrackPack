import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const snap = await getDoc(doc(db, 'companies', 'JGtf2kyFKpPDPrcHv4UQ'));
  if (snap.exists()) {
    console.log(snap.data().parks);
  }
  process.exit(0);
}
run();
