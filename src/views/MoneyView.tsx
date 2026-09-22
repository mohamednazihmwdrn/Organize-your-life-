import React, { useEffect, useState } from 'react';
import { Account, Transaction } from '../types';
import { dbAll, getAllBalances, dbDel } from '../lib/db';
import { money, fmtDate, esc } from '../lib/utils';

interface MoneyViewProps {
  onOpenAccount: (id?: string) => void;
  onOpenTransaction: (type?: 'income' | 'expense', id?: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  refreshTrigger: number;
}

export const MoneyView: React.FC<MoneyViewProps> = ({
  onOpenAccount,
  onOpenTransaction,
  onShowToast,
  refreshTrigger,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [txs, accs, bals] = await Promise.all([
        dbAll<Transaction>('transactions'),
        dbAll<Account>('accounts'),
        getAllBalances(),
      ]);
      setTransactions(txs);
      setAccounts(accs);
      setBalances(bals);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const handleDelete = async (id: string) => {
    const t = transactions.find((x) => x.id === id);
    if (!t) return;
    if (confirm(`حذف العملية "${t.title}" بقيمة ${money(t.amount)}؟`)) {
      await dbDel('transactions', id);
      onShowToast('تم حذف العملية وإعادة احتساب الرصيد', 'success');
      loadData();
    }
  };

  let filtered = [...transactions].sort((a, b) => b.date.localeCompare(a.date));
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        (t.title + ' ' + (t.category || '') + ' ' + (t.notes || ''))
          .toLowerCase()
          .includes(q)
    );
  }

  if (loading) {
    return (
      <div className="card panel" style={{ textAlign: 'center', padding: '40px' }}>
        جاري تحميل بيانات المال...
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h3>المال والعمليات</h3>
          <p>إدارة الدخل والمصروفات والحسابات والتحويلات.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onOpenTransaction()}
        >
          ＋ إضافة عملية
        </button>
      </div>

      <div className="cards">
        {accounts.slice(0, 4).map((a) => (
          <div key={a.id} className="card stat">
            <div className="label">{esc(a.name)}</div>
            <div className="value">{money(balances[a.id] || 0)}</div>
            <div className="sub">
              {esc(
                a.type === 'cash'
                  ? 'كاش'
                  : a.type === 'bank'
                  ? 'بنك'
                  : a.type === 'wallet'
                  ? 'محفظة إلكترونية'
                  : 'بطاقة'
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card panel">
        <div className="panel-head">
          <h4>الحسابات المالية</h4>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onOpenAccount()}
          >
            ＋ حساب جديد
          </button>
        </div>
        {accounts.length ? (
          <div className="grid3">
            {accounts.map((a) => (
              <div key={a.id} className="list-item">
                <div className="list-main">
                  <strong>{esc(a.name)}</strong>
                  <small>
                    {esc(a.type)} • رصيد افتتاحي {money(a.openingBalance)}
                  </small>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <b>{money(balances[a.id] || 0)}</b>
                  <br />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: '10px', padding: '2px 6px', marginTop: '4px' }}
                    onClick={() => onOpenAccount(a.id)}
                  >
                    ✏️ تعديل
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="card panel" style={{ marginTop: '16px' }}>
        <div className="searchbar">
          <input
            className="form-control"
            placeholder="ابحث في العمليات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setSearch('')}
          >
            مسح
          </button>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>العملية</th>
                <th>التصنيف</th>
                <th>الحساب</th>
                <th>التاريخ</th>
                <th>المبلغ</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((t) => {
                  const acc = accounts.find((a) => a.id === t.accountId);
                  return (
                    <tr key={t.id}>
                      <td>{esc(t.title)}</td>
                      <td>{esc(t.category || '—')}</td>
                      <td>{esc(acc?.name || '—')}</td>
                      <td>{fmtDate(t.date)}</td>
                      <td
                        className={
                          t.type === 'income' ? 'amount-income' : 'amount-expense'
                        }
                      >
                        {t.type === 'income' ? '+' : '−'} {money(t.amount)}
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => onOpenTransaction(t.type as any, t.id)}
                          >
                            ✏️ تعديل
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(t.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">لا توجد عمليات تطابق البحث.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
