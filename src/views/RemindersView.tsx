import React, { useEffect, useState } from 'react';
import { Reminder } from '../types';
import { dbAll, dbPut, dbDel } from '../lib/db';
import { fmtDate, esc } from '../lib/utils';

interface RemindersViewProps {
  onOpenReminder: (id?: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  refreshTrigger: number;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  onOpenReminder,
  onShowToast,
  refreshTrigger,
}) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await dbAll<Reminder>('reminders');
      data.sort((a, b) => a.date.localeCompare(b.date));
      setReminders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const toggleComplete = async (rem: Reminder) => {
    const updated = { ...rem, completed: !rem.completed };
    await dbPut('reminders', updated);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (confirm('حذف التذكير؟')) {
      await dbDel('reminders', id);
      onShowToast('تم حذف التذكير', 'success');
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="card panel" style={{ textAlign: 'center', padding: '40px' }}>
        جاري تحميل التذكيرات...
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h3>التذكيرات والاستحقاقات</h3>
          <p>كل ما تحتاج أن تتذكره، في قائمة واحدة مع الأولوية والتكرار.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onOpenReminder()}
        >
          ＋ إضافة تذكير
        </button>
      </div>

      <div className="card panel">
        <div className="list">
          {reminders.length ? (
            reminders.map((x) => (
              <div
                key={x.id}
                className="list-item"
                style={{ opacity: x.completed ? 0.55 : 1 }}
              >
                <div className="list-main">
                  <strong>
                    {x.completed ? '✅ ' : ''}
                    {esc(x.title)}
                  </strong>
                  <small>
                    {fmtDate(x.date)} {x.time ? `• ${esc(x.time)}` : ''} •{' '}
                    {esc(x.priority)}
                    {x.repeat ? ` • تكرار: ${esc(x.repeat)}` : ''}
                  </small>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    className={`btn ${
                      x.completed ? 'btn-outline' : 'btn-success'
                    } btn-sm`}
                    onClick={() => toggleComplete(x)}
                  >
                    {x.completed ? 'فتح' : 'تم'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => onOpenReminder(x.id)}
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
            ))
          ) : (
            <div className="empty">
              <div className="empty-ico">🔔</div>
              لا توجد تذكيرات.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
