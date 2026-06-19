import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken } from 'firebase/messaging';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB2mQNeygEwdWFCnHJnw9wlqHWKmXlfe38",
  authDomain: "taptap-377d9.firebaseapp.com",
  databaseURL: "https://taptap-377d9-default-rtdb.firebaseio.com",
  projectId: "taptap-377d9",
  storageBucket: "taptap-377d9.firebasestorage.app",
  messagingSenderId: "146364410143",
  appId: "1:146364410143:web:3ce902bdcaeb954091682a",
  measurementId: "G-LRJ2TK7CDH"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);
