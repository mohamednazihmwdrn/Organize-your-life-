import {
  Account,
  Transaction,
  Debt,
  DebtPayment,
  Installment,
  InstallmentPayment,
  Bill,
  Subscription,
  Reminder,
  Goal,
  DocumentItem,
  Budget,
  SupportTicket,
  SubscriptionCode,
} from '../types';
import { uid, nowISO } from './utils';
import { auth, db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';

const DB_NAME = 'PersonalLifeManagerDB';
const DB_VERSION = 4;
const STORES = [
  'accounts',
  'transactions',
  'debts',
  'debtPayments',
  'installments',
  'installmentPayments',
  'bills',
  'subscriptions',
  'reminders',
  'goals',
  'documents',
  'budgets',
  'tickets',
  'codes',
];

let idbInstance: IDBDatabase | null = null;

export function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (idbInstance) {
      return resolve(idbInstance);
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const d = (e.target as IDBOpenDBRequest).result;
      STORES.forEach((s) => {
        if (!d.objectStoreNames.contains(s)) {
          d.createObjectStore(s, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = (e: Event) => {
      idbInstance = (e.target as IDBOpenDBRequest).result;
      resolve(idbInstance);
    };
    req.onerror = () => reject(req.error);
  });
}

// Check if user is currently authenticated or registered on this device
export function getCurrentUserId(): string | null {
  if (auth.currentUser) return auth.currentUser.uid;
  const localUid = localStorage.getItem('plm_user_uid');
  if (localUid) return localUid;
  return null;
}

// Fetch all documents from a store (either from user's isolated Firestore subcollection or local IndexedDB)
export async function dbAll<T>(storeName: string): Promise<T[]> {
  const userId = getCurrentUserId();
  if (userId) {
    try {
      const colRef = collection(db, 'users', userId, storeName);
      const snap = await getDocs(colRef);
      const items: T[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as unknown as T);
      });
      return items;
    } catch (e) {
      console.warn(`Error fetching ${storeName} from Firestore, falling back to local:`, e);
    }
  }

  // Fallback to IndexedDB (Guest/Offline without cloud profile)
  const idb = await openIndexedDB();
  return new Promise((res, rej) => {
    const tx = idb.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => res((req.result as T[]) || []);
    req.onerror = () => rej(req.error);
  });
}

// Fetch a single document
export async function dbGet<T>(storeName: string, id: string): Promise<T | undefined> {
  const userId = getCurrentUserId();
  if (userId) {
    try {
      const docRef = doc(db, 'users', userId, storeName, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as unknown as T;
      }
      return undefined;
    } catch (e) {
      console.warn(`Error fetching doc ${id} in ${storeName}:`, e);
    }
  }

  const idb = await openIndexedDB();
  return new Promise((res, rej) => {
    const tx = idb.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => res(req.result as T | undefined);
    req.onerror = () => rej(req.error);
  });
}

// Insert or Update document
export async function dbPut<T extends { id: string }>(storeName: string, item: T): Promise<T> {
  const userId = getCurrentUserId();
  if (userId) {
    try {
      const docRef = doc(db, 'users', userId, storeName, item.id);
      // Clean undefined properties before saving to Firestore
      const cleanData = JSON.parse(JSON.stringify(item));
      await setDoc(docRef, cleanData, { merge: true });
    } catch (e) {
      console.warn(`Error putting doc to Firestore:`, e);
    }
  }

  // Also write to local IndexedDB for dual safety
  const idb = await openIndexedDB();
  return new Promise((res, rej) => {
    const tx = idb.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(item);
    req.onsuccess = () => res(item);
    req.onerror = () => rej(req.error);
  });
}

// Delete document
export async function dbDel(storeName: string, id: string): Promise<void> {
  const userId = getCurrentUserId();
  if (userId) {
    try {
      const docRef = doc(db, 'users', userId, storeName, id);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn(`Error deleting doc from Firestore:`, e);
    }
  }

  const idb = await openIndexedDB();
  return new Promise((res, rej) => {
    const tx = idb.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).delete(id);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

// Clear store
export async function dbClear(storeName: string): Promise<void> {
  const userId = getCurrentUserId();
  if (userId) {
    try {
      const colRef = collection(db, 'users', userId, storeName);
      const snap = await getDocs(colRef);
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (e) {
      console.warn(`Error clearing store in Firestore:`, e);
    }
  }

  const idb = await openIndexedDB();
  return new Promise((res, rej) => {
    const tx = idb.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

// Migrate any existing local guest IndexedDB data to newly logged in user account
export async function migrateLocalDataToCloud(userId: string): Promise<void> {
  const idb = await openIndexedDB();
  for (const storeName of STORES) {
    const localItems = await new Promise<any[]>((res) => {
      const tx = idb.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });

    if (localItems.length > 0) {
      for (const item of localItems) {
        if (item.id) {
          const docRef = doc(db, 'users', userId, storeName, item.id);
          await setDoc(docRef, JSON.parse(JSON.stringify(item)), { merge: true });
        }
      }
    }
  }
}

// Clear all local stores (e.g. on logout to prevent data leak to other users on same device)
export async function clearLocalDatabase(): Promise<void> {
  const idb = await openIndexedDB();
  for (const storeName of STORES) {
    await new Promise<void>((res) => {
      const tx = idb.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = () => res();
      req.onerror = () => res();
    });
  }
}

// Alias for openDB to maintain backwards compatibility
export const openDB = openIndexedDB;

export async function ensureDefaultAccount(): Promise<Account[]> {
  const accs = await dbAll<Account>('accounts');
  if (!accs.length) {
    const def: Account = {
      id: uid(),
      name: 'الكاش',
      type: 'cash',
      openingBalance: 0,
      createdAt: nowISO(),
    };
    await dbPut('accounts', def);
    return [def];
  }
  return accs;
}

export async function getAccountBalance(accountId: string): Promise<number> {
  const acc = await dbGet<Account>('accounts', accountId);
  if (!acc) return 0;
  const txs = await dbAll<Transaction>('transactions');
  let b = Number(acc.openingBalance) || 0;
  txs.forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income' && t.accountId === accountId) b += amt;
    if (t.type === 'expense' && t.accountId === accountId) b -= amt;
    if (t.type === 'transfer') {
      if (t.fromAccountId === accountId) b -= amt;
      if (t.toAccountId === accountId) b += amt;
    }
  });
  return b;
}

export async function getAllBalances(): Promise<Record<string, number>> {
  const accs = await dbAll<Account>('accounts');
  const result: Record<string, number> = {};
  for (const a of accs) {
    result[a.id] = await getAccountBalance(a.id);
  }
  return result;
}

export async function getTotals(): Promise<{ income: number; expense: number; net: number }> {
  const txs = await dbAll<Transaction>('transactions');
  let income = 0;
  let expense = 0;
  txs.forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') income += amt;
    if (t.type === 'expense') expense += amt;
  });
  return { income, expense, net: income - expense };
}

export { STORES };
