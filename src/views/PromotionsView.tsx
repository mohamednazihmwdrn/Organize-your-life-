import React, { useEffect, useState } from 'react';
import { PromotedApp, CommercialConfig } from '../types';
import { esc } from '../lib/utils';

interface PromotionsViewProps {
  config: CommercialConfig;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

const DEFAULT_PROMOTIONS: PromotedApp[] = [
  {
    id: 'promo-1',
    title: 'تطبيقات وخدمات مفيدة',
    description: 'يمكن لمالك التطبيق إضافة روابط تطبيقاته وخدماته أو شركائه من لوحة التحكم المخفية.',
    url: 'https://wa.me/2001029190615',
    kind: 'موصى به',
    affiliate: false,
    active: true,
  },
];

export const PromotionsView: React.FC<PromotionsViewProps> = ({
  config,
  onShowToast,
}) => {
  const [promotions, setPromotions] = useState<PromotedApp[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('plm_promotions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) {
          setPromotions(parsed.filter((x) => x.active));
          return;
        }
      }
    } catch (e) {
      console.error(e);
    }
    setPromotions(DEFAULT_PROMOTIONS);
  }, []);

  const handleOpenLink = (url: string) => {
    if (!url || url === '#') {
      return onShowToast('الرابط غير متاح حالياً', 'warning');
    }
    if (!/^https?:\/\//i.test(url)) {
      return onShowToast('الرابط يجب أن يبدأ بـ https:// أو http://', 'error');
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h3>📣 التطبيقات والخدمات والمنتجات</h3>
          <p>روابط وتطبيقات مفيدة يختار المالك عرضها للعملاء.</p>
        </div>
      </div>

      <div className="disclosure">
        💡 <b>إفصاح شقافية:</b> قد تكون بعض الروابط المعروضة أدناه خدمات شريكة أو روابط تسويق بالعمولة (Affiliate).
      </div>

      <div className="promo-grid" style={{ marginTop: '15px' }}>
        {promotions.length ? (
          promotions.map((x) => (
            <div key={x.id} className="card promo-card">
              <span
                className={`badge promo-badge ${
                  x.affiliate ? 'badge-warning' : 'badge-info'
                }`}
              >
                {esc(x.affiliate ? 'Affiliate / عمولة' : x.kind || 'موصى به')}
              </span>
              <h4>{esc(x.title)}</h4>
              <p>{esc(x.description || '')}</p>
              <div className="actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleOpenLink(x.url)}
                >
                  فتح الرابط ↗
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="card panel" style={{ gridColumn: '1/-1' }}>
            <div className="empty">لا توجد خدمات منشورة حاليًا.</div>
          </div>
        )}
      </div>

      <div className="product-footer">
        © {config.year || 2026} {esc(config.owner)} — جميع الحقوق محفوظة
      </div>
    </div>
  );
};
