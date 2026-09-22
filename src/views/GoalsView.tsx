import React, { useEffect, useState } from 'react';
import { Goal } from '../types';
import { dbAll, dbDel } from '../lib/db';
import { money, fmtDate, percent, esc } from '../lib/utils';

interface GoalsViewProps {
  onOpenGoal: (id?: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  refreshTrigger: number;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  onOpenGoal,
  onShowToast,
  refreshTrigger,
}) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await dbAll<Goal>('goals');
      setGoals(data);
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
    if (confirm('حذف الهدف؟')) {
      await dbDel('goals', id);
      onShowToast('تم حذف الهدف', 'success');
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="card panel" style={{ textAlign: 'center', padding: '40px' }}>
        جاري تحميل الأهداف المالية...
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h3>الأهداف المالية</h3>
          <p>حوّل أهدافك واحتياجاتك إلى خطة ادخار قابلة للقياس والمتابعة.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onOpenGoal()}
        >
          ＋ هدف جديد
        </button>
      </div>

      <div className="grid3">
        {goals.length ? (
          goals.map((x) => {
            const p = percent(x.current, x.target);
            return (
              <div key={x.id} className="card panel">
                <div className="panel-head">
                  <h4>{esc(x.name)}</h4>
                  <div className="actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => onOpenGoal(x.id)}
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
                <div style={{ fontSize: '23px', fontWeight: 900 }}>
                  {Math.round(p)}%
                </div>
                <div className="progress" style={{ margin: '9px 0' }}>
                  <span style={{ width: `${p}%` }}></span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                  }}
                >
                  <span>الحالي: {money(x.current)}</span>
                  <span>المستهدف: {money(x.target)}</span>
                </div>
                <p className="muted" style={{ fontSize: '10px', marginTop: '9px' }}>
                  الموعد المحدد: {fmtDate(x.deadline)}
                </p>
              </div>
            );
          })
        ) : (
          <div className="card panel" style={{ gridColumn: '1/-1' }}>
            <div className="empty">
              <div className="empty-ico">🎯</div>
              لا توجد أهداف مالية مسجلة. أنشئ هدفك الأول الآن.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
