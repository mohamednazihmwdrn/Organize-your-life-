import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  Firestore,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  onSnapshot,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with robust multi-tab offline persistence
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch (e) {
  db = getFirestore(app);
}

export { db };

// Test connection on boot
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    // Attempt a light ping
    await getDocFromServer(doc(db, 'test', 'ping'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline, using offline cache.');
    }
    return false;
  }
}

// User Auth State helper
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Phone Number Normalization (converts Arabic digits to Western digits, strips formatting)
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let cleaned = phone.trim();
  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replace(new RegExp(arabicDigits[i], 'g'), i.toString());
  }
  cleaned = cleaned.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
}

// Convert normalized phone number to internal Firebase Auth email
export function phoneToAuthEmail(phone: string): string {
  const norm = normalizePhone(phone);
  return `phone_${norm}@plm.app`;
}

// Register with Phone Number, Name, and Security Password/PIN
export async function registerWithPhone(name: string, phone: string, pass: string): Promise<User> {
  const normPhone = normalizePhone(phone);
  if (!normPhone || normPhone.length < 7) {
    throw new Error('يرجى إدخال رقم هاتف صحيح مكون من 7 أرقام على الأقل');
  }
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error('يرجى إدخال اسمك الكريم');
  }
  if (!pass || pass.length < 6) {
    throw new Error('كلمة المرور / الرمز السري يجب أن تكون 6 أحرف أو أرقام على الأقل');
  }

  const email = phoneToAuthEmail(phone);
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  await updateProfile(result.user, { displayName: cleanName });

  // Store user profile document in Firestore
  try {
    const userDocRef = doc(db, 'users', result.user.uid, 'profile', 'info');
    await setDoc(
      userDocRef,
      {
        name: cleanName,
        phone: normPhone,
        rawPhone: phone.trim(),
        registeredAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        deviceRegistered: true,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not write profile to Firestore:', err);
  }

  // Save device persistence flags
  localStorage.setItem('plm_device_registered', '1');
  localStorage.setItem('plm_registered_phone', phone.trim());
  localStorage.setItem('plm_name', cleanName);
  localStorage.setItem('plm_user_uid', result.user.uid);
  localStorage.setItem('plm_onboarded', '1');

  return result.user;
}

// Login with Phone Number and Password (e.g. after reinstalling the app)
export async function loginWithPhone(
  phone: string,
  pass: string
): Promise<{ user: User; name: string }> {
  const normPhone = normalizePhone(phone);
  if (!normPhone || normPhone.length < 7) {
    throw new Error('يرجى إدخال رقم هاتف صحيح');
  }
  if (!pass) {
    throw new Error('يرجى إدخال كلمة المرور أو الرمز السري');
  }

  const email = phoneToAuthEmail(phone);
  const result = await signInWithEmailAndPassword(auth, email, pass);

  let restoredName = result.user.displayName || '';
  // Try retrieving full name from Firestore profile
  try {
    const userDocRef = doc(db, 'users', result.user.uid, 'profile', 'info');
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data?.name) restoredName = data.name;
    }
  } catch (err) {
    console.warn('Could not read user profile from Firestore:', err);
  }

  if (!restoredName) {
    restoredName = localStorage.getItem('plm_name') || 'مستخدم';
  }

  // Re-save device persistence so this device recognizes the user automatically
  localStorage.setItem('plm_device_registered', '1');
  localStorage.setItem('plm_registered_phone', phone.trim());
  localStorage.setItem('plm_name', restoredName);
  localStorage.setItem('plm_user_uid', result.user.uid);
  localStorage.setItem('plm_onboarded', '1');

  return { user: result.user, name: restoredName };
}

// Check if current device is registered
export function isDeviceRecognized(): boolean {
  return localStorage.getItem('plm_device_registered') === '1';
}

// Clear device registration on explicit logout
export function clearDeviceRegistration(): void {
  localStorage.removeItem('plm_device_registered');
  localStorage.removeItem('plm_registered_phone');
  localStorage.removeItem('plm_user_uid');
}

// Sign in with Google
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  if (result.user) {
    const name = result.user.displayName || result.user.email?.split('@')[0] || 'مستخدم';
    localStorage.setItem('plm_device_registered', '1');
    localStorage.setItem('plm_name', name);
    localStorage.setItem('plm_user_uid', result.user.uid);
    localStorage.setItem('plm_onboarded', '1');
  }
  return result.user;
}

// Sign in with Email/Password
export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
  if (result.user) {
    const name = result.user.displayName || result.user.email?.split('@')[0] || 'مستخدم';
    localStorage.setItem('plm_device_registered', '1');
    localStorage.setItem('plm_name', name);
    localStorage.setItem('plm_user_uid', result.user.uid);
    localStorage.setItem('plm_onboarded', '1');
  }
  return result.user;
}

// Register with Email/Password and Name
export async function registerWithEmail(name: string, email: string, pass: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (name.trim()) {
    await updateProfile(result.user, { displayName: name.trim() });
  }
  if (result.user) {
    localStorage.setItem('plm_device_registered', '1');
    localStorage.setItem('plm_name', name.trim());
    localStorage.setItem('plm_user_uid', result.user.uid);
    localStorage.setItem('plm_onboarded', '1');
  }
  return result.user;
}

// Reset Password
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

// Logout
export async function logoutUser(): Promise<void> {
  clearDeviceRegistration();
  await signOut(auth);
}
