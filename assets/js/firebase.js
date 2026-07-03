import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCqw7XI-K4Ym7L5pF6BdAEQzI2ma9gmUpo',
  authDomain: 'multass.firebaseapp.com',
  projectId: 'multass',
  storageBucket: 'multass.firebasestorage.app',
  messagingSenderId: '200948218811',
  appId: '1:200948218811:web:c9f0ec9e4c2298f7a1629e'
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const firestore = db;
