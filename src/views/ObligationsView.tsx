import React, { useEffect, useState } from 'react';
import { Debt, DebtPayment, Installment, InstallmentPayment } from '../types';
import { dbAll, dbDel } from '../lib/db';
import { money, fmtDate, percent, num, esc } from '../lib/utils';

interface ObligationsViewProps {
  onOpenDebt: (id?: string) => void;
  onOpenInstallment: (id?: string) => void;
  onPayDebt: (id: string) => void;
  onPayInstallment: (id: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  refreshTrigger: number;
}

export const ObligationsView: React.FC<ObligationsViewProps> = ({
  onOpenDebt,
  onOpenInstallment,
  onPayDebt,
  onPayInstallment,
  onShowToast,
  refreshTrigger,
}) => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [dList, iList] = await Promise.all([
        dbAll<Debt>('debts'),
        dbAll<Installment>('installments'),
      ]);
      setDebts(dList);
      setInstallments(iList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const handleDeleteDebt = async (id: string) => {
    if (!confirm('حذف الدين وسجل دفعاته؟')) return;
    const payments = await dbAll<DebtPayment>('debtPayments');
    for (const x of payments.filter((p) => p.debtId === id)) {
      if (x.transactionId) await dbDel('transactions', x.transactionId);
      await dbDel('debtPayments', x.id);
    }
    await dbDel('debts', id);
    onShowToast('تم حذف الدين بنجاح', 'success');
    loadData();
  };

  const handleDeleteInstallment = async (id: string) => {
    if (!confirm('حذف القسط وسجل دفعاته؟')) return;
    const payments = await dbAll<InstallmentPayment>('installmentPayments');
    for (const x of payments.filter((p) => p.installmentId === id)) {
      if (x.transactionId) await dbDel('transactions', x.transactionId);
      await dbDel('installmentPayments', x.id);
    }
    await dbDel('installments', id);
    onShowToast('تم حذف القسط بنجاح', 'success');
    loadData();
  };

  if (loading) {
    return (
      <div className="card panel" style={{ textAlign: 'center', padding: '40px' }}>
        جاري تحميل الديون والأقساط...
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h3>الديون والأقساط</h3>
          <p>تابع ما عليك وما لك وجدول الأقساط والدفعات.</p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onOpenInstallment()}
          >
            ＋ قسط جديد
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onOpenDebt()}
          >
            ＋ دين جديد
          </button>
        </div>
      </div>

      <div className="grid2">
        <div className="card panel">
          <div className="panel-head">
            <h4>سجل الديون</h4>
          </div>
          {debts.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>الشخص / الجهة</th>
                    <th>الاتجاه</th>
                    <th>الإجمالي</th>
                    <th>المتبقي</th>
                    <th>الاستحقاق</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {debts.map((d) => {
                    const rem = Math.max(0, num(d.amount) - num(d.paidAmount));
                    return (
                      <tr key={d.id}>
                        <td>{esc(d.person)}</td>
                        <td>
                          <span
                            className={`badge ${
                              d.direction === 'owe'
                                ? 'badge-danger'
                                : 'badge-success'
                            }`}
                          >
                            {d.direction === 'owe' ? 'عليّ' : 'لي'}
                          </span>
                        </td>
                        <td>{money(d.amount)}</td>
                        <td>{money(rem)}</td>
                        <td>{fmtDate(d.dueDate)}</td>
                        <td>
                          <div className="actions">
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              onClick={() => onPayDebt(d.id)}
                            >
                              💵 سداد
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => onOpenDebt(d.id)}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteDebt(d.id)}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty">لا توجد ديون مسجلة.</div>
          )}
        </div>

        <div className="card panel">
          <div className="panel-head">
            <h4>الأقساط الملتزم بها</h4>
          </div>
          {installments.length ? (
            <div className="list">
              {installments.map((i) => {
                const paid = num(i.paidInstallments);
                const p = percent(paid, i.totalInstallments);
                return (
                  <div key={i.id} className="list-item">
                    <div className="list-main">
                      <strong>{esc(i.name)}</strong>
                      <small>
                        {money(i.installmentAmount)} • {paid}/
                        {i.totalInstallments} مدفوع
                      </small>
                      <div className="progress" style={{ marginTop: '7px' }}>
                        <span style={{ width: `${p}%` }}></span>
                      </div>
                    </div>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => onPayInstallment(i.id)}
                      >
                        سداد
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => onOpenInstallment(i.id)}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteInstallment(i.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">لا توجد أقساط مسجلة.</div>
          )}
        </div>
      </div>
    </div>
  );
};
