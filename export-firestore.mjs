import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync, writeFileSync } from 'fs';

const config = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

const collections = ['tracks', 'albums', 'posts', 'users', 'settings', 'changelog', 'conversations'];
const result = {};

for (const col of collections) {
  try {
    const snap = await getDocs(collection(db, col));
    result[col] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`✓ ${col}: ${result[col].length} documents`);
  } catch (e) {
    console.log(`✗ ${col}: ${e.message}`);
    result[col] = [];
  }
}

writeFileSync('./firestore-export.json', JSON.stringify(result, null, 2));
console.log('\nExport saved to firestore-export.json');
process.exit(0);
