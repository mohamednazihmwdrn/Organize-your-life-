import React, { useEffect, useState } from 'react';
import { Bill } from '../types';
import { dbAll, dbDel } from '../lib/db';
import { money, fmtDate, daysUntil, num, esc } from '../lib/utils';

interface BillsViewProps {
  onOpenBill: (id?: string) => void;
  onPayBill: (id: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  refreshTrigger: number;
}

export const BillsView: React.FC<BillsViewProps> = ({
  onOpenBill,
  onPayBill,
  onShowToast,
  refreshTrigger,
}) => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await dbAll<Bill>('bills');
      setBills(data);
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
    if (confirm('حذف الفاتورة؟')) {
      await dbDel('bills', id);
      onShowToast('تم حذف الفاتورة', 'success');
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="card panel" style={{ textAlign: 'center', padding: '40px' }}>
        جاري تحميل الفواتير...
      </div>
    );
  }

  const unpaidBills = bills.filter((b) => b.status !== 'paid');
  const unpaidTotal = unpaidBills.reduce((s, b) => s + num(b.amount), 0);
  const overdueCount = unpaidBills.filter((b) => daysUntil(b.dueDate) < 0).length;
  const dueInWeekCount = unpaidBills.filter(
    (b) => daysUntil(b.dueDate) >= 0 && daysUntil(b.dueDate) <= 7
  ).length;
  const paidCount = bills.filter((b) => b.status === 'paid').length;

  const sortedBills = [...bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div>
      <div className="page-head">
        <div>
          <h3>الفواتير</h3>
          <p>تابع فواتيرك ومواعيد الاستحقاق وحالة الدفع.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onOpenBill()}
        >
          ＋ إضافة فاتورة
        </button>
      </div>

      <div className="cards">
        <div className="card stat">
          <div className="label">إجمالي غير المدفوع</div>
          <div className="value amount-expense">{money(unpaidTotal)}</div>
        </div>
        <div className="card stat">
          <div className="label">فواتير متأخرة</div>
          <div className="value">{overdueCount}</div>
        </div>
        <div className="card stat">
          <div className="label">تستحق خلال 7 أيام</div>
          <div className="value">{dueInWeekCount}</div>
        </div>
        <div className="card stat">
          <div className="label">فواتير مدفوعة</div>
          <div className="value kpi-positive">{paidCount}</div>
        </div>
      </div>

      <div className="card panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الفاتورة</th>
                <th>القيمة</th>
                <th>الاستحقاق</th>
                <th>التكرار</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {sortedBills.length ? (
                sortedBills.map((b) => {
                  const days = daysUntil(b.dueDate);
                  const isPaid = b.status === 'paid';
                  const badgeClass = isPaid
                    ? 'badge-success'
                    : days < 0
                    ? 'badge-danger'
                    : 'badge-warning';
                  const badgeLabel = isPaid
                    ? 'مدفوعة'
                    : days < 0
                    ? 'متأخرة'
                    : 'غير مدفوعة';

                  return (
                    <tr key={b.id}>
                      <td>{esc(b.name)}</td>
                      <td>{money(b.amount)}</td>
                      <td>{fmtDate(b.dueDate)}</td>
                      <td>{esc(b.frequency)}</td>
                      <td>
                        <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
                      </td>
                      <td>
                        <div className="actions">
                          {!isPaid && (
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              onClick={() => onPayBill(b.id)}
                            >
                              دفع
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => onOpenBill(b.id)}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(b.id)}
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
                    <div className="empty">لا توجد فواتير.</div>
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
