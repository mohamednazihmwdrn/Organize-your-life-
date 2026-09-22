import React, { useEffect, useState } from 'react';
import { Subscription } from '../types';
import { dbAll, dbDel } from '../lib/db';
import { money, fmtDate, daysUntil, num, esc } from '../lib/utils';

interface SubscriptionsViewProps {
  onOpenSubscription: (id?: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  refreshTrigger: number;
}

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  onOpenSubscription,
  onShowToast,
  refreshTrigger,
}) => {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await dbAll<Subscription>('subscriptions');
      setSubs(data);
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
    if (confirm('حذف الاشتراك؟')) {
      await dbDel('subscriptions', id);
      onShowToast('تم حذف الاشتراك', 'success');
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="card panel" style={{ textAlign: 'center', padding: '40px' }}>
        جاري تحميل الاشتراكات...
      </div>
    );
  }

  const monthlyTotal = subs
    .filter((x) => x.frequency === 'شهري')
    .reduce((a, x) => a + num(x.amount), 0);
  const yearlyTotal = subs
    .filter((x) => x.frequency === 'سنوي')
    .reduce((a, x) => a + num(x.amount), 0);
  const dueSoonCount = subs.filter(
    (x) => daysUntil(x.renewDate) >= 0 && daysUntil(x.renewDate) <= 7
  ).length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h3>الاشتراكات والخدمات المتكررة</h3>
          <p>راقب الخدمات المتكررة وتكلفتها ومواعيد التجديد.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onOpenSubscription()}
        >
          ＋ إضافة اشتراك
        </button>
      </div>

      <div className="cards">
        <div className="card stat">
          <div className="label">إجمالي شهري</div>
          <div className="value">{money(monthlyTotal)}</div>
        </div>
        <div className="card stat">
          <div className="label">إجمالي سنوي</div>
          <div className="value">{money(yearlyTotal)}</div>
        </div>
        <div className="card stat">
          <div className="label">عدد الاشتراكات</div>
          <div className="value">{subs.length}</div>
        </div>
        <div className="card stat">
          <div className="label">تجديد خلال 7 أيام</div>
          <div className="value">{dueSoonCount}</div>
        </div>
      </div>

      <div className="card panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الاشتراك</th>
                <th>السعر</th>
                <th>التكرار</th>
                <th>التجديد</th>
                <th>الحساب</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {subs.length ? (
                subs.map((x) => (
                  <tr key={x.id}>
                    <td>{esc(x.name)}</td>
                    <td>{money(x.amount)}</td>
                    <td>{esc(x.frequency)}</td>
                    <td>{fmtDate(x.renewDate)}</td>
                    <td>{esc(x.accountName || '—')}</td>
                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => onOpenSubscription(x.id)}
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
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">لا توجد اشتراكات مسجلة.</div>
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
