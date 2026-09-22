import React, { useEffect, useState } from 'react';
import { DocumentItem } from '../types';
import { dbAll, dbDel } from '../lib/db';
import { fmtDate, daysUntil, esc } from '../lib/utils';

interface DocumentsViewProps {
  onOpenDocument: (id?: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  refreshTrigger: number;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  onOpenDocument,
  onShowToast,
  refreshTrigger,
}) => {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await dbAll<DocumentItem>('documents');
      data.sort((a, b) => (a.expiryDate || '9999').localeCompare(b.expiryDate || '9999'));
      setDocs(data);
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
    if (confirm('حذف المستند؟')) {
      await dbDel('documents', id);
      onShowToast('تم حذف المستند', 'success');
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="card panel" style={{ textAlign: 'center', padding: '40px' }}>
        جاري تحميل المستندات...
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h3>المستندات والضمانات</h3>
          <p>سجل مستنداتك المهمة والعقود ومواعيد انتهائها والضمانات.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onOpenDocument()}
        >
          ＋ إضافة مستند
        </button>
      </div>

      <div className="card panel">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>المستند</th>
                <th>النوع</th>
                <th>الإصدار</th>
                <th>الانتهاء</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {docs.length ? (
                docs.map((x) => {
                  const days = x.expiryDate ? daysUntil(x.expiryDate) : 9999;
                  const badgeClass =
                    days < 0
                      ? 'badge-danger'
                      : days <= 30
                      ? 'badge-warning'
                      : 'badge-success';
                  const badgeLabel =
                    days < 0
                      ? 'منتهي'
                      : days <= 30
                      ? 'ينتهي قريبًا'
                      : 'ساري';

                  return (
                    <tr key={x.id}>
                      <td>{esc(x.name)}</td>
                      <td>{esc(x.type)}</td>
                      <td>{fmtDate(x.issueDate)}</td>
                      <td>{fmtDate(x.expiryDate)}</td>
                      <td>
                        <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
                      </td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => onOpenDocument(x.id)}
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
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">لا توجد مستندات مسجلة.</div>
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
