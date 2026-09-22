export type AccountType = 'cash' | 'bank' | 'wallet' | 'card';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  createdAt: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  type: TransactionType;
  title: string;
  category: string;
  amount: number;
  date: string;
  accountId: string;
  fromAccountId?: string;
  toAccountId?: string;
  notes?: string;
  refType?: string;
  refId?: string;
  createdAt: string;
}

export type DebtDirection = 'owe' | 'lent';
export type DebtStatus = 'open' | 'paid';

export interface Debt {
  id: string;
  person: string;
  direction: DebtDirection;
  amount: number;
  paidAmount: number;
  dueDate: string;
  status: DebtStatus;
  notes?: string;
  createdAt: string;
}

export interface DebtPayment {
  id: string;
  debtId: string;
  transactionId?: string;
  amount: number;
  date: string;
}

export interface Installment {
  id: string;
  name: string;
  provider: string;
  totalAmount: number;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  firstDueDate: string;
  frequencyDays: number;
  accountId: string;
  notes?: string;
  createdAt: string;
}

export interface InstallmentPayment {
  id: string;
  installmentId: string;
  transactionId?: string;
  amount: number;
  date: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  frequency: string;
  accountId: string;
  status: 'paid' | 'unpaid';
  notes?: string;
  paidAt?: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: 'شهري' | 'سنوي';
  renewDate: string;
  accountId: string;
  accountName?: string;
  notes?: string;
  createdAt: string;
}

export interface Reminder {
  id: string;
  title: string;
  date: string;
  time?: string;
  priority: 'عاجل' | 'مهم' | 'عادي';
  repeat?: string;
  notes?: string;
  completed: boolean;
  createdAt: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  notes?: string;
  createdAt: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  type: string;
  issueDate: string;
  expiryDate: string;
  notes?: string;
  file?: {
    name: string;
    type: string;
    data: string;
  } | null;
  createdAt: string;
}

export interface Budget {
  id: string;
  category: string;
  amount: number;
  notes?: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userName: string;
  userContact: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  replyNote?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface SubscriptionCode {
  id: string;
  code: string;
  plan: 'monthly' | 'yearly' | 'lifetime' | 'trial';
  createdAt: string;
  expiresAt?: string | null;
  status: 'unused' | 'used' | 'disabled';
  usedAt?: string | null;
  customer?: string;
  note?: string;
}

export interface PromotedApp {
  id: string;
  title: string;
  description: string;
  url: string;
  kind: string;
  affiliate: boolean;
  active: boolean;
}

export interface CommercialPlans {
  monthly: number;
  yearly: number;
  lifetime: number;
}

export interface CommercialConfig {
  owner: string;
  support: string;
  whatsapp: string;
  vodafoneCash: string;
  name: string;
  year: number;
  plans: CommercialPlans;
  sections?: Record<string, boolean>;
}

export type PageId =
  | 'dashboard'
  | 'money'
  | 'obligations'
  | 'bills'
  | 'subscriptions'
  | 'reminders'
  | 'goals'
  | 'documents'
  | 'budgets'
  | 'reports'
  | 'plans'
  | 'promotions'
  | 'legal'
  | 'settings'
  | 'owner';
