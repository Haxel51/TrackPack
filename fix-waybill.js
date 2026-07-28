import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import fs from 'fs';

const configStr = fs.readFileSync('firebase-applet-config.json', 'utf8');
const config = JSON.parse(configStr);

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  await updateDoc(doc(db, 'waybills', 'DPc7JZFOF8pkCcjuOwd2'), {
    destinationPark: 'North Terminal'
  });
  console.log("Updated waybill destination to North Terminal");

  // Also create a receiver staff for North Terminal for the user's company
  await addDoc(collection(db, 'staff'), {
    companyId: 'JGtf2kyFKpPDPrcHv4UQ',
    name: 'North Receiver',
    park: 'North Terminal',
    pin: '2222',
    role: 'receiver'
  });
  console.log("Added North Terminal receiver with PIN 2222");

  process.exit(0);
}
run();
