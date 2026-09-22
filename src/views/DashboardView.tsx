import React, { useEffect, useState } from 'react';
import {
  Account,
  Transaction,
  Bill,
  Debt,
  Subscription,
  Reminder,
  Goal,
  PageId,
} from '../types';
import {
  dbAll,
  getAllBalances,
} from '../lib/db';
import {
  money,
  fmtDate,
  daysUntil,
  percent,
  num,
  esc,
} from '../lib/utils';

interface DashboardViewProps {
  userName: string;
  refreshTrigger?: number;
  onNavigate: (page: PageId) => void;
  onOpenQuickAdd: () => void;
  onOpenTransaction: (type?: 'income' | 'expense') => void;
  onOpenDebt: () => void;
  onOpenReminder: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userName,
  refreshTrigger,
  onNavigate,
  onOpenQuickAdd,
  onOpenTransaction,
  onOpenDebt,
  onOpenReminder,
}) => {
  const [balance, setBalance] = useState(0);
  const [accountsCount, setAccountsCount] = useState(0);
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthExpense, setMonthExpense] = useState(0);
  
  // Debts
  const [debtOwed, setDebtOwed] = useState(0);
  const [debtOwedCount, setDebtOwedCount] = useState(0);
  const [debtToReceive, setDebtToReceive] = useState(0);
  const [debtToReceiveCount, setDebtToReceiveCount] = useState(0);
  const [activeDebtsList, setActiveDebtsList] = useState<Debt[]>([]);

  // Subscriptions
  const [subscriptionsCount, setSubscriptionsCount] = useState(0);
  const [monthlySubsCost, setMonthlySubsCost] = useState(0);
  const [upcomingSubscriptions, setUpcomingSubscriptions] = useState<
    (Subscription & { daysLeft: number })[]
  >([]);

  // Other items
  const [dueBillsCount, setDueBillsCount] = useState(0);
  const [upcomingItems, setUpcomingItems] = useState<{ name: string; date: string; amount?: number }[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [accs, bals, txs, bills, debts, subs, rems, goalsData] = await Promise.all([
          dbAll<Account>('accounts'),
          getAllBalances(),
          dbAll<Transaction>('transactions'),
          dbAll<Bill>('bills'),
          dbAll<Debt>('debts'),
          dbAll<Subscription>('subscriptions'),
          dbAll<Reminder>('reminders'),
          dbAll<Goal>('goals'),
        ]);

        // Total balances
        const totalBal = Object.values(bals).reduce((a, b) => a + b, 0);
        setBalance(totalBal);
        setAccountsCount(accs.length);

        // Monthly Income & Expenses
        const currentMonth = new Date().toISOString().slice(0, 7);
        let mi = 0;
        let me = 0;
        txs.forEach((t) => {
          if (t.date.startsWith(currentMonth)) {
            if (t.type === 'income') mi += num(t.amount);
            if (t.type === 'expense') me += num(t.amount);
          }
        });
        setMonthIncome(mi);
        setMonthExpense(me);

        // Debts calculations
        const openDebts = debts.filter((d) => d.status !== 'paid');
        const owedDebts = openDebts.filter((d) => d.direction === 'owe');
        const lentDebts = openDebts.filter((d) => d.direction === 'lent');

        const totalOwed = owedDebts.reduce(
          (sum, d) => sum + Math.max(0, num(d.amount) - num(d.paidAmount || 0)),
          0
        );
        const totalLent = lentDebts.reduce(
          (sum, d) => sum + Math.max(0, num(d.amount) - num(d.paidAmount || 0)),
          0
        );

        setDebtOwed(totalOwed);
        setDebtOwedCount(owedDebts.length);
        setDebtToReceive(totalLent);
        setDebtToReceiveCount(lentDebts.length);

        // Sorted active debts (closest due date first or highest remaining)
        const sortedActiveDebts = [...openDebts]
          .sort((a, b) => {
            if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            if (a.dueDate) return -1;
            if (b.dueDate) return 1;
            const remA = num(a.amount) - num(a.paidAmount || 0);
            const remB = num(b.amount) - num(b.paidAmount || 0);
            return remB - remA;
          })
          .slice(0, 4);
        setActiveDebtsList(sortedActiveDebts);

        // Subscriptions calculations
        setSubscriptionsCount(subs.length);
        let totalSubCost = 0;
        subs.forEach((s) => {
          const amt = num(s.amount);
          if (s.frequency === 'سنوي') {
            totalSubCost += amt / 12;
          } else {
            totalSubCost += amt;
          }
        });
        setMonthlySubsCost(totalSubCost);

        // Near-renewal subscriptions
        const subsWithDays = subs
          .filter((s) => s.renewDate)
          .map((s) => ({
            ...s,
            daysLeft: daysUntil(s.renewDate),
          }))
          .sort((a, b) => a.daysLeft - b.daysLeft)
          .slice(0, 4);
        setUpcomingSubscriptions(subsWithDays);

        // Bills & Reminders
        const dBills = bills.filter(
          (b) => b.status !== 'paid' && b.dueDate && daysUntil(b.dueDate) <= 7
        ).length;
        setDueBillsCount(dBills);

        const upcoming: { name: string; date: string; amount?: number }[] = [
          ...bills
            .filter((b) => b.status !== 'paid' && b.dueDate)
            .map((b) => ({ name: b.name, date: b.dueDate, amount: b.amount })),
          ...rems
            .filter((r) => !r.completed && r.date)
            .map((r) => ({ name: r.title, date: r.date })),
        ]
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 5);
        setUpcomingItems(upcoming);

        // Recent Transactions
        const sortedRecent = [...txs]
          .sort(
            (a, b) =>
              b.date.localeCompare(a.date) ||
              String(b.createdAt).localeCompare(String(a.createdAt))
          )
          .slice(0, 5);
        setRecentTransactions(sortedRecent);

        setGoals(goalsData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="card panel" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
        <div>جاري تحميل بيانات لوحة التحكم...</div>
      </div>
    );
  }

  const monthNet = monthIncome - monthExpense;

  return (
    <div>
      {/* Top Welcome Header */}
      <div className="page-head">
        <div>
          <h3>أهلاً بك 👋 {esc(userName)}</h3>
          <p>نظرة شاملة وعصرية على حساباتك، التزاماتك واشتراكاتك القادمة.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onOpenQuickAdd}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}
        >
          <span>＋</span> إضافة عملية سريعة
        </button>
      </div>

      {/* Main KPI Stats Cards */}
      <div className="cards">
        <div className="card stat">
          <div className="label">الرصيد الكلي المتاح</div>
          <div className="value" style={{ color: 'var(--primary)', fontWeight: 900 }}>
            {money(balance)}
          </div>
          <div className="sub">{accountsCount} حسابات مصرفية ونقدية</div>
          <div className="stat-icon">💰</div>
        </div>

        <div className="card stat">
          <div className="label">إجمالي دخل الشهر</div>
          <div className="value amount-income">{money(monthIncome)}</div>
          <div className="sub">كل مصادر الإيرادات</div>
          <div className="stat-icon">📈</div>
        </div>

        <div className="card stat">
          <div className="label">مصروفات هذا الشهر</div>
          <div className="value amount-expense">{money(monthExpense)}</div>
          <div className="sub">المصاريف والمدفوعات</div>
          <div className="stat-icon">📉</div>
        </div>

        <div className="card stat">
          <div className="label">صافي وفر الشهر</div>
          <div
            className={`value ${
              monthNet >= 0 ? 'kpi-positive' : 'kpi-negative'
            }`}
          >
            {money(monthNet)}
          </div>
          <div className="sub">الدخل − المصروف</div>
          <div className="stat-icon">🧮</div>
        </div>
      </div>

      {/* NEW: 2 Featured Colorful Cards for Active Debts & Subscriptions */}
      <div className="grid2" style={{ marginTop: '20px', gap: '20px' }}>
        
        {/* Card 1: Colorful Active Debts Status Card */}
        <div
          className="card panel"
          style={{
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            boxShadow: '0 10px 30px -10px rgba(245, 158, 11, 0.15)',
          }}
        >
          {/* Subtle Top Gradient Bar */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #f59e0b, #ef4444, #10b981)',
            }}
          />

          <div className="panel-head" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-grid',
                  placeItems: 'center',
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  fontSize: '18px',
                }}
              >
                💳
              </span>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px' }}>حالة الديون والأقساط النشطة</h4>
                <small className="muted" style={{ fontSize: '11px' }}>
                  متابعة المبالغ المستحقة عليك والديون المطلوبة لك
                </small>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('obligations')}
              style={{ fontWeight: 700, borderColor: 'rgba(245, 158, 11, 0.4)', color: '#d97706' }}
            >
              عرض الكل ‹
            </button>
          </div>

          {/* Quick 2-Column Metrics Pills */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              marginBottom: '16px',
            }}
          >
            {/* Owed by user */}
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.07)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '14px',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626' }}>
                  عليك دفعه (ديون والتزامات)
                </span>
                <span
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontWeight: 800,
                  }}
                >
                  {debtOwedCount}
                </span>
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 900,
                  color: '#dc2626',
                  marginTop: '4px',
                }}
              >
                {money(debtOwed)}
              </div>
            </div>

            {/* Owed to user */}
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.07)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '14px',
                padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669' }}>
                  لك استرداده (أموال في الخارج)
                </span>
                <span
                  style={{
                    background: '#10b981',
                    color: '#fff',
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    fontWeight: 800,
                  }}
                >
                  {debtToReceiveCount}
                </span>
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 900,
                  color: '#059669',
                  marginTop: '4px',
                }}
              >
                {money(debtToReceive)}
              </div>
            </div>
          </div>

          {/* Active Debts List */}
          {activeDebtsList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '2px' }}>
                أبرز الديون قيد المتابعة:
              </div>
              {activeDebtsList.map((d) => {
                const isOwe = d.direction === 'owe';
                const remaining = Math.max(0, num(d.amount) - num(d.paidAmount || 0));
                const paidPct = percent(d.paidAmount || 0, d.amount);
                const days = d.dueDate ? daysUntil(d.dueDate) : null;

                return (
                  <div
                    key={d.id}
                    style={{
                      background: 'var(--surface2)',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '6px',
                            background: isOwe ? '#fee2e2' : '#d1fae5',
                            color: isOwe ? '#b91c1c' : '#047857',
                          }}
                        >
                          {isOwe ? 'عليك' : 'لك'}
                        </span>
                        <strong style={{ fontSize: '13px' }}>{esc(d.person)}</strong>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 800,
                            color: isOwe ? '#dc2626' : '#16a34a',
                          }}
                        >
                          {money(remaining)}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar & Due Date Tag */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '6px',
                        fontSize: '10px',
                        color: 'var(--muted)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '60%' }}>
                        <div
                          style={{
                            flex: 1,
                            height: '5px',
                            background: 'var(--border)',
                            borderRadius: '10px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${paidPct}%`,
                              height: '100%',
                              background: isOwe ? '#ef4444' : '#10b981',
                              borderRadius: '10px',
                            }}
                          />
                        </div>
                        <span>سُدّد {Math.round(paidPct)}%</span>
                      </div>

                      {days !== null ? (
                        <span
                          style={{
                            fontWeight: 700,
                            color: days < 0 ? '#ef4444' : days <= 3 ? '#f59e0b' : 'var(--muted)',
                          }}
                        >
                          {days < 0
                            ? `متأخر (${Math.abs(days)} يوم)`
                            : days === 0
                            ? 'يستحق اليوم ⚠️'
                            : `متبقي ${days} يوم`}
                        </span>
                      ) : (
                        <span>غير محدد تاريخ</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '20px 10px',
                background: 'var(--surface2)',
                borderRadius: '14px',
                fontSize: '12px',
                color: 'var(--muted)',
              }}
            >
              <div style={{ fontSize: '22px', marginBottom: '4px' }}>✨</div>
              ممتاز! لا توجد عليك أو لك أي ديون نشطة معلقة حالياً.
            </div>
          )}

          <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              style={{ flex: 1, fontSize: '11px', padding: '8px', fontWeight: 700 }}
              onClick={onOpenDebt}
            >
              ＋ تسجيل دين جديد
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, fontSize: '11px', padding: '8px', fontWeight: 700 }}
              onClick={() => onNavigate('obligations')}
            >
              سداد / تسوية ‹
            </button>
          </div>
        </div>

        {/* Card 2: Colorful Subscriptions Near Renewal Card */}
        <div
          className="card panel"
          style={{
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            boxShadow: '0 10px 30px -10px rgba(99, 102, 241, 0.15)',
          }}
        >
          {/* Subtle Top Gradient Bar */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #3b82f6)',
            }}
          />

          <div className="panel-head" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-grid',
                  placeItems: 'center',
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  fontSize: '18px',
                }}
              >
                🔁
              </span>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px' }}>الاشتراكات والتجديدات القادمة</h4>
                <small className="muted" style={{ fontSize: '11px' }}>
                  تنبيهات بمواعيد الخصم والتكلفة الدورية لخدماتك
                </small>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('subscriptions')}
              style={{ fontWeight: 700, borderColor: 'rgba(99, 102, 241, 0.4)', color: '#6366f1' }}
            >
              عرض الكل ‹
            </button>
          </div>

          {/* Quick Subscriptions KPIs Banner */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '14px',
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#4f46e5' }}>
                عدد الاشتراكات النشطة
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 900,
                  color: '#4338ca',
                  marginTop: '4px',
                }}
              >
                {subscriptionsCount} خدمة
              </div>
            </div>

            <div
              style={{
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '14px',
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed' }}>
                التكلفة التقديرية الشهرية
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: 900,
                  color: '#6d28d9',
                  marginTop: '4px',
                }}
              >
                {money(monthlySubsCost)}
              </div>
            </div>
          </div>

          {/* Upcoming Subscriptions List */}
          {upcomingSubscriptions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '2px' }}>
                أقرب مواعيد التجديد القادمة:
              </div>
              {upcomingSubscriptions.map((s) => {
                const isUrgent = s.daysLeft <= 3;
                const isVeryUrgent = s.daysLeft <= 1;

                return (
                  <div
                    key={s.id}
                    style={{
                      background: 'var(--surface2)',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '14px',
                          fontWeight: 900,
                        }}
                      >
                        {s.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <strong style={{ fontSize: '13px', display: 'block' }}>{esc(s.name)}</strong>
                        <small className="muted" style={{ fontSize: '10px' }}>
                          تجديد {s.frequency || 'شهري'} • {fmtDate(s.renewDate)}
                        </small>
                      </div>
                    </div>

                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#4f46e5' }}>
                        {money(s.amount)}
                      </div>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '6px',
                          background: isVeryUrgent
                            ? '#fee2e2'
                            : isUrgent
                            ? '#fef3c7'
                            : '#e0e7ff',
                          color: isVeryUrgent
                            ? '#dc2626'
                            : isUrgent
                            ? '#d97706'
                            : '#4338ca',
                          marginTop: '2px',
                        }}
                      >
                        {s.daysLeft < 0
                          ? 'مستحق التجديد'
                          : s.daysLeft === 0
                          ? 'يتجدد اليوم 🔔'
                          : s.daysLeft === 1
                          ? 'يتجدد غداً ⏰'
                          : `بعد ${s.daysLeft} أيام`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '20px 10px',
                background: 'var(--surface2)',
                borderRadius: '14px',
                fontSize: '12px',
                color: 'var(--muted)',
              }}
            >
              <div style={{ fontSize: '22px', marginBottom: '4px' }}>📅</div>
              لم تقم بتسجيل أي اشتراكات دورية بعد.
            </div>
          )}

          <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              style={{ flex: 1, fontSize: '11px', padding: '8px', fontWeight: 700 }}
              onClick={() => onNavigate('subscriptions')}
            >
              ＋ إضافة اشتراك جديد
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, fontSize: '11px', padding: '8px', fontWeight: 700, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderColor: '#4f46e5' }}
              onClick={() => onNavigate('subscriptions')}
            >
              إدارة الاشتراكات ‹
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Upcoming Reminders/Bills & Financial Goals */}
      <div className="grid2" style={{ marginTop: '20px' }}>
        <div className="card panel">
          <div className="panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🔔</span>
              <h4>استحقاقات وتذكيرات قريبة ({upcomingItems.length})</h4>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('reminders')}
            >
              عرض الكل
            </button>
          </div>
          {upcomingItems.length ? (
            <div className="list">
              {upcomingItems.map((item, idx) => {
                const days = daysUntil(item.date);
                const badgeClass =
                  days < 0
                    ? 'badge-danger'
                    : days <= 3
                    ? 'badge-warning'
                    : 'badge-info';
                const badgeText =
                  days < 0
                    ? 'متأخر'
                    : days === 0
                    ? 'اليوم'
                    : `بعد ${days} يوم`;

                return (
                  <div key={idx} className="list-item">
                    <div className="list-main">
                      <strong>{esc(item.name)}</strong>
                      <small>
                        {fmtDate(item.date)}{' '}
                        {item.amount ? `• ${money(item.amount)}` : ''}
                      </small>
                    </div>
                    <span className={`badge ${badgeClass}`}>{badgeText}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">
              <div className="empty-ico">🎉</div>
              لا توجد استحقاقات أو تذكيرات قريبة هذا الأسبوع.
            </div>
          )}
        </div>

        <div className="card panel">
          <div className="panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🎯</span>
              <h4>أهدافك المالية والادخار</h4>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('goals')}
            >
              إدارة الأهداف
            </button>
          </div>
          {goals.length ? (
            <div className="list">
              {goals.slice(0, 4).map((g) => {
                const p = percent(g.current, g.target);
                return (
                  <div key={g.id} style={{ marginBottom: '10px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        marginBottom: '5px',
                      }}
                    >
                      <b>{esc(g.name)}</b>
                      <span style={{ fontWeight: 800, color: 'var(--primary)' }}>
                        {Math.round(p)}%
                      </span>
                    </div>
                    <div className="progress" style={{ height: '8px', borderRadius: '8px' }}>
                      <span style={{ width: `${Math.min(p, 100)}%`, borderRadius: '8px' }}></span>
                    </div>
                    <small className="muted" style={{ fontSize: '10px', marginTop: '3px', display: 'block' }}>
                      تم تجميع {money(g.current)} من الهدف {money(g.target)}
                    </small>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">
              <div className="empty-ico">🎯</div>
              ابدأ الآن بإنشاء هدفك المالي الأول وتتبع ادخارك خطوة بخطوة.
            </div>
          )}
        </div>
      </div>

      {/* Grid: Recent Activity & Quick Actions */}
      <div className="grid2" style={{ marginTop: '20px' }}>
        <div className="card panel">
          <div className="panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>📝</span>
              <h4>آخر المعاملات المالية</h4>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('money')}
            >
              كافة العمليات
            </button>
          </div>
          {recentTransactions.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>البيان</th>
                    <th>التصنيف</th>
                    <th>التاريخ</th>
                    <th>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 700 }}>{esc(t.title)}</td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: '10px' }}>
                          {esc(t.category || 'عام')}
                        </span>
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {fmtDate(t.date)}
                      </td>
                      <td
                        className={
                          t.type === 'income' ? 'amount-income' : 'amount-expense'
                        }
                        style={{ fontWeight: 800 }}
                      >
                        {t.type === 'income' ? '+' : '−'} {money(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">لم تسجل أي حركة مالية مؤخراً.</div>
          )}
        </div>

        <div className="card panel">
          <div className="panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚡</span>
              <h4>إجراءات وتسجيل سريع</h4>
            </div>
          </div>
          <div className="quick-grid">
            <button
              type="button"
              className="quick"
              onClick={() => onOpenTransaction('expense')}
            >
              <span>💸</span>
              <div>
                <b>تسجيل مصروف</b>
                <small style={{ display: 'block', fontSize: '10px', opacity: 0.8 }}>خصم من الحساب</small>
              </div>
            </button>
            <button
              type="button"
              className="quick"
              onClick={() => onOpenTransaction('income')}
            >
              <span>💵</span>
              <div>
                <b>تسجيل إيراد / راتب</b>
                <small style={{ display: 'block', fontSize: '10px', opacity: 0.8 }}>إيداع في الرصيد</small>
              </div>
            </button>
            <button type="button" className="quick" onClick={onOpenDebt}>
              <span>🤝</span>
              <div>
                <b>دين أو قرض</b>
                <small style={{ display: 'block', fontSize: '10px', opacity: 0.8 }}>لك أو عليك</small>
              </div>
            </button>
            <button type="button" className="quick" onClick={onOpenReminder}>
              <span>🔔</span>
              <div>
                <b>تذكير وموعد</b>
                <small style={{ display: 'block', fontSize: '10px', opacity: 0.8 }}>تنبيه مستقبلي</small>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
