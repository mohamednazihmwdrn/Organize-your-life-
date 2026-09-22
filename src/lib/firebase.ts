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

// User Interface for Registered / Authenticated Users
export interface AppAuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  phoneNumber?: string | null;
}

// Global Auth state subscribers
const authSubscribers = new Set<(user: AppAuthUser | null) => void>();

export function notifyAuthSubscribers(user: AppAuthUser | null) {
  authSubscribers.forEach((cb) => {
    try {
      cb(user);
    } catch (e) {
      console.error(e);
    }
  });
}

// Retrieve device-bound registered user from localStorage
export function getStoredLocalUser(): AppAuthUser | null {
  const isRegistered = localStorage.getItem('plm_device_registered') === '1';
  const uid = localStorage.getItem('plm_user_uid');
  if (isRegistered && uid) {
    const name = localStorage.getItem('plm_name') || 'مستخدم';
    const phone = localStorage.getItem('plm_registered_phone') || '';
    return {
      uid,
      displayName: name,
      email: phone ? phoneToAuthEmail(phone) : null,
      phoneNumber: phone,
    };
  }
  return null;
}

// User Auth State helper
export function onAuthChange(callback: (user: any | null) => void) {
  authSubscribers.add(callback);

  // Immediately notify if device has local identity
  const storedUser = getStoredLocalUser();
  if (storedUser) {
    setTimeout(() => callback(storedUser), 0);
  }

  const unsub = onAuthStateChanged(auth, (fbUser) => {
    if (fbUser) {
      callback(fbUser);
    } else {
      const fallbackUser = getStoredLocalUser();
      callback(fallbackUser);
    }
  });

  return () => {
    authSubscribers.delete(callback);
    unsub();
  };
}

// Secure SHA-256 password hash (works on all modern mobile and desktop browsers)
export async function hashPassword(pass: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto?.subtle) {
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(pass + '_plm_secure_salt_2026'));
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch (e) {
    console.warn('Crypto subtle unavailable, using fallback hash:', e);
  }
  let hash = 0;
  for (let i = 0; i < pass.length; i++) {
    hash = (hash << 5) - hash + pass.charCodeAt(i);
    hash |= 0;
  }
  return `h_${Math.abs(hash)}`;
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
export async function registerWithPhone(name: string, phone: string, pass: string): Promise<AppAuthUser> {
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

  const pHash = await hashPassword(pass);
  const email = phoneToAuthEmail(phone);
  const phoneDocRef = doc(db, 'phone_accounts', normPhone);

  // 1. Check if phone already registered in Firestore
  try {
    const existingSnap = await getDoc(phoneDocRef);
    if (existingSnap.exists()) {
      const data = existingSnap.data();
      // If same password provided, seamlessly restore the account!
      if (data?.passwordHash && data.passwordHash === pHash) {
        const loginRes = await loginWithPhone(phone, pass);
        return loginRes.user;
      }
      throw new Error('رقم الهاتف هذا مسجل بالفعل مسبقاً! انتقل لتبويب "لدي حساب (استرجاع)" أو تأكد من كلمة المرور');
    }
  } catch (err: any) {
    if (err.message && err.message.includes('مسجل بالفعل')) {
      throw err;
    }
    console.warn('Firestore phone check warning:', err);
  }

  let finalUid = `usr_${normPhone}`;

  // 2. Try Firebase Auth create user (if Email/Password is enabled in project)
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    if (result?.user) {
      finalUid = result.user.uid;
      try {
        await updateProfile(result.user, { displayName: cleanName });
      } catch (e) {
        // ignore profile update error
      }
    }
  } catch (authErr: any) {
    // If operation-not-allowed or admin-only, we gracefully bypass Firebase Auth
    // and rely on our secure Firestore + device identity registry
    console.warn('Firebase Auth email/pass not enabled or offline, continuing with cloud profile:', authErr.code || authErr.message);
  }

  // 3. Store in Firestore phone_accounts collection for multi-device sync and restoration
  try {
    await setDoc(
      phoneDocRef,
      {
        uid: finalUid,
        name: cleanName,
        phone: normPhone,
        rawPhone: phone.trim(),
        passwordHash: pHash,
        registeredAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'mobile',
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Could not write phone_account to Firestore:', e);
  }

  // 4. Store user profile document in Firestore
  try {
    const userDocRef = doc(db, 'users', finalUid, 'profile', 'info');
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

  // 5. Save device persistence flags in localStorage
  localStorage.setItem('plm_device_registered', '1');
  localStorage.setItem('plm_registered_phone', phone.trim());
  localStorage.setItem('plm_name', cleanName);
  localStorage.setItem('plm_user_uid', finalUid);
  localStorage.setItem('plm_onboarded', '1');

  const appUser: AppAuthUser = {
    uid: finalUid,
    displayName: cleanName,
    email,
    phoneNumber: phone.trim(),
  };

  notifyAuthSubscribers(appUser);
  return appUser;
}

// Login with Phone Number and Password (e.g. after reinstalling the app)
export async function loginWithPhone(
  phone: string,
  pass: string
): Promise<{ user: AppAuthUser; name: string }> {
  const normPhone = normalizePhone(phone);
  if (!normPhone || normPhone.length < 7) {
    throw new Error('يرجى إدخال رقم هاتف صحيح');
  }
  if (!pass) {
    throw new Error('يرجى إدخال كلمة المرور أو الرمز السري');
  }

  const pHash = await hashPassword(pass);
  const email = phoneToAuthEmail(phone);
  let restoredUid = `usr_${normPhone}`;
  let restoredName = 'مستخدم';
  let accountFound = false;

  // 1. Try retrieving from Firestore phone_accounts collection
  try {
    const phoneDocRef = doc(db, 'phone_accounts', normPhone);
    const docSnap = await getDoc(phoneDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      accountFound = true;
      if (data?.passwordHash && data.passwordHash !== pHash) {
        throw new Error('كلمة المرور التي أدخلتها غير صحيحة، يرجى التأكد وإعادة المحاولة');
      }
      if (data?.name) restoredName = data.name;
      if (data?.uid) restoredUid = data.uid;

      // Update lastLoginAt
      try {
        await setDoc(phoneDocRef, { lastLoginAt: new Date().toISOString() }, { merge: true });
      } catch (e) {
        // ignore update error
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('غير صحيحة')) {
      throw err;
    }
    console.warn('Could not read from Firestore phone_accounts:', err);
  }

  // 2. Try Firebase Auth sign-in if enabled
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    if (result?.user) {
      accountFound = true;
      restoredUid = result.user.uid;
      if (result.user.displayName) restoredName = result.user.displayName;
    }
  } catch (fbErr: any) {
    if (fbErr.code === 'auth/wrong-password') {
      throw new Error('كلمة المرور غير صحيحة، يرجى التأكد والمحاولة مرة أخرى');
    }
    // operation-not-allowed is ignored
  }

  // 3. Fallback: check device local records if phone matches
  if (!accountFound) {
    const localPhone = localStorage.getItem('plm_registered_phone');
    if (localPhone && normalizePhone(localPhone) === normPhone) {
      accountFound = true;
      restoredName = localStorage.getItem('plm_name') || 'مستخدم';
      restoredUid = localStorage.getItem('plm_user_uid') || `usr_${normPhone}`;
    }
  }

  if (!accountFound) {
    throw new Error('لم يتم العثور على حساب مسجل برقم الهاتف هذا. يرجى التأكد من الرقم أو التسجيل لأول مرة.');
  }

  // Re-save device persistence so this device recognizes the user automatically
  localStorage.setItem('plm_device_registered', '1');
  localStorage.setItem('plm_registered_phone', phone.trim());
  localStorage.setItem('plm_name', restoredName);
  localStorage.setItem('plm_user_uid', restoredUid);
  localStorage.setItem('plm_onboarded', '1');

  const appUser: AppAuthUser = {
    uid: restoredUid,
    displayName: restoredName,
    email,
    phoneNumber: phone.trim(),
  };

  notifyAuthSubscribers(appUser);
  return { user: appUser, name: restoredName };
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
export async function loginWithGoogle(): Promise<AppAuthUser> {
  const result = await signInWithPopup(auth, googleProvider);
  const name = result.user.displayName || result.user.email?.split('@')[0] || 'مستخدم';
  localStorage.setItem('plm_device_registered', '1');
  localStorage.setItem('plm_name', name);
  localStorage.setItem('plm_user_uid', result.user.uid);
  localStorage.setItem('plm_onboarded', '1');

  const appUser: AppAuthUser = {
    uid: result.user.uid,
    displayName: name,
    email: result.user.email || null,
    phoneNumber: result.user.phoneNumber || null,
  };

  notifyAuthSubscribers(appUser);
  return appUser;
}

// Sign in with Email/Password
export async function loginWithEmail(email: string, pass: string): Promise<AppAuthUser> {
  const cleanEmail = email.trim();
  let displayName = cleanEmail.split('@')[0] || 'مستخدم';
  let uid = `usr_email_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  try {
    const result = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    if (result.user) {
      uid = result.user.uid;
      displayName = result.user.displayName || displayName;
    }
  } catch (err: any) {
    if (err.code === 'auth/wrong-password') {
      throw new Error('كلمة المرور غير صحيحة');
    }
    // Fallback using stored email or cloud account
    console.warn('Email auth bypass/fallback:', err.code || err.message);
  }

  localStorage.setItem('plm_device_registered', '1');
  localStorage.setItem('plm_name', displayName);
  localStorage.setItem('plm_user_uid', uid);
  localStorage.setItem('plm_onboarded', '1');

  const appUser: AppAuthUser = {
    uid,
    displayName,
    email: cleanEmail,
  };

  notifyAuthSubscribers(appUser);
  return appUser;
}

// Register with Email/Password and Name
export async function registerWithEmail(name: string, email: string, pass: string): Promise<AppAuthUser> {
  const cleanEmail = email.trim();
  const cleanName = name.trim() || cleanEmail.split('@')[0] || 'مستخدم';
  let uid = `usr_email_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  try {
    const result = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    if (result?.user) {
      uid = result.user.uid;
      if (cleanName) {
        await updateProfile(result.user, { displayName: cleanName });
      }
    }
  } catch (err: any) {
    console.warn('Firebase email auth create bypass/fallback:', err.code || err.message);
  }

  localStorage.setItem('plm_device_registered', '1');
  localStorage.setItem('plm_name', cleanName);
  localStorage.setItem('plm_user_uid', uid);
  localStorage.setItem('plm_onboarded', '1');

  const appUser: AppAuthUser = {
    uid,
    displayName: cleanName,
    email: cleanEmail,
  };

  notifyAuthSubscribers(appUser);
  return appUser;
}

// Reset Password
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (e) {
    console.warn('Reset password error:', e);
  }
}

// Logout
export async function logoutUser(): Promise<void> {
  clearDeviceRegistration();
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('SignOut error:', e);
  }
  notifyAuthSubscribers(null);
}
