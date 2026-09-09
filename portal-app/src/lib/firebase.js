import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

// Config pública do app web (não é segredo — identifica o projeto no cliente).
const firebaseConfig = {
  apiKey: "AIzaSyBdW-iPgIbE0BTiksCZ1hUFc6vQu26WeQw",
  authDomain: "ccvet-41f5d.firebaseapp.com",
  projectId: "ccvet-41f5d",
  storageBucket: "ccvet-41f5d.firebasestorage.app",
  messagingSenderId: "583584033300",
  appId: "1:583584033300:web:2e5650dfc332c6d6635501",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// `npm run dev` / VITE_USE_EMULATORS=1 apontam para o Emulator Suite local.
if (import.meta.env.DEV || import.meta.env.VITE_USE_EMULATORS === "1") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
