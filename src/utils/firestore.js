import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function loadUserData(uid) {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

export async function saveUserData(uid, data) {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', uid), { ...data, updatedAt: Date.now() }, { merge: true });
  } catch {
    // localStorage is always the fallback
  }
}
