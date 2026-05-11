import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'

const COLLECTION = 'hotel_storage'

export const storage = {
  async get(key) {
    try {
      const snap = await getDoc(doc(db, COLLECTION, key))
      if (!snap.exists()) return null
      return { key, value: snap.data().value }
    } catch (e) {
      console.error('storage.get error:', e)
      return null
    }
  },

  async set(key, value) {
    try {
      await setDoc(doc(db, COLLECTION, key), {
        value,
        updatedAt: new Date().toISOString()
      })
      return { key, value }
    } catch (e) {
      console.error('storage.set error:', e)
      return null
    }
  },

  async delete(key) {
    try {
      await deleteDoc(doc(db, COLLECTION, key))
      return { key, deleted: true }
    } catch (e) {
      console.error('storage.delete error:', e)
      return null
    }
  },

  async list(prefix = '') {
    try {
      const snap = await getDocs(collection(db, COLLECTION))
      const keys = snap.docs.map(d => d.id).filter(k => k.startsWith(prefix))
      return { keys }
    } catch (e) {
      console.error('storage.list error:', e)
      return { keys: [] }
    }
  }
}
