import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getServiceAccount() {
  const value = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!value) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured');
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }
}

const firebaseApp = getApps()[0] ?? initializeApp({
  credential: cert(getServiceAccount())
});

export const db = getFirestore(firebaseApp);
