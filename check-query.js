import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    const q = query(collection(db, 'staff'), where('companyId', '==', 'o0jOt8OJewAQG9SGNfFq'));
    const snap = await getDocs(q);
    console.log("Staff for o0jOt8OJewAQG9SGNfFq:", snap.size);
  } catch(e) {
    console.error("Query failed:", e);
  }
  process.exit(0);
}
run();
