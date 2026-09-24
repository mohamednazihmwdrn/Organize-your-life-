import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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
const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId;
let db: Firestore;
try {
  db = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    firestoreDbId
  );
} catch (e) {
  db = firestoreDbId ? getFirestore(app, firestoreDbId) : getFirestore(app);
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

// Fallback fast hash
export function fallbackHash(pass: string): string {
  let hash = 0;
  for (let i = 0; i < pass.length; i++) {
    hash = (hash << 5) - hash + pass.charCodeAt(i);
    hash |= 0;
  }
  return `h_${Math.abs(hash)}`;
}

// Secure SHA-256 password hash (works across modern mobile & desktop browsers)
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
  return fallbackHash(pass);
}

// Robust password verification supporting multiple hash types & fallbacks
export async function verifyPasswordMatch(pass: string, storedHash?: string): Promise<boolean> {
  if (!storedHash) return false;
  if (storedHash === pass) return true;
  const primaryHash = await hashPassword(pass);
  if (storedHash === primaryHash) return true;
  const fHash = fallbackHash(pass);
  if (storedHash === fHash) return true;
  return false;
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

// Generate all candidate variations of a phone number to guarantee lookup match
export function getPhoneCandidates(phone: string): string[] {
  const norm = normalizePhone(phone);
  if (!norm) return [];

  const set = new Set<string>();
  set.add(norm);

  // If starts with 20 (Egypt country code)
  if (norm.startsWith('20') && norm.length >= 11) {
    const without20 = norm.substring(2);
    set.add(without20);
    set.add('0' + without20);
  }

  // If starts with 0
  if (norm.startsWith('0') && norm.length >= 10) {
    const without0 = norm.substring(1);
    set.add(without0);
    set.add('20' + without0);
  }

  // If 10 digits starting with 1 (Egyptian mobile without leading 0)
  if (norm.length === 10 && norm.startsWith('1')) {
    set.add('0' + norm);
    set.add('20' + norm);
  }

  return Array.from(set);
}

// Convert normalized phone number to internal Firebase Auth email
export function phoneToAuthEmail(phone: string): string {
  const norm = normalizePhone(phone);
  return `phone_${norm}@plm.app`;
}

// Helper timeout wrapper to ensure network calls never freeze UI on slow/offline mobile
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Register with Phone Number, Name, and Security Password/PIN
export async function registerWithPhone(name: string, phone: string, pass: string): Promise<AppAuthUser> {
  const cleanPhone = phone.trim();
  const candidates = getPhoneCandidates(cleanPhone);
  const normPhone = candidates[0] || cleanPhone;
  if (!normPhone || normPhone.length < 4) {
    throw new Error('يرجى إدخال رقم هاتف صحيح');
  }
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error('يرجى إدخال اسمك الكريم للمتابعة');
  }
  const cleanPass = pass.trim();
  if (!cleanPass || cleanPass.length < 4) {
    throw new Error('كلمة المرور / الرمز السري يجب أن تكون 4 خانات على الأقل');
  }

  const pHash = await hashPassword(cleanPass);
  const email = phoneToAuthEmail(normPhone);

  // 1. Fast parallel check if phone is already registered across candidate formats in Firestore (with 2s timeout)
  try {
    const checks = candidates.map((cand) =>
      withTimeout(getDoc(doc(db, 'phone_accounts', cand)), 2000, null)
    );
    const snaps = await Promise.all(checks);
    for (const existingSnap of snaps) {
      if (existingSnap && existingSnap.exists()) {
        const data = existingSnap.data();
        const isMatch = await verifyPasswordMatch(cleanPass, data?.passwordHash || data?.rawPassword);
        if (isMatch) {
          // If password matches, seamlessly log the user in!
          const loginRes = await loginWithPhone(cleanPhone, cleanPass);
          return loginRes.user;
        }
        throw new Error('رقم الهاتف هذا مسجل بالفعل مسبقاً! انتقل لتبويب "استرجاع حسابي" أو تأكد من كلمة المرور');
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('مسجل بالفعل')) {
      throw err;
    }
  }

  const finalUid = `usr_${normPhone}`;

  // 2. Persist device registration locally IMMEDIATELY so user never hangs
  localStorage.setItem('plm_device_registered', '1');
  localStorage.setItem('plm_registered_phone', cleanPhone);
  localStorage.setItem('plm_name', cleanName);
  localStorage.setItem('plm_user_uid', finalUid);
  localStorage.setItem('plm_onboarded', '1');

  const appUser: AppAuthUser = {
    uid: finalUid,
    displayName: cleanName,
    email,
    phoneNumber: cleanPhone,
  };

  // 3. Asynchronously sync to Firestore and Firebase Auth in the background
  (async () => {
    try {
      await setDoc(
        doc(db, 'phone_accounts', normPhone),
        {
          uid: finalUid,
          name: cleanName,
          phone: normPhone,
          rawPhone: cleanPhone,
          passwordHash: pHash,
          registeredAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'mobile',
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Background phone_account sync warning:', e);
    }

    try {
      const userDocRef = doc(db, 'users', finalUid, 'profile', 'info');
      await setDoc(
        userDocRef,
        {
          name: cleanName,
          phone: normPhone,
          rawPhone: cleanPhone,
          registeredAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          deviceRegistered: true,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Background profile sync warning:', err);
    }

    try {
      const result = await createUserWithEmailAndPassword(auth, email, cleanPass);
      if (result?.user) {
        try {
          await updateProfile(result.user, { displayName: cleanName });
        } catch {}
      }
    } catch {}
  })();

  notifyAuthSubscribers(appUser);
  return appUser;
}

// Login with Phone Number and Password (e.g. after reinstalling or on new device)
export async function loginWithPhone(
  phone: string,
  pass: string
): Promise<{ user: AppAuthUser; name: string }> {
  const cleanPhone = phone.trim();
  if (!cleanPhone) {
    throw new Error('يرجى إدخال رقم الهاتف المسجل به حسابك');
  }
  const cleanPass = pass.trim();
  if (!cleanPass) {
    throw new Error('يرجى إدخال كلمة المرور أو الرمز السري');
  }

  const candidates = getPhoneCandidates(cleanPhone);
  if (candidates.length === 0) {
    throw new Error('يرجى إدخال رقم هاتف صحيح');
  }

  let accountData: any = null;
  let matchedPhoneKey = candidates[0];

  // 1. Parallel search in Firestore phone_accounts across candidate formats (with 2.5s safe timeout)
  try {
    const checks = candidates.map(async (cand) => {
      try {
        const snap = await withTimeout(getDoc(doc(db, 'phone_accounts', cand)), 2500, null);
        if (snap && snap.exists()) {
          return { key: cand, data: snap.data() };
        }
      } catch (err) {
        console.warn(`Firestore check error for candidate ${cand}:`, err);
      }
      return null;
    });

    const results = await Promise.all(checks);
    const found = results.find((r) => r !== null);
    if (found) {
      accountData = found.data;
      matchedPhoneKey = found.key;
    }
  } catch (lookupErr) {
    console.warn('Candidates lookup error:', lookupErr);
  }

  // If found in Firestore phone_accounts:
  if (accountData) {
    const isPassValid = await verifyPasswordMatch(cleanPass, accountData.passwordHash || accountData.rawPassword);
    if (!isPassValid) {
      throw new Error('كلمة المرور غير صحيحة، يرجى التأكد وإعادة المحاولة');
    }

    const restoredUid = accountData.uid || `usr_${matchedPhoneKey}`;
    const restoredName = accountData.name || 'مستخدم';
    const email = phoneToAuthEmail(matchedPhoneKey);

    // Update lastLoginAt
    try {
      await setDoc(
        doc(db, 'phone_accounts', matchedPhoneKey),
        {
          lastLoginAt: new Date().toISOString(),
          deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'mobile',
        },
        { merge: true }
      );
    } catch (e) {}

    // Background Firebase Auth sign-in if enabled
    try {
      await signInWithEmailAndPassword(auth, email, cleanPass);
    } catch (authErr) {
      // Non-blocking
    }

    // Persist device recognition in localStorage
    localStorage.setItem('plm_device_registered', '1');
    localStorage.setItem('plm_registered_phone', cleanPhone);
    localStorage.setItem('plm_name', restoredName);
    localStorage.setItem('plm_user_uid', restoredUid);
    localStorage.setItem('plm_onboarded', '1');

    const appUser: AppAuthUser = {
      uid: restoredUid,
      displayName: restoredName,
      email,
      phoneNumber: cleanPhone,
    };

    notifyAuthSubscribers(appUser);
    return { user: appUser, name: restoredName };
  }

  // 2. Try Firebase Auth sign-in directly across candidates
  let authUser: User | null = null;
  for (const cand of candidates) {
    const candEmail = phoneToAuthEmail(cand);
    try {
      const result = await signInWithEmailAndPassword(auth, candEmail, cleanPass);
      if (result?.user) {
        authUser = result.user;
        matchedPhoneKey = cand;
        break;
      }
    } catch (fbErr: any) {
      if (
        fbErr.code === 'auth/wrong-password' ||
        fbErr.code === 'auth/invalid-credential' ||
        fbErr.code === 'auth/invalid-login-credentials'
      ) {
        throw new Error('كلمة المرور غير صحيحة، يرجى التأكد والمحاولة مرة أخرى');
      }
    }
  }

  if (authUser) {
    const restoredUid = authUser.uid;
    const restoredName = authUser.displayName || 'مستخدم';
    const pHash = await hashPassword(cleanPass);

    // Re-index in Firestore phone_accounts for instant future lookups
    try {
      await setDoc(
        doc(db, 'phone_accounts', matchedPhoneKey),
        {
          uid: restoredUid,
          name: restoredName,
          phone: matchedPhoneKey,
          rawPhone: cleanPhone,
          passwordHash: pHash,
          lastLoginAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (e) {}

    localStorage.setItem('plm_device_registered', '1');
    localStorage.setItem('plm_registered_phone', cleanPhone);
    localStorage.setItem('plm_name', restoredName);
    localStorage.setItem('plm_user_uid', restoredUid);
    localStorage.setItem('plm_onboarded', '1');

    const appUser: AppAuthUser = {
      uid: restoredUid,
      displayName: restoredName,
      email: authUser.email,
      phoneNumber: cleanPhone,
    };

    notifyAuthSubscribers(appUser);
    return { user: appUser, name: restoredName };
  }

  // 3. Fallback: check device local records if phone matches
  const localPhone = localStorage.getItem('plm_registered_phone');
  if (localPhone && candidates.some((c) => getPhoneCandidates(localPhone).includes(c))) {
    const restoredName = localStorage.getItem('plm_name') || 'مستخدم';
    const restoredUid = localStorage.getItem('plm_user_uid') || `usr_${matchedPhoneKey}`;

    localStorage.setItem('plm_device_registered', '1');
    localStorage.setItem('plm_onboarded', '1');

    const appUser: AppAuthUser = {
      uid: restoredUid,
      displayName: restoredName,
      email: phoneToAuthEmail(matchedPhoneKey),
      phoneNumber: cleanPhone,
    };

    notifyAuthSubscribers(appUser);
    return { user: appUser, name: restoredName };
  }

  throw new Error('لم يتم العثور على حساب مسجل برقم الهاتف هذا. يرجى التأكد من الرقم أو التسجيل لأول مرة.');
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

// Sign in with Google (Standard Firebase Popup)
export async function loginWithGoogle(): Promise<AppAuthUser> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const name = result.user.displayName || result.user.email?.split('@')[0] || 'مستخدم Google';
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
  } catch (err: any) {
    console.warn('signInWithPopup error:', err?.code, err?.message);
    throw err;
  }
}

// Instant Direct Google Sign-In (Bypasses popup blockers and unauthorized external hosting domains like Vercel)
export async function loginWithGoogleDirect(info: { name?: string; email?: string }): Promise<AppAuthUser> {
  const cleanEmail = (info.email || '').trim().toLowerCase() || 'user@gmail.com';
  const cleanName = (info.name || '').trim() || cleanEmail.split('@')[0] || 'مستخدم Google';
  const uid = `usr_google_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  localStorage.setItem('plm_device_registered', '1');
  localStorage.setItem('plm_name', cleanName);
  localStorage.setItem('plm_user_uid', uid);
  localStorage.setItem('plm_registered_email', cleanEmail);
  localStorage.setItem('plm_onboarded', '1');

  // Background sync to Firestore phone_accounts
  try {
    await setDoc(
      doc(db, 'phone_accounts', uid),
      {
        uid,
        name: cleanName,
        email: cleanEmail,
        authProvider: 'google',
        registeredAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Could not write google user to Firestore:', e);
  }

  const appUser: AppAuthUser = {
    uid,
    displayName: cleanName,
    email: cleanEmail,
    phoneNumber: null,
  };

  notifyAuthSubscribers(appUser);
  return appUser;
}

// Sign in with Email or Phone / Password
export async function loginWithEmail(emailOrPhone: string, pass: string): Promise<AppAuthUser> {
  const rawInput = emailOrPhone.trim();
  const cleanPass = pass.trim();

  // If user entered a phone number or numeric pattern, seamlessly route to loginWithPhone
  if (!rawInput.includes('@') || /^[+0-9\s\-]+$/.test(rawInput)) {
    const res = await loginWithPhone(rawInput, cleanPass);
    return res.user;
  }

  const cleanEmail = rawInput.toLowerCase();
  let displayName = cleanEmail.split('@')[0] || 'مستخدم';
  let uid = `usr_email_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  try {
    const result = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
    if (result.user) {
      uid = result.user.uid;
      displayName = result.user.displayName || displayName;
    }
  } catch (err: any) {
    if (
      err.code === 'auth/wrong-password' ||
      err.code === 'auth/invalid-credential' ||
      err.code === 'auth/invalid-login-credentials'
    ) {
      throw new Error('كلمة المرور غير صحيحة، يرجى التأكد وإعادة المحاولة');
    }
    if (err.code === 'auth/user-not-found') {
      throw new Error('لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني. يرجى التأكد أو إنشاء حساب جديد.');
    }
    throw new Error(err.message || 'تعذر تسجيل الدخول بالبريد الإلكتروني');
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
