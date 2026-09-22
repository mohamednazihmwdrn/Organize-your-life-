import React, { useEffect, useState } from 'react';
import { Budget, Transaction } from '../types';
import { dbAll, dbDel } from '../lib/db';
import { money, percent, num, esc } from '../lib/utils';

interface BudgetsViewProps {
  onOpenBudget: (id?: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  refreshTrigger: number;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  onOpenBudget,
  onShowToast,
  refreshTrigger,
}) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spentMap, setSpentMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [bList, txs] = await Promise.all([
        dbAll<Budget>('budgets'),
        dbAll<Transaction>('transactions'),
      ]);
      const currentMonth = new Date().toISOString().slice(0, 7);
      const spent: Record<string, number> = {};

      txs.forEach((t) => {
        if (t.type === 'expense' && t.date.startsWith(currentMonth)) {
          spent[t.category] = (spent[t.category] || 0) + num(t.amount);
        }
      });

      setBudgets(bList);
      setSpentMap(spent);
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
    if (confirm('حذف الميزانية؟')) {
      await dbDel('budgets', id);
      onShowToast('تم حذف الميزانية', 'success');
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="card panel" style={{ textAlign: 'center', padding: '40px' }}>
        جاري تحميل الميزانيات...
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h3>الميزانيات والتصنيفات</h3>
          <p>حدد سقفًا محددًا لكل تصنيف وتابع استهلاكك الشهري تلقائيًا.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onOpenBudget()}
        >
          ＋ إضافة ميزانية
        </button>
      </div>

      <div className="grid3">
        {budgets.length ? (
          budgets.map((x) => {
            const spent = spentMap[x.category] || 0;
            const p = percent(spent, x.amount);
            return (
              <div key={x.id} className="card panel">
                <div className="panel-head">
                  <h4>{esc(x.category)}</h4>
                  <div className="actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => onOpenBudget(x.id)}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(x.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                  }}
                >
                  <span>المصروف: <b>{money(spent)}</b></span>
                  <span>الحد: <b>{money(x.amount)}</b></span>
                </div>
                <div className="progress" style={{ margin: '9px 0' }}>
                  <span
                    style={{
                      width: `${p}%`,
                      background: p >= 100 ? '#dc2626' : undefined,
                    }}
                  ></span>
                </div>
                <small className="muted">
                  {p.toFixed(0)}% مستهلك من ميزانية هذا الشهر
                </small>
              </div>
            );
          })
        ) : (
          <div className="card panel" style={{ gridColumn: '1/-1' }}>
            <div className="empty">لا توجد ميزانيات مخصصة حتى الآن.</div>
          </div>
        )}
      </div>
    </div>
  );
};
