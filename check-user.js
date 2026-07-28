import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const cSnap = await getDocs(query(collection(db, 'companies'), where('ownerPhone', '==', '08035751155')));
  if (!cSnap.empty) {
     const comp = cSnap.docs[0];
     console.log("Company:", comp.id);
     
     const sSnap = await getDocs(query(collection(db, 'staff'), where('companyId', '==', comp.id)));
     console.log("Staff count:", sSnap.size);

     const wSnap = await getDocs(query(collection(db, 'waybills'), where('originPark', 'in', comp.data().parks)));
     console.log("Waybills count origin:", wSnap.size);
  } else {
     console.log("Not found");
  }
  process.exit(0);
}
run();
