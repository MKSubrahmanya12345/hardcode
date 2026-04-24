import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCpYjIBNnY8aigW1SGJ1vzwWu0-xubNjng",
  authDomain: "bmshavkathon.firebaseapp.com",
  projectId: "bmshavkathon",
  storageBucket: "bmshavkathon.firebasestorage.app",
  messagingSenderId: "364939405585",
  appId: "1:364939405585:web:7663b3bba8fed3758b84b0",
  measurementId: "G-YPQBS9KF8K"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

// Analytics is optional and only available in supported browser environments.
isSupported().then((supported) => {
  if (supported) {
    getAnalytics(firebaseApp);
  }
});
