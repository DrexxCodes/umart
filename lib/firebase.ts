import { initializeApp, getApps } from "firebase/app"
import { getAuth, setPersistence, indexedDBLocalPersistence } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"
import { getMessaging, isSupported } from "firebase/messaging"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)

// Force indexedDB persistence so the auth state survives on iOS PWA (standalone
// mode) after the WebKit process is killed and the tab is reopened.
// The default on iOS PWA is sessionStorage, which is wiped on process death.
// indexedDB is durable across app restarts — this is the correct fix for
// "logged out automatically" on iOS home-screen PWAs.
if (typeof window !== 'undefined') {
  setPersistence(auth, indexedDBLocalPersistence).catch((err) => {
    // Non-fatal: falls back to in-memory. Log for debugging.
    console.warn('[firebase] Could not set indexedDB persistence:', err)
  })
}

export const db = getFirestore(app)
export const storage = getStorage(app)

// getMessaging is only valid in browser + supported environments
export async function getFirebaseMessaging() {
  if (typeof window === 'undefined') return null
  const supported = await isSupported()
  if (!supported) return null
  return getMessaging(app)
}

export default app
