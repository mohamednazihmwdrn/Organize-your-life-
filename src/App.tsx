import React, { useEffect, useState } from 'react';
import {
  PageId,
  CommercialConfig,
  Account,
  Transaction,
  Debt,
  Installment,
  Bill,
  Subscription,
  Reminder,
  Goal,
  DocumentItem,
  Budget,
  SupportTicket,
} from './types';
import {
  openDB,
  ensureDefaultAccount,
  dbAll,
  dbGet,
  dbPut,
  dbDel,
} from './lib/db';
import {
  getCommercialConfig,
  saveCommercialConfig,
  simplePinHash,
  todayISO,
  nowISO,
  num,
  uid,
  OWNER_PASSWORD,
} from './lib/utils';
import { User } from 'firebase/auth';
import { onAuthChange, logoutUser } from './lib/firebase';

// Components
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { ToastContainer, ToastMessage } from './components/ToastContainer';
import { Modal } from './components/Modal';
import { PinOverlay } from './components/PinOverlay';
import { OnboardingModal } from './components/OnboardingModal';
import { RegistrationGateModal } from './components/RegistrationGateModal';
import { AuthModal } from './components/AuthModal';
import { MobileInstallGuideModal } from './components/MobileInstallGuideModal';

// Views
import { DashboardView } from './views/DashboardView';
import { MoneyView } from './views/MoneyView';
import { ObligationsView } from './views/ObligationsView';
import { BillsView } from './views/BillsView';
import { SubscriptionsView } from './views/SubscriptionsView';
import { RemindersView } from './views/RemindersView';
import { GoalsView } from './views/GoalsView';
import { DocumentsView } from './views/DocumentsView';
import { BudgetsView } from './views/BudgetsView';
import { ReportsView } from './views/ReportsView';
import { PlansView } from './views/PlansView';
import { PromotionsView } from './views/PromotionsView';
import { LegalView } from './views/LegalView';
import { SettingsView } from './views/SettingsView';
import { OwnerPanelView } from './views/OwnerPanelView';

const expenseCats = [
  'طعام',
  'مواصلات',
  'منزل',
  'فواتير',
  'صحة',
  'تعليم',
  'ملابس',
  'ترفيه',
  'تسوق',
  'أقساط',
  'اشتراكات',
  'أخرى',
];
const incomeCats = [
  'راتب',
  'عمل إضافي',
  'بيع',
  'تحويل',
  'هدية',
  'استثمار',
  'أخرى',
];

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState<string>(
    localStorage.getItem('plm_name') || 'مستخدم'
  );
  const [userPhone, setUserPhone] = useState<string>(
    localStorage.getItem('plm_registered_phone') || ''
  );
  const [isDeviceRegistered, setIsDeviceRegistered] = useState<boolean>(
    localStorage.getItem('plm_device_registered') === '1'
  );
  const [theme, setTheme] = useState<string>(
    localStorage.getItem('plm_theme') || 'light'
  );
  const [showOnboarding, setShowOnboarding] = useState<boolean>(
    localStorage.getItem('plm_onboarded') !== '1'
  );
  const [showPinOverlay, setShowPinOverlay] = useState<boolean>(false);
  const [commercialConfig, setCommercialConfigState] = useState<CommercialConfig>(
    getCommercialConfig()
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Page title mapping
  const pageTitles: Record<PageId, string> = {
    dashboard: 'الرئيسية',
    money: 'المال والحسابات',
    obligations: 'الديون والأقساط',
    bills: 'الفواتير والاستحقاقات',
    subscriptions: 'الاشتراكات المتكررة',
    reminders: 'التذكيرات',
    goals: 'الأهداف المالية',
    documents: 'المستندات والضمانات',
    budgets: 'الميزانيات والتصنيفات',
    reports: 'التقارير والتحليلات',
    plans: 'الخطط والاشتراك',
    promotions: 'التطبيقات والخدمات',
    legal: 'الخصوصية والشروط',
    settings: 'الإعدادات والملف الشخصي',
    owner: 'لوحة تحكم المالك',
  };

  // Toast Helper
  const showToast = (
    text: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info'
  ) => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Initial Load & Security PIN Check
  useEffect(() => {
    async function initApp() {
      try {
        await openDB();
        const accs = await ensureDefaultAccount();
        setAccounts(accs);

        // Apply dark class
        document.body.classList.toggle('dark', theme === 'dark');

        // Check PIN lock
        const pinEnabled = localStorage.getItem('plm_pin_enabled') === '1';
        const unlocked = sessionStorage.getItem('plm_unlocked') === '1';
        if (pinEnabled && !unlocked) {
          setShowPinOverlay(true);
        }

        // Hash route check
        const hash = location.hash.replace('#', '') as PageId;
        if (hash && pageTitles[hash]) {
          if (hash === 'owner' && sessionStorage.getItem('plm_owner_unlocked') !== '1') {
            setCurrentPage('dashboard');
          } else {
            setCurrentPage(hash);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    initApp();

    // Subscribe to Firebase Auth state changes
    const unsub = onAuthChange(async (user) => {
      setCurrentUser(user);
      if (user) {
        const dName = user.displayName || user.email?.split('@')[0] || 'عميل';
        setUserName(dName);
        localStorage.setItem('plm_name', dName);
        setIsDeviceRegistered(true);
        if (user.email && user.email.startsWith('phone_')) {
          const ph = user.email.replace('phone_', '').replace('@plm.app', '');
          setUserPhone(ph);
          localStorage.setItem('plm_registered_phone', ph);
        }
      }
      try {
        const accs = await ensureDefaultAccount();
        setAccounts(accs);
      } catch (e) {
        console.error(e);
      }
      setRefreshTrigger((prev) => prev + 1);
    });

    return () => unsub();
  }, []);

  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setIsDeviceRegistered(false);
      setUserPhone('');
      setUserName('مستخدم');
      setShowAuthModal(false);
      setSidebarOpen(false);
      handleNavigate('dashboard');
      showToast('تم تسجيل الخروج من هذا الجهاز. يرجى تسجيل الدخول للعودة لحسابك.', 'info');
      triggerRefresh();
    } catch (err: any) {
      showToast('حدث خطأ أثناء تسجيل الخروج', 'error');
    }
  };

  const handleRegistrationSuccess = (registeredName: string, registeredPhone: string) => {
    setUserName(registeredName);
    setUserPhone(registeredPhone);
    setIsDeviceRegistered(true);
    setShowOnboarding(false);
    triggerRefresh();
  };

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
    dbAll<Account>('accounts').then(setAccounts);
  };

  // Theme Toggle
  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('plm_theme', next);
    document.body.classList.toggle('dark', next === 'dark');
  };

  // Navigation Handler
  const handleNavigate = (page: PageId) => {
    if (page === 'owner' && sessionStorage.getItem('plm_owner_unlocked') !== '1') {
      showToast('لوحة تحكم المالك مغلقة', 'error');
      return;
    }
    setCurrentPage(page);
    location.hash = '#' + page;
    setSidebarOpen(false);
  };

  const handleUpdateUserName = (name: string) => {
    setUserName(name);
    localStorage.setItem('plm_name', name);
  };

  const handleStartOnboarding = (name: string) => {
    handleUpdateUserName(name);
    localStorage.setItem('plm_onboarded', '1');
    setShowOnboarding(false);
    showToast(`أهلاً بك 👋 ${name}`, 'success');
  };

  // ---------------- MODALS STATE ----------------
  const [modalState, setModalState] = useState<{
    type: string | null;
    id?: string;
    data?: any;
  }>({ type: null });

  const closeModal = () => setModalState({ type: null });

  // 1. Account Modal State & Handlers
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'cash' | 'bank' | 'wallet' | 'card'>('cash');
  const [accountOpening, setAccountOpening] = useState('0');

  const openAccountModal = async (id?: string) => {
    if (id) {
      const acc = await dbGet<Account>('accounts', id);
      if (acc) {
        setAccountName(acc.name);
        setAccountType(acc.type);
        setAccountOpening(String(acc.openingBalance));
      }
    } else {
      setAccountName('');
      setAccountType('cash');
      setAccountOpening('0');
    }
    setModalState({ type: 'account', id });
  };

  const handleSaveAccount = async () => {
    const name = accountName.trim();
    if (!name) return showToast('اكتب اسم الحساب أولاً', 'error');
    const existing = modalState.id ? await dbGet<Account>('accounts', modalState.id) : null;

    const item: Account = {
      id: modalState.id || uid(),
      name,
      type: accountType,
      openingBalance: num(accountOpening),
      createdAt: existing?.createdAt || nowISO(),
    };
    await dbPut('accounts', item);
    closeModal();
    showToast(modalState.id ? 'تم تعديل الحساب' : 'تمت إضافة الحساب بنجاح', 'success');
    triggerRefresh();
  };

  // 2. Transaction Modal State & Handlers
  const [txType, setTxType] = useState<'income' | 'expense'>('expense');
  const [txTitle, setTxTitle] = useState('');
  const [txCategory, setTxCategory] = useState('طعام');
  const [txAmount, setTxAmount] = useState('');
  const [txDate, setTxDate] = useState(todayISO());
  const [txAccount, setTxAccount] = useState('');
  const [txNote, setTxNote] = useState('');

  const openTransactionModal = async (type: 'income' | 'expense' = 'expense', id?: string) => {
    setTxType(type);
    const accs = await dbAll<Account>('accounts');
    setAccounts(accs);
    const defaultAcc = accs[0]?.id || '';

    if (id) {
      const t = await dbGet<Transaction>('transactions', id);
      if (t) {
        setTxType(t.type === 'income' ? 'income' : 'expense');
        setTxTitle(t.title);
        setTxCategory(t.category);
        setTxAmount(String(t.amount));
        setTxDate(t.date);
        setTxAccount(t.accountId);
        setTxNote(t.notes || '');
      }
    } else {
      setTxTitle('');
      setTxCategory(type === 'income' ? incomeCats[0] : expenseCats[0]);
      setTxAmount('');
      setTxDate(todayISO());
      setTxAccount(defaultAcc);
      setTxNote('');
    }
    setModalState({ type: 'transaction', id });
  };

  const handleSaveTransaction = async () => {
    const title = txTitle.trim();
    const amount = num(txAmount);
    if (!title || amount <= 0 || !txAccount) {
      return showToast('راجع عنوان العملية والمبلغ والحساب الخيار', 'error');
    }
    const existing = modalState.id ? await dbGet<Transaction>('transactions', modalState.id) : null;

    const item: Transaction = {
      id: modalState.id || uid(),
      type: txType,
      title,
      category: txCategory,
      amount,
      date: txDate,
      accountId: txAccount,
      notes: txNote.trim(),
      createdAt: existing?.createdAt || nowISO(),
    };
    await dbPut('transactions', item);
    closeModal();
    showToast(modalState.id ? 'تم تعديل العملية' : 'تم تسجل العملية بنجاح', 'success');
    triggerRefresh();
  };

  // 3. Debt Modal State & Handlers
  const [debtPerson, setDebtPerson] = useState('');
  const [debtDir, setDebtDir] = useState<'owe' | 'lent'>('owe');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtPaid, setDebtPaid] = useState('0');
  const [debtDate, setDebtDate] = useState(todayISO());
  const [debtNotes, setDebtNotes] = useState('');

  const openDebtModal = async (id?: string) => {
    if (id) {
      const d = await dbGet<Debt>('debts', id);
      if (d) {
        setDebtPerson(d.person);
        setDebtDir(d.direction);
        setDebtAmount(String(d.amount));
        setDebtPaid(String(d.paidAmount));
        setDebtDate(d.dueDate);
        setDebtNotes(d.notes || '');
      }
    } else {
      setDebtPerson('');
      setDebtDir('owe');
      setDebtAmount('');
      setDebtPaid('0');
      setDebtDate(todayISO());
      setDebtNotes('');
    }
    setModalState({ type: 'debt', id });
  };

  const handleSaveDebt = async () => {
    const person = debtPerson.trim();
    const amount = num(debtAmount);
    const paid = Math.min(amount, num(debtPaid));
    if (!person || amount <= 0) {
      return showToast('راجع اسم الشخص والمبلغ', 'error');
    }
    const existing = modalState.id ? await dbGet<Debt>('debts', modalState.id) : null;

    const item: Debt = {
      id: modalState.id || uid(),
      person,
      direction: debtDir,
      amount,
      paidAmount: paid,
      dueDate: debtDate,
      status: paid >= amount ? 'paid' : 'open',
      notes: debtNotes.trim(),
      createdAt: existing?.createdAt || nowISO(),
    };
    await dbPut('debts', item);
    closeModal();
    showToast('تم حفظ سجل الدين بنجاح', 'success');
    triggerRefresh();
  };

  // Pay Debt Modal
  const [payDebtAmount, setPayDebtAmount] = useState('');
  const [payDebtAcc, setPayDebtAcc] = useState('');
  const [payDebtDate, setPayDebtDate] = useState(todayISO());

  const openPayDebtModal = async (id: string) => {
    const d = await dbGet<Debt>('debts', id);
    if (!d) return;
    const remaining = Math.max(0, num(d.amount) - num(d.paidAmount));
    if (remaining <= 0) {
      return showToast('هذا الدين مكتمل السداد بالفعل', 'info');
    }
    const accs = await dbAll<Account>('accounts');
    setAccounts(accs);
    setPayDebtAmount(String(remaining));
    setPayDebtAcc(accs[0]?.id || '');
    setPayDebtDate(todayISO());
    setModalState({ type: 'payDebt', id, data: d });
  };

  const handleConfirmPayDebt = async () => {
    const d: Debt = modalState.data;
    const amount = Math.min(num(payDebtAmount), num(d.amount) - num(d.paidAmount));
    if (amount <= 0 || !payDebtAcc) {
      return showToast('راجع قيمة السداد والحساب', 'error');
    }

    const txId = uid();
    await dbPut('transactions', {
      id: txId,
      type: d.direction === 'owe' ? 'expense' : 'income',
      title: `سداد دين: ${d.person}`,
      category: 'ديون',
      amount,
      date: payDebtDate,
      accountId: payDebtAcc,
      refType: 'debtPayment',
      refId: d.id,
      createdAt: nowISO(),
    });

    await dbPut('debtPayments', {
      id: uid(),
      debtId: d.id,
      transactionId: txId,
      amount,
      date: payDebtDate,
    });

    const newPaid = num(d.paidAmount) + amount;
    d.paidAmount = newPaid;
    d.status = newPaid >= num(d.amount) ? 'paid' : 'open';
    await dbPut('debts', d);

    closeModal();
    showToast('تم تسجيل سداد الدين وتحديث الحسابات بنجاح', 'success');
    triggerRefresh();
  };

  // 4. Installment Modal
  const [instName, setInstName] = useState('');
  const [instProvider, setInstProvider] = useState('');
  const [instTotal, setInstTotal] = useState('');
  const [instAmount, setInstAmount] = useState('');
  const [instCount, setInstCount] = useState('1');
  const [instPaid, setInstPaid] = useState('0');
  const [instDate, setInstDate] = useState(todayISO());
  const [instFreq, setInstFreq] = useState(30);
  const [instAccount, setInstAccount] = useState('');
  const [instNotes, setInstNotes] = useState('');

  const openInstallmentModal = async (id?: string) => {
    const accs = await dbAll<Account>('accounts');
    setAccounts(accs);
    const defaultAcc = accs[0]?.id || '';

    if (id) {
      const i = await dbGet<Installment>('installments', id);
      if (i) {
        setInstName(i.name);
        setInstProvider(i.provider);
        setInstTotal(String(i.totalAmount));
        setInstAmount(String(i.installmentAmount));
        setInstCount(String(i.totalInstallments));
        setInstPaid(String(i.paidInstallments));
        setInstDate(i.firstDueDate);
        setInstFreq(i.frequencyDays);
        setInstAccount(i.accountId);
        setInstNotes(i.notes || '');
      }
    } else {
      setInstName('');
      setInstProvider('');
      setInstTotal('');
      setInstAmount('');
      setInstCount('1');
      setInstPaid('0');
      setInstDate(todayISO());
      setInstFreq(30);
      setInstAccount(defaultAcc);
      setInstNotes('');
    }
    setModalState({ type: 'installment', id });
  };

  const handleSaveInstallment = async () => {
    const name = instName.trim();
    const total = num(instTotal);
    const amount = num(instAmount);
    const count = Math.max(1, parseInt(instCount, 10) || 1);
    const paid = Math.min(count, Math.max(0, parseInt(instPaid, 10) || 0));

    if (!name || total <= 0 || amount <= 0) {
      return showToast('راجع اسم القسط والمبالغ', 'error');
    }
    const existing = modalState.id ? await dbGet<Installment>('installments', modalState.id) : null;

    const item: Installment = {
      id: modalState.id || uid(),
      name,
      provider: instProvider.trim(),
      totalAmount: total,
      installmentAmount: amount,
      totalInstallments: count,
      paidInstallments: paid,
      firstDueDate: instDate,
      frequencyDays: Number(instFreq),
      accountId: instAccount,
      notes: instNotes.trim(),
      createdAt: existing?.createdAt || nowISO(),
    };
    await dbPut('installments', item);
    closeModal();
    showToast('تم حفظ سجل القسط بنجاح', 'success');
    triggerRefresh();
  };

  // Pay Installment Modal
  const [payInstAmount, setPayInstAmount] = useState('');
  const [payInstAcc, setPayInstAcc] = useState('');
  const [payInstDate, setPayInstDate] = useState(todayISO());

  const openPayInstallmentModal = async (id: string) => {
    const inst = await dbGet<Installment>('installments', id);
    if (!inst) return;
    if (num(inst.paidInstallments) >= num(inst.totalInstallments)) {
      return showToast('هذا القسط ممتنع وسدد بالكامل', 'info');
    }
    const accs = await dbAll<Account>('accounts');
    setAccounts(accs);
    setPayInstAmount(String(inst.installmentAmount));
    setPayInstAcc(inst.accountId || accs[0]?.id || '');
    setPayInstDate(todayISO());
    setModalState({ type: 'payInstallment', id, data: inst });
  };

  const handleConfirmPayInstallment = async () => {
    const inst: Installment = modalState.data;
    const amount = num(payInstAmount);
    if (amount <= 0 || !payInstAcc) {
      return showToast('راجع قيمة القسط والحساب الخيار', 'error');
    }

    const txId = uid();
    await dbPut('transactions', {
      id: txId,
      type: 'expense',
      title: `دفع قسط: ${inst.name}`,
      category: 'أقساط',
      amount,
      date: payInstDate,
      accountId: payInstAcc,
      refType: 'installmentPayment',
      refId: inst.id,
      createdAt: nowISO(),
    });

    await dbPut('installmentPayments', {
      id: uid(),
      installmentId: inst.id,
      transactionId: txId,
      amount,
      date: payInstDate,
    });

    inst.paidInstallments = Math.min(
      num(inst.totalInstallments),
      num(inst.paidInstallments) + 1
    );
    await dbPut('installments', inst);

    closeModal();
    showToast('تم دفع القسط وتسجيل المصروف بنجاح', 'success');
    triggerRefresh();
  };

  // 5. Bill Modal State & Handlers
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDue, setBillDue] = useState(todayISO());
  const [billFreq, setBillFreq] = useState('مرة واحدة');
  const [billAcc, setBillAcc] = useState('');
  const [billNotes, setBillNotes] = useState('');

  const openBillModal = async (id?: string) => {
    const accs = await dbAll<Account>('accounts');
    setAccounts(accs);
    const defaultAcc = accs[0]?.id || '';

    if (id) {
      const b = await dbGet<Bill>('bills', id);
      if (b) {
        setBillName(b.name);
        setBillAmount(String(b.amount));
        setBillDue(b.dueDate);
        setBillFreq(b.frequency);
        setBillAcc(b.accountId);
        setBillNotes(b.notes || '');
      }
    } else {
      setBillName('');
      setBillAmount('');
      setBillDue(todayISO());
      setBillFreq('مرة واحدة');
      setBillAcc(defaultAcc);
      setBillNotes('');
    }
    setModalState({ type: 'bill', id });
  };

  const handleSaveBill = async () => {
    const name = billName.trim();
    const amount = num(billAmount);
    if (!name || amount <= 0) {
      return showToast('راجع اسم الفاتورة وقيمتها', 'error');
    }
    const existing = modalState.id ? await dbGet<Bill>('bills', modalState.id) : null;

    const item: Bill = {
      id: modalState.id || uid(),
      name,
      amount,
      dueDate: billDue,
      frequency: billFreq,
      accountId: billAcc,
      status: existing?.status || 'unpaid',
      notes: billNotes.trim(),
      createdAt: existing?.createdAt || nowISO(),
    };
    await dbPut('bills', item);
    closeModal();
    showToast('تم حفظ الفاتورة بنجاح', 'success');
    triggerRefresh();
  };

  // Pay Bill Modal
  const [payBillAmount, setPayBillAmount] = useState('');
  const [payBillAcc, setPayBillAcc] = useState('');
  const [payBillDate, setPayBillDate] = useState(todayISO());

  const openPayBillModal = async (id: string) => {
    const b = await dbGet<Bill>('bills', id);
    if (!b) return;
    const accs = await dbAll<Account>('accounts');
    setAccounts(accs);
    setPayBillAmount(String(b.amount));
    setPayBillAcc(b.accountId || accs[0]?.id || '');
    setPayBillDate(todayISO());
    setModalState({ type: 'payBill', id, data: b });
  };

  const handleConfirmPayBill = async () => {
    const b: Bill = modalState.data;
    const amount = num(payBillAmount);
    if (amount <= 0 || !payBillAcc) {
      return showToast('راجع مبلغ الفاتورة وحساب السداد', 'error');
    }

    await dbPut('transactions', {
      id: uid(),
      type: 'expense',
      title: `دفع فاتورة: ${b.name}`,
      category: 'فواتير',
      amount,
      date: payBillDate,
      accountId: payBillAcc,
      refType: 'billPayment',
      refId: b.id,
      createdAt: nowISO(),
    });

    b.status = 'paid';
    b.paidAt = payBillDate;
    await dbPut('bills', b);

    closeModal();
    showToast('تم دفع الفاتورة وتسجيل المصروف بنجاح', 'success');
    triggerRefresh();
  };

  // 6. Subscription Modal
  const [subName, setSubName] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subFreq, setSubFreq] = useState<'شهري' | 'سنوي'>('شهري');
  const [subRenew, setSubRenew] = useState(todayISO());
  const [subAcc, setSubAcc] = useState('');
  const [subNotes, setSubNotes] = useState('');

  const openSubscriptionModal = async (id?: string) => {
    const accs = await dbAll<Account>('accounts');
    setAccounts(accs);
    const defaultAcc = accs[0]?.id || '';

    if (id) {
      const s = await dbGet<Subscription>('subscriptions', id);
      if (s) {
        setSubName(s.name);
        setSubAmount(String(s.amount));
        setSubFreq(s.frequency);
        setSubRenew(s.renewDate);
        setSubAcc(s.accountId);
        setSubNotes(s.notes || '');
      }
    } else {
      setSubName('');
      setSubAmount('');
      setSubFreq('شهري');
      setSubRenew(todayISO());
      setSubAcc(defaultAcc);
      setSubNotes('');
    }
    setModalState({ type: 'subscription', id });
  };

  const handleSaveSubscription = async () => {
    const name = subName.trim();
    const amount = num(subAmount);
    if (!name || amount <= 0) {
      return showToast('راجع اسم الاشتراك وقيمته', 'error');
    }
    const acc = accounts.find((a) => a.id === subAcc);
    const existing = modalState.id ? await dbGet<Subscription>('subscriptions', modalState.id) : null;

    const item: Subscription = {
      id: modalState.id || uid(),
      name,
      amount,
      frequency: subFreq,
      renewDate: subRenew,
      accountId: subAcc,
      accountName: acc?.name || '',
      notes: subNotes.trim(),
      createdAt: existing?.createdAt || nowISO(),
    };
    await dbPut('subscriptions', item);
    closeModal();
    showToast('تم حفظ الاشتراك بنجاح', 'success');
    triggerRefresh();
  };

  // 7. Reminder Modal
  const [remTitle, setRemTitle] = useState('');
  const [remDate, setRemDate] = useState(todayISO());
  const [remTime, setRemTime] = useState('09:00');
  const [remPriority, setRemPriority] = useState<'عاجل' | 'مهم' | 'عادي'>('عادي');
  const [remRepeat, setRemRepeat] = useState('مرة واحدة');
  const [remNotes, setRemNotes] = useState('');

  const openReminderModal = async (id?: string) => {
    if (id) {
      const r = await dbGet<Reminder>('reminders', id);
      if (r) {
        setRemTitle(r.title);
        setRemDate(r.date);
        setRemTime(r.time || '09:00');
        setRemPriority(r.priority);
        setRemRepeat(r.repeat || 'مرة واحدة');
        setRemNotes(r.notes || '');
      }
    } else {
      setRemTitle('');
      setRemDate(todayISO());
      setRemTime('09:00');
      setRemPriority('عادي');
      setRemRepeat('مرة واحدة');
      setRemNotes('');
    }
    setModalState({ type: 'reminder', id });
  };

  const handleSaveReminder = async () => {
    const title = remTitle.trim();
    if (!title) return showToast('اكتب عنوان التذكير', 'error');
    const existing = modalState.id ? await dbGet<Reminder>('reminders', modalState.id) : null;

    const item: Reminder = {
      id: modalState.id || uid(),
      title,
      date: remDate,
      time: remTime,
      priority: remPriority,
      repeat: remRepeat.trim(),
      notes: remNotes.trim(),
      completed: existing?.completed || false,
      createdAt: existing?.createdAt || nowISO(),
    };
    await dbPut('reminders', item);
    closeModal();
    showToast('تم حفظ التذكير بنجاح', 'success');
    triggerRefresh();
  };

  // 8. Goal Modal
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('0');
  const [goalDeadline, setGoalDeadline] = useState(todayISO());
  const [goalNotes, setGoalNotes] = useState('');

  const openGoalModal = async (id?: string) => {
    if (id) {
      const g = await dbGet<Goal>('goals', id);
      if (g) {
        setGoalName(g.name);
        setGoalTarget(String(g.target));
        setGoalCurrent(String(g.current));
        setGoalDeadline(g.deadline);
        setGoalNotes(g.notes || '');
      }
    } else {
      setGoalName('');
      setGoalTarget('');
      setGoalCurrent('0');
      setGoalDeadline(todayISO());
      setGoalNotes('');
    }
    setModalState({ type: 'goal', id });
  };

  const handleSaveGoal = async () => {
    const name = goalName.trim();
    const target = num(goalTarget);
    const current = Math.min(target, num(goalCurrent));
    if (!name || target <= 0) {
      return showToast('راجع اسم الهدف والمبلغ المستهدف', 'error');
    }
    const existing = modalState.id ? await dbGet<Goal>('goals', modalState.id) : null;

    const item: Goal = {
      id: modalState.id || uid(),
      name,
      target,
      current,
      deadline: goalDeadline,
      notes: goalNotes.trim(),
      createdAt: existing?.createdAt || nowISO(),
    };
    await dbPut('goals', item);
    closeModal();
    showToast('تم حفظ الهدف المالي بنجاح', 'success');
    triggerRefresh();
  };

  // 9. Document Modal
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('عقد');
  const [docIssue, setDocIssue] = useState(todayISO());
  const [docExpiry, setDocExpiry] = useState(todayISO());
  const [docNotes, setDocNotes] = useState('');

  const openDocumentModal = async (id?: string) => {
    if (id) {
      const d = await dbGet<DocumentItem>('documents', id);
      if (d) {
        setDocName(d.name);
        setDocType(d.type);
        setDocIssue(d.issueDate);
        setDocExpiry(d.expiryDate);
        setDocNotes(d.notes || '');
      }
    } else {
      setDocName('');
      setDocType('عقد');
      setDocIssue(todayISO());
      setDocExpiry(todayISO());
      setDocNotes('');
    }
    setModalState({ type: 'document', id });
  };

  const handleSaveDocument = async () => {
    const name = docName.trim();
    if (!name) return showToast('اكتب اسم المستند', 'error');
    const existing = modalState.id ? await dbGet<DocumentItem>('documents', modalState.id) : null;

    const item: DocumentItem = {
      id: modalState.id || uid(),
      name,
      type: docType,
      issueDate: docIssue,
      expiryDate: docExpiry,
      notes: docNotes.trim(),
      file: existing?.file || null,
      createdAt: existing?.createdAt || nowISO(),
    };
    await dbPut('documents', item);
    closeModal();
    showToast('تم حفظ المستند بنجاح', 'success');
    triggerRefresh();
  };

  // 10. Budget Modal
  const [budCat, setBudCat] = useState('طعام');
  const [budAmount, setBudAmount] = useState('');
  const [budNotes, setBudNotes] = useState('');

  const openBudgetModal = async (id?: string) => {
    if (id) {
      const b = await dbGet<Budget>('budgets', id);
      if (b) {
        setBudCat(b.category);
        setBudAmount(String(b.amount));
        setBudNotes(b.notes || '');
      }
    } else {
      setBudCat('طعام');
      setBudAmount('');
      setBudNotes('');
    }
    setModalState({ type: 'budget', id });
  };

  const handleSaveBudget = async () => {
    const amount = num(budAmount);
    if (amount <= 0) return showToast('اكتب المبلغ الأقصى للميزانية', 'error');
    const existing = modalState.id ? await dbGet<Budget>('budgets', modalState.id) : null;

    const item: Budget = {
      id: modalState.id || uid(),
      category: budCat,
      amount,
      notes: budNotes.trim(),
      createdAt: existing?.createdAt || nowISO(),
    };
    await dbPut('budgets', item);
    closeModal();
    showToast('تمت إضافة الميزانية بنجاح', 'success');
    triggerRefresh();
  };

  // 11. Owner Password Login Modal
  const [ownerPasswordInput, setOwnerPasswordInput] = useState('');

  const handleOpenOwnerLogin = () => {
    setOwnerPasswordInput('');
    setModalState({ type: 'ownerLogin' });
  };

  const handleVerifyOwnerLogin = () => {
    if (ownerPasswordInput.trim() === OWNER_PASSWORD) {
      sessionStorage.setItem('plm_owner_unlocked', '1');
      closeModal();
      handleNavigate('owner');
      showToast('أهلاً بك المالك الرسمِي! تم فتح لوحة التحكم بنجاح', 'success');
    } else {
      showToast('كلمة مرور المالك غير صحيحة', 'error');
    }
  };

  // 12. Support / Ticket Modal
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketPhone, setTicketPhone] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');

  const handleOpenReportIssueModal = () => {
    setTicketSubject('');
    setTicketPhone('');
    setTicketMessage('');
    setModalState({ type: 'reportIssue' });
  };

  const handleSubmitTicket = async () => {
    const subj = ticketSubject.trim();
    const phone = ticketPhone.trim();
    const msg = ticketMessage.trim();
    if (!subj || !phone || !msg) {
      return showToast('يرجى تعبئة جميع خانات الرسالة للتواصل', 'error');
    }

    const item: SupportTicket = {
      id: uid(),
      userName,
      userContact: phone,
      subject: subj,
      message: msg,
      status: 'open',
      createdAt: nowISO(),
    };
    await dbPut('tickets', item);
    closeModal();
    showToast('تم إرسال تذكرتك للمالك والمصمم بنجاح! سنراجعها فورًا.', 'success');
  };

  // Render current view
  const renderView = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <DashboardView
            userName={userName}
            refreshTrigger={refreshTrigger}
            onNavigate={handleNavigate}
            onOpenQuickAdd={() => setModalState({ type: 'quickAdd' })}
            onOpenTransaction={(type) => openTransactionModal(type)}
            onOpenDebt={() => openDebtModal()}
            onOpenReminder={() => openReminderModal()}
          />
        );
      case 'money':
        return (
          <MoneyView
            onOpenAccount={(id) => openAccountModal(id)}
            onOpenTransaction={(type, id) => openTransactionModal(type, id)}
            onShowToast={showToast}
            refreshTrigger={refreshTrigger}
          />
        );
      case 'obligations':
        return (
          <ObligationsView
            onOpenDebt={(id) => openDebtModal(id)}
            onOpenInstallment={(id) => openInstallmentModal(id)}
            onPayDebt={(id) => openPayDebtModal(id)}
            onPayInstallment={(id) => openPayInstallmentModal(id)}
            onShowToast={showToast}
            refreshTrigger={refreshTrigger}
          />
        );
      case 'bills':
        return (
          <BillsView
            onOpenBill={(id) => openBillModal(id)}
            onPayBill={(id) => openPayBillModal(id)}
            onShowToast={showToast}
            refreshTrigger={refreshTrigger}
          />
        );
      case 'subscriptions':
        return (
          <SubscriptionsView
            onOpenSubscription={(id) => openSubscriptionModal(id)}
            onShowToast={showToast}
            refreshTrigger={refreshTrigger}
          />
        );
      case 'reminders':
        return (
          <RemindersView
            onOpenReminder={(id) => openReminderModal(id)}
            onShowToast={showToast}
            refreshTrigger={refreshTrigger}
          />
        );
      case 'goals':
        return (
          <GoalsView
            onOpenGoal={(id) => openGoalModal(id)}
            onShowToast={showToast}
            refreshTrigger={refreshTrigger}
          />
        );
      case 'documents':
        return (
          <DocumentsView
            onOpenDocument={(id) => openDocumentModal(id)}
            onShowToast={showToast}
            refreshTrigger={refreshTrigger}
          />
        );
      case 'budgets':
        return (
          <BudgetsView
            onOpenBudget={(id) => openBudgetModal(id)}
            onShowToast={showToast}
            refreshTrigger={refreshTrigger}
          />
        );
      case 'reports':
        return <ReportsView />;
      case 'plans':
        return (
          <PlansView
            config={commercialConfig}
            onNavigate={handleNavigate}
            onShowToast={showToast}
            onReportIssue={handleOpenReportIssueModal}
          />
        );
      case 'promotions':
        return (
          <PromotionsView
            config={commercialConfig}
            onShowToast={showToast}
          />
        );
      case 'legal':
        return <LegalView config={commercialConfig} />;
      case 'settings':
        return (
          <SettingsView
            userName={userName}
            userPhone={userPhone}
            theme={theme}
            config={commercialConfig}
            currentUser={currentUser}
            onOpenAuthModal={() => setShowAuthModal(true)}
            onLogout={handleLogout}
            onUpdateUserName={handleUpdateUserName}
            onToggleTheme={handleToggleTheme}
            onNavigate={handleNavigate}
            onShowToast={showToast}
            onReportIssue={handleOpenReportIssueModal}
            onRefreshData={triggerRefresh}
            onOpenInstallModal={() => setShowInstallModal(true)}
          />
        );
      case 'owner':
        return (
          <OwnerPanelView
            config={commercialConfig}
            onSaveConfig={(cfg) => {
              setCommercialConfigState(cfg);
              saveCommercialConfig(cfg);
            }}
            onLogout={() => {
              sessionStorage.removeItem('plm_owner_unlocked');
              handleNavigate('dashboard');
              showToast('تم الخروج من لوحة المالك', 'info');
            }}
            onShowToast={showToast}
            onRefreshData={triggerRefresh}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="app">
      {/* Mandatory Registration Gate: user must provide Name + Phone on first use, recognized on this device thereafter */}
      <RegistrationGateModal
        show={!isDeviceRegistered && !currentUser}
        appName={commercialConfig.name}
        onSuccess={handleRegistrationSuccess}
        onShowToast={showToast}
      />

      <PinOverlay
        show={showPinOverlay}
        onSuccess={() => setShowPinOverlay(false)}
      />

      <Sidebar
        isOpen={sidebarOpen}
        currentPage={currentPage}
        userName={userName}
        config={commercialConfig}
        currentUser={currentUser}
        onNavigate={handleNavigate}
        onClose={() => setSidebarOpen(false)}
        onOwnerTapTrigger={handleOpenOwnerLogin}
        onOpenAuthModal={() => setShowAuthModal(true)}
        onLogout={handleLogout}
        onOpenInstallModal={() => setShowInstallModal(true)}
      />

      <main className="main">
        <Header
          currentPage={currentPage}
          pageTitle={pageTitles[currentPage] || 'الرئيسية'}
          todayText={new Intl.DateTimeFormat('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }).format(new Date())}
          currentUser={currentUser}
          onGoBack={() => handleNavigate('dashboard')}
          onOpenSidebar={() => setSidebarOpen(true)}
          onRefresh={triggerRefresh}
          onToggleTheme={handleToggleTheme}
          onQuickAdd={() => setModalState({ type: 'quickAdd' })}
          onOpenAuthModal={() => setShowAuthModal(true)}
          onOwnerTapTrigger={handleOpenOwnerLogin}
          onOpenInstallModal={() => setShowInstallModal(true)}
        />

        <section id="content" className="content">
          {renderView()}
        </section>
      </main>

      <BottomNav currentPage={currentPage} onNavigate={handleNavigate} />

      <ToastContainer toasts={toasts} />

      {/* ---------------- MODALS RENDERING ---------------- */}

      {/* Quick Add Modal */}
      <Modal
        show={modalState.type === 'quickAdd'}
        title="إضافة سريعة"
        onClose={closeModal}
      >
        <div className="quick-grid">
          <button
            type="button"
            className="quick"
            onClick={() => {
              closeModal();
              openTransactionModal('expense');
            }}
          >
            <span>💸</span>مصروف
          </button>
          <button
            type="button"
            className="quick"
            onClick={() => {
              closeModal();
              openTransactionModal('income');
            }}
          >
            <span>💵</span>دخل
          </button>
          <button
            type="button"
            className="quick"
            onClick={() => {
              closeModal();
              openDebtModal();
            }}
          >
            <span>🤝</span>دين
          </button>
          <button
            type="button"
            className="quick"
            onClick={() => {
              closeModal();
              openInstallmentModal();
            }}
          >
            <span>💳</span>قسط
          </button>
          <button
            type="button"
            className="quick"
            onClick={() => {
              closeModal();
              openBillModal();
            }}
          >
            <span>🧾</span>فاتورة
          </button>
          <button
            type="button"
            className="quick"
            onClick={() => {
              closeModal();
              openReminderModal();
            }}
          >
            <span>🔔</span>تذكير
          </button>
          <button
            type="button"
            className="quick"
            onClick={() => {
              closeModal();
              openGoalModal();
            }}
          >
            <span>🎯</span>هدف
          </button>
          <button
            type="button"
            className="quick"
            onClick={() => {
              closeModal();
              openDocumentModal();
            }}
          >
            <span>📂</span>مستند
          </button>
        </div>
      </Modal>

      {/* Account Modal */}
      <Modal
        show={modalState.type === 'account'}
        title={modalState.id ? 'تعديل الحساب' : 'إضافة حساب جديد'}
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveAccount}
            >
              حفظ
            </button>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              إلغاء
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>اسم الحساب</label>
            <input
              className="form-control"
              placeholder="مثال: البنك الأهلي / كاش"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>نوع الحساب</label>
            <select
              className="form-control"
              value={accountType}
              onChange={(e: any) => setAccountType(e.target.value)}
            >
              <option value="cash">كاش</option>
              <option value="bank">حساب بنكي</option>
              <option value="wallet">محفظة إلكترونية</option>
              <option value="card">بطاقة ائتمان</option>
            </select>
          </div>
          <div className="form-group">
            <label>الرصيد الافتتاحي</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={accountOpening}
              onChange={(e) => setAccountOpening(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Transaction Modal */}
      <Modal
        show={modalState.type === 'transaction'}
        title={
          modalState.id
            ? 'تعديل العملية'
            : txType === 'income'
            ? 'إضافة دخل جديد'
            : 'إضافة مصروف جديد'
        }
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveTransaction}
            >
              حفظ العملية
            </button>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              إلغاء
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>اسم العملية</label>
            <input
              className="form-control"
              placeholder={txType === 'income' ? 'مثال: راتب شهري' : 'مثال: مشتريات طعام'}
              value={txTitle}
              onChange={(e) => setTxTitle(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>التصنيف</label>
            <select
              className="form-control"
              value={txCategory}
              onChange={(e) => setTxCategory(e.target.value)}
            >
              {(txType === 'income' ? incomeCats : expenseCats).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>المبلغ</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              placeholder="0.00"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>التاريخ</label>
            <input
              type="date"
              className="form-control"
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>الحساب الخيار</label>
            <select
              className="form-control"
              value={txAccount}
              onChange={(e) => setTxAccount(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>ملاحظات (اختياري)</label>
            <input
              className="form-control"
              placeholder="تفاصيل إضافية..."
              value={txNote}
              onChange={(e) => setTxNote(e.target.value)}
            />
          </div>
        </div>
        <div className="form-group" style={{ marginTop: '12px' }}>
          <label>نوع العملية</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={`btn ${txType === 'income' ? 'btn-success' : 'btn-outline'}`}
              onClick={() => {
                setTxType('income');
                setTxCategory(incomeCats[0]);
              }}
            >
              💵 دخل
            </button>
            <button
              type="button"
              className={`btn ${txType === 'expense' ? 'btn-danger' : 'btn-outline'}`}
              onClick={() => {
                setTxType('expense');
                setTxCategory(expenseCats[0]);
              }}
            >
              💸 مصروف
            </button>
          </div>
        </div>
      </Modal>

      {/* Debt Modal */}
      <Modal
        show={modalState.type === 'debt'}
        title={modalState.id ? 'تعديل الدين' : 'إضافة سجل دين'}
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveDebt}
            >
              حفظ
            </button>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              إلغاء
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>اسم الشخص / الجهة</label>
            <input
              className="form-control"
              placeholder="مثال: أحمد محمود"
              value={debtPerson}
              onChange={(e) => setDebtPerson(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>اتجاه الدين</label>
            <select
              className="form-control"
              value={debtDir}
              onChange={(e: any) => setDebtDir(e.target.value)}
            >
              <option value="owe">عليّ — سأدفع له</option>
              <option value="lent">لي — سأحصل منه</option>
            </select>
          </div>
          <div className="form-group">
            <label>إجمالي قيمة الدين</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={debtAmount}
              onChange={(e) => setDebtAmount(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>المدفوع منه حالياً</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={debtPaid}
              onChange={(e) => setDebtPaid(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>تاريخ الاستحقاق المتوقع</label>
            <input
              type="date"
              className="form-control"
              value={debtDate}
              onChange={(e) => setDebtDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>ملاحظات</label>
            <input
              className="form-control"
              value={debtNotes}
              onChange={(e) => setDebtNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Pay Debt Modal */}
      <Modal
        show={modalState.type === 'payDebt'}
        title="سداد دفعة من الدين"
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmPayDebt}
            >
              تأكيد السداد
            </button>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              إلغاء
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>قيمة دفعة السداد</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={payDebtAmount}
              onChange={(e) => setPayDebtAmount(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>من الحساب الخيار</label>
            <select
              className="form-control"
              value={payDebtAcc}
              onChange={(e) => setPayDebtAcc(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>تاريخ السداد</label>
            <input
              type="date"
              className="form-control"
              value={payDebtDate}
              onChange={(e) => setPayDebtDate(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Installment Modal */}
      <Modal
        show={modalState.type === 'installment'}
        title={modalState.id ? 'تعديل القسط' : 'إضافة قسط جديد'}
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveInstallment}
            >
              حفظ القسط
            </button>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              إلغاء
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>اسم القسط</label>
            <input
              className="form-control"
              placeholder="مثال: قسط الأجهزة / سيارة"
              value={instName}
              onChange={(e) => setInstName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>الجهة المستفيدة</label>
            <input
              className="form-control"
              placeholder="مثال: الشركة / البنك"
              value={instProvider}
              onChange={(e) => setInstProvider(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>إجمالي المبلغ المطلوب</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={instTotal}
              onChange={(e) => setInstTotal(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>قيمة القسط الواحد</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={instAmount}
              onChange={(e) => setInstAmount(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>إجمالي عدد الأقساط</label>
            <input
              type="number"
              className="form-control"
              value={instCount}
              onChange={(e) => setInstCount(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>الأقساط المدفوعة حتى الآن</label>
            <input
              type="number"
              className="form-control"
              value={instPaid}
              onChange={(e) => setInstPaid(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>تاريخ أول استحقاق</label>
            <input
              type="date"
              className="form-control"
              value={instDate}
              onChange={(e) => setInstDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>تكرار القسط</label>
            <select
              className="form-control"
              value={instFreq}
              onChange={(e) => setInstFreq(Number(e.target.value))}
            >
              <option value={30}>شهري (كل 30 يوم)</option>
              <option value={7}>أسبوعي (كل 7 أيام)</option>
              <option value={14}>كل أسبوعين</option>
              <option value={90}>كل 3 أشهر</option>
            </select>
          </div>
          <div className="form-group">
            <label>حساب السداد الخيار</label>
            <select
              className="form-control"
              value={instAccount}
              onChange={(e) => setInstAccount(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>ملاحظات</label>
            <input
              className="form-control"
              value={instNotes}
              onChange={(e) => setInstNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Pay Installment Modal */}
      <Modal
        show={modalState.type === 'payInstallment'}
        title="دفع قسط جديد"
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmPayInstallment}
            >
              تأكيد الدفع
            </button>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              إلغاء
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>قيمة الدفعة</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={payInstAmount}
              onChange={(e) => setPayInstAmount(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>من الحساب الخيار</label>
            <select
              className="form-control"
              value={payInstAcc}
              onChange={(e) => setPayInstAcc(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>تاريخ الدفع</label>
            <input
              type="date"
              className="form-control"
              value={payInstDate}
              onChange={(e) => setPayInstDate(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Bill Modal */}
      <Modal
        show={modalState.type === 'bill'}
        title={modalState.id ? 'تعديل الفاتورة' : 'إضافة فاتورة جديدة'}
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveBill}
            >
              حفظ الفاتورة
            </button>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              إلغاء
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>اسم الفاتورة</label>
            <input
              className="form-control"
              placeholder="مثال: كهرباء / انترنت"
              value={billName}
              onChange={(e) => setBillName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>قيمة الفاتورة</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>تاريخ الاستحقاق</label>
            <input
              type="date"
              className="form-control"
              value={billDue}
              onChange={(e) => setBillDue(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>التكرار</label>
            <select
              className="form-control"
              value={billFreq}
              onChange={(e) => setBillFreq(e.target.value)}
            >
              <option value="مرة واحدة">مرة واحدة</option>
              <option value="شهري">شهري</option>
              <option value="سنوي">سنوي</option>
            </select>
          </div>
          <div className="form-group">
            <label>الحساب المفترض</label>
            <select
              className="form-control"
              value={billAcc}
              onChange={(e) => setBillAcc(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>ملاحظات</label>
            <input
              className="form-control"
              value={billNotes}
              onChange={(e) => setBillNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Pay Bill Modal */}
      <Modal
        show={modalState.type === 'payBill'}
        title="دفع الفاتورة"
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmPayBill}
            >
              تأكيد السداد
            </button>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              إلغاء
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>المبلغ المدفوع</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={payBillAmount}
              onChange={(e) => setPayBillAmount(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>من الحساب الخيار</label>
            <select
              className="form-control"
              value={payBillAcc}
              onChange={(e) => setPayBillAcc(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>تاريخ السداد</label>
            <input
              type="date"
              className="form-control"
              value={payBillDate}
              onChange={(e) => setPayBillDate(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Subscription Modal */}
      <Modal
        show={modalState.type === 'subscription'}
        title={modalState.id ? 'تعديل الاشتراك' : 'إضافة اشتراك جديد'}
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveSubscription}
            >
              حفظ
            </button>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              إلغاء
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>اسم الاشتراك</label>
            <input
              className="form-control"
              placeholder="مثال: نتفلكس / سيرفر"
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>السعر</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={subAmount}
              onChange={(e) => setSubAmount(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>التكرار</label>
            <select
              className="form-control"
              value={subFreq}
              onChange={(e: any) => setSubFreq(e.target.value)}
            >
              <option value="شهري">شهري</option>
              <option value="سنوي">سنوي</option>
            </select>
          </div>
          <div className="form-group">
            <label>تاريخ التجديد القادم</label>
            <input
              type="date"
              className="form-control"
              value={subRenew}
              onChange={(e) => setSubRenew(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>الحساب الخيار</label>
            <select
              className="form-control"
              value={subAcc}
              onChange={(e) => setSubAcc(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>ملاحظات</label>
            <input
              className="form-control"
              value={subNotes}
              onChange={(e) => setSubNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Reminder Modal */}
      <Modal
        show={modalState.type === 'reminder'}
        title={modalState.id ? 'تعديل التذكير' : 'إضافة تذكير جديد'}
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveReminder}
            >
              حفظ التذكير
            </button>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              إلغاء
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>عنوان التذكير</label>
            <input
              className="form-control"
              placeholder="مثال: موعد دفع الفاتورة"
              value={remTitle}
              onChange={(e) => setRemTitle(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>التاريخ</label>
            <input
              type="date"
              className="form-control"
              value={remDate}
              onChange={(e) => setRemDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>الوقت</label>
            <input
              type="text"
              className="form-control"
              placeholder="09:00"
              value={remTime}
              onChange={(e) => setRemTime(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>الأولوية</label>
            <select
              className="form-control"
              value={remPriority}
              onChange={(e: any) => setRemPriority(e.target.value)}
            >
              <option value="عاجل">🔴 عاجل جداً</option>
              <option value="مهم">🟠 مهم</option>
              <option value="عادي">🟢 عادي</option>
            </select>
          </div>
          <div className="form-group">
            <label>التكرار</label>
            <input
              className="form-control"
              placeholder="مرة واحدة / أسبوعي / شهري"
              value={remRepeat}
              onChange={(e) => setRemRepeat(e.target.value)}
            />
          </div>
          <div className="form-group full">
            <label>ملاحظات</label>
            <textarea
              className="form-control"
              value={remNotes}
              onChange={(e) => setRemNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Goal Modal */}
      <Modal
        show={modalState.type === 'goal'}
        title={modalState.id ? 'تعديل الهدف المالي' : 'إضافة هدف مالي'}
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveGoal}
            >
              حفظ
            </button>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              إلغاء
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>اسم الهدف</label>
            <input
              className="form-control"
              placeholder="مثال: شراء سيارة / ادخار سفر"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>المبلغ المستهدف الكامل</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={goalTarget}
              onChange={(e) => setGoalTarget(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>المبلغ المدخر حالياً</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={goalCurrent}
              onChange={(e) => setGoalCurrent(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>الموعد النهائي المستهدف</label>
            <input
              type="date"
              className="form-control"
              value={goalDeadline}
              onChange={(e) => setGoalDeadline(e.target.value)}
            />
          </div>
          <div className="form-group full">
            <label>ملاحظات</label>
            <textarea
              className="form-control"
              value={goalNotes}
              onChange={(e) => setGoalNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Document Modal */}
      <Modal
        show={modalState.type === 'document'}
        title={modalState.id ? 'تعديل المستند' : 'إضافة مستند / ضمان'}
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveDocument}
            >
              حفظ
            </button>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              إلغاء
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>اسم المستند / الضمان</label>
            <input
              className="form-control"
              placeholder="مثال: ضمان الشاشة / رخصة القيادة"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>نوع المستند</label>
            <select
              className="form-control"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              <option value="عقد">عقد</option>
              <option value="فاتورة">فاتورة شراء</option>
              <option value="إيصال">إيصال استلام</option>
              <option value="ضمان">ضمان جهاز</option>
              <option value="رخصة">رخصة قيادة / تسيير</option>
              <option value="شهادة">شهادة رسمية</option>
              <option value="أخرى">أخرى</option>
            </select>
          </div>
          <div className="form-group">
            <label>تاريخ الإصدار</label>
            <input
              type="date"
              className="form-control"
              value={docIssue}
              onChange={(e) => setDocIssue(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>تاريخ الانتهاء</label>
            <input
              type="date"
              className="form-control"
              value={docExpiry}
              onChange={(e) => setDocExpiry(e.target.value)}
            />
          </div>
          <div className="form-group full">
            <label>ملاحظات</label>
            <textarea
              className="form-control"
              value={docNotes}
              onChange={(e) => setDocNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Budget Modal */}
      <Modal
        show={modalState.type === 'budget'}
        title={modalState.id ? 'تعديل الميزانية' : 'إضافة ميزانية جديدة'}
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveBudget}
            >
              حفظ
            </button>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              إلغاء
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>التصنيف</label>
            <select
              className="form-control"
              value={budCat}
              onChange={(e) => setBudCat(e.target.value)}
            >
              {expenseCats.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>الحد الشهري الأقصى</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              value={budAmount}
              onChange={(e) => setBudAmount(e.target.value)}
            />
          </div>
          <div className="form-group full">
            <label>ملاحظات</label>
            <input
              className="form-control"
              value={budNotes}
              onChange={(e) => setBudNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Owner Password Login Modal */}
      <Modal
        show={modalState.type === 'ownerLogin'}
        title="🔐 فتح لوحة تحكم المالك والمصمم"
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleVerifyOwnerLogin}
            >
              دخول
            </button>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              إلغاء
            </button>
          </>
        }
      >
        <div className="form-group">
          <label>كلمة مرور المالك الخاصة</label>
          <input
            type="password"
            className="form-control"
            placeholder="أدخل كلمة المرور السرية..."
            value={ownerPasswordInput}
            onChange={(e) => setOwnerPasswordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleVerifyOwnerLogin();
            }}
          />
          <p className="muted" style={{ fontSize: '11px', marginTop: '8px', lineHeight: 1.8 }}>
            هذه اللوحة خاصة بمالك التطبيق الرسمِي لتوليد الأكواد وإدارة الأقسام والخطط وتفعيل المشتركين.
          </p>
        </div>
      </Modal>

      {/* Support / Report Issue Modal */}
      <Modal
        show={modalState.type === 'reportIssue'}
        title="📩 إرسال مشكلة أو طلب دعم للمالك"
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmitTicket}
            >
              إرسال الرسالة فورًا
            </button>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              إلغاء
            </button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group">
            <label>رقم هاتف التواصل / WhatsApp</label>
            <input
              className="form-control"
              placeholder="010xxxxxxxx"
              value={ticketPhone}
              onChange={(e) => setTicketPhone(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>موضوع الرسالة / المشكلة</label>
            <input
              className="form-control"
              placeholder="مثال: مشكلة في التفعيل / استفسار"
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
            />
          </div>
          <div className="form-group full">
            <label>تفاصيل المشكلة كاملة</label>
            <textarea
              className="form-control"
              style={{ minHeight: '100px' }}
              placeholder="شرح المشكلة التي تواجهك لتصل مباشرة إلى لوحة المالك لحلها..."
              value={ticketMessage}
              onChange={(e) => setTicketMessage(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Authentication Modal */}
      <AuthModal
        show={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(name) => {
          handleUpdateUserName(name);
          triggerRefresh();
        }}
        onShowToast={showToast}
      />

      {/* Mobile Install Guide Modal */}
      <MobileInstallGuideModal
        show={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        appName={commercialConfig.name}
      />
    </div>
  );
}
