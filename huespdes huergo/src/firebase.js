import { initializeApp } from "firebase/app"
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from "firebase/firestore"

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const db  = getFirestore(app)

// Colección fija donde guardamos los tres documentos principales
const COL = "app_data"

/**
 * Guarda un valor (string JSON) en Firestore.
 * storageSet("huesped_data", JSON.stringify(array))
 */
export async function storageSet(key, value) {
  await setDoc(doc(db, COL, key), { value })
}

/**
 * Lee un valor una sola vez.
 * Devuelve el string guardado, o null si no existe.
 */
export async function storageGet(key) {
  const snap = await getDoc(doc(db, COL, key))
  return snap.exists() ? snap.data().value : null
}

/**
 * Suscripción en tiempo real.
 * Llama a callback(parsedValue) cada vez que el documento cambia.
 * Devuelve la función de unsuscribe para limpiar en useEffect.
 *
 * Uso:
 *   const unsub = storageSubscribe("huesped_data", data => setHuespedes(data))
 *   return () => unsub()
 */
export function storageSubscribe(key, callback) {
  return onSnapshot(doc(db, COL, key), snap => {
    if (snap.exists()) {
      try {
        callback(JSON.parse(snap.data().value))
      } catch {
        callback(null)
      }
    } else {
      callback(null)
    }
  })
}
