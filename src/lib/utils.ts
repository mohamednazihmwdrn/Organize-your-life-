import { CommercialConfig } from '../types';

export const PRODUCT_DEFAULT: CommercialConfig = {
  owner: 'Mohamed Nazih',
  support: '01029190615',
  whatsapp: '01029190615',
  vodafoneCash: '01029190615',
  name: 'مُنظِّم حياتك وفلوسك',
  year: 2026,
  plans: { monthly: 59, yearly: 699, lifetime: 1299 },
  sections: {
    dashboard: true,
    money: true,
    obligations: true,
    bills: true,
    subscriptions: true,
    reminders: true,
    goals: true,
    documents: true,
    budgets: true,
    reports: true,
    plans: true,
    promotions: true,
    legal: true,
    settings: true,
  },
};

export const OWNER_PASSWORD = '291906';

export function uid(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function getCurrencySymbol(): string {
  return localStorage.getItem('plm_currency') || 'جنيه';
}

export function money(val: number | string): string {
  const n = Number(val) || 0;
  const formatted = new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${formatted} ${getCurrencySymbol()}`;
}

export function num(v: unknown): number {
  return Math.max(0, Number(v) || 0);
}

export function esc(s: string | number | undefined | null): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function fmtDate(d?: string): string {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(d + 'T00:00:00'));
  } catch {
    return d;
  }
}

export function daysUntil(d?: string): number {
  if (!d) return 9999;
  const target = new Date(d + 'T00:00:00');
  const today = new Date(todayISO() + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function percent(a: number, b: number): number {
  if (!b || b <= 0) return 0;
  return Math.min(100, Math.max(0, (a / b) * 100));
}

export function simplePinHash(pin: string): string {
  try {
    let h = 0;
    for (let i = 0; i < pin.length; i++) {
      h = ((h << 5) - h) + pin.charCodeAt(i) | 0;
    }
    return String(h);
  } catch {
    return btoa(pin);
  }
}

export function getCommercialConfig(): CommercialConfig {
  try {
    const saved = localStorage.getItem('plm_product_config');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...PRODUCT_DEFAULT,
        ...parsed,
        plans: { ...PRODUCT_DEFAULT.plans, ...(parsed.plans || {}) },
        sections: { ...PRODUCT_DEFAULT.sections, ...(parsed.sections || {}) },
      };
    }
  } catch (e) {
    console.error(e);
  }
  return { ...PRODUCT_DEFAULT };
}

export function saveCommercialConfig(cfg: CommercialConfig): void {
  localStorage.setItem('plm_product_config', JSON.stringify(cfg));
}

export function makeSubscriptionCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = 'MN-';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) out += '-';
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
