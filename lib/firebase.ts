import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// --- COLE SUAS CHAVES DO FIREBASE AQUI ---
const firebaseConfig = {
  apiKey: "AIzaSyADWKRLJ5BxrEp8Ggn59VmE6EBMZ3yQT5k",
  authDomain: "manhazinha-a6896.firebaseapp.com",
  projectId: "manhazinha-a6896",
  storageBucket: "manhazinha-a6896.firebasestorage.app",
  messagingSenderId: "467558763560",
  appId: "1:467558763560:web:a40b2c2fed17524e24391d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app);
export const auth = getAuth(app);
