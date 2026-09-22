import React, { useState } from 'react';
import { CommercialConfig, PageId } from '../types';
import { dbAll, dbPut } from '../lib/db';
import { num, esc } from '../lib/utils';

interface PlansViewProps {
  config: CommercialConfig;
  onNavigate: (page: PageId) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onReportIssue: () => void;
}

export const PlansView: React.FC<PlansViewProps> = ({
  config,
  onNavigate,
  onShowToast,
  onReportIssue,
}) => {
  const [activationCode, setActivationCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  const plans = config.plans || { monthly: 59, yearly: 699, lifetime: 1299 };

  const handleWhatsApp = (planName: string) => {
    const text = `مرحبًا ${config.owner}، أريد الاشتراك في الخطة ${planName}. أرجو إرسال خطوات الدفع والتفعيل.`;
    window.open(
      `https://wa.me/20${config.whatsapp}?text=${encodeURIComponent(text)}`,
      '_blank'
    );
  };

  const handleCopyVodafone = () => {
    navigator.clipboard
      ?.writeText(config.vodafoneCash)
      .then(() => onShowToast(`تم نسخ رقم Vodafone Cash (${config.vodafoneCash})`, 'success'))
      .catch(() => onShowToast(`رقم التحويل: ${config.vodafoneCash}`, 'info'));
  };

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = activationCode.trim().toUpperCase();
    if (!code) {
      return onShowToast('أدخل كود الاشتراك أولاً', 'error');
    }

    setIsRedeeming(true);
    try {
      const storedCodes = await dbAll<any>('codes');
      const localCodesRaw = localStorage.getItem('plm_subscription_codes');
      const localCodes = localCodesRaw ? JSON.parse(localCodesRaw) : [];

      const allCodes = [...storedCodes, ...localCodes];
      const match = allCodes.find(
        (c) => c.code && c.code.toUpperCase() === code && c.status === 'unused'
      );

      if (match) {
        match.status = 'used';
        match.usedAt = new Date().toISOString();
        localStorage.setItem('plm_user_plan', match.plan || 'active');
        localStorage.setItem('plm_plan_activated_at', new Date().toISOString());

        // Update in DB or LocalStorage
        await dbPut('codes', match);
        if (localCodes.length) {
          const idx = localCodes.findIndex((x: any) => x.id === match.id);
          if (idx >= 0) {
            localCodes[idx] = match;
            localStorage.setItem('plm_subscription_codes', JSON.stringify(localCodes));
          }
        }

        onShowToast(`🎉 تم تفعيل اشتراكك بنجاح! نوع الخطة: ${match.plan}`, 'success');
        setActivationCode('');
      } else {
        onShowToast('كود الاشتراك غير صحيح أو تم استخدامه مسبقًا', 'error');
      }
    } catch (err: any) {
      onShowToast('حدث خطأ أثناء التفعيل: ' + err.message, 'error');
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h3>💎 الخطط والاشتراك</h3>
          <p>اختر الخطة المناسبة لك للاستفادة الكاملة من جميع المزايا والدعم.</p>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={onReportIssue}
        >
          💬 الدعم وحل المشاكل
        </button>
      </div>

      <div className="plan-grid">
        <div className="card plan">
          <h4>شهري</h4>
          <div className="plan-price">
            {num(plans.monthly)} <small>جنيه / شهر</small>
          </div>
          <ul>
            <li>كل أدوات إدارة المال والميزانيات</li>
            <li>الديون والأقساط والفواتير</li>
            <li>الأهداف والتذكيرات المستمرة</li>
            <li>النسخ الاحتياطي والمساعد المحلي</li>
            <li>دعم وتواصل مباشر المالك</li>
          </ul>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => handleWhatsApp(`الشهري (${num(plans.monthly)} جنيه)`)}
          >
            اشترك الآن
          </button>
        </div>

        <div className="card plan featured">
          <div className="ribbon">الأفضل</div>
          <h4>سنوي</h4>
          <div className="plan-price">
            {num(plans.yearly)} <small>جنيه / سنة</small>
          </div>
          <ul>
            <li>كل مزايا الخطة الشهرية</li>
            <li>وفر أكثر من 20% على مدار العام</li>
            <li>نسخ احتياطي مجاني واستعادة البيانات</li>
            <li>تحديثات دورية للتطبيق</li>
            <li>دعم سريع عبر WhatsApp</li>
          </ul>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => handleWhatsApp(`السنوية (${num(plans.yearly)} جنيه)`)}
          >
            اشترك الآن
          </button>
        </div>

        <div className="card plan">
          <h4>مدى الحياة</h4>
          <div className="plan-price">
            {num(plans.lifetime)} <small>جنيه مرة واحدة</small>
          </div>
          <ul>
            <li>استخدام كامل مدى الحياة</li>
            <li>بدون أي اشتراكات شهرية أو تجديد</li>
            <li>كل المزايا والتحديثات القادمة</li>
            <li>أولوية الدعم الفني والمساعدة</li>
            <li>تواصل مباشر مع المالك والمصمم</li>
          </ul>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => handleWhatsApp(`مدى الحياة (${num(plans.lifetime)} جنيه)`)}
          >
            اشترك الآن
          </button>
        </div>
      </div>

      <div className="card panel" style={{ marginTop: '16px' }}>
        <div className="panel-head">
          <h4>🎟️ أدخل كود الاشتراك والتفعيل</h4>
          <span className="badge badge-success">تفعيل الكود</span>
        </div>
        <form onSubmit={handleRedeemCode} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            className="form-control"
            style={{ flex: 1, minWidth: '160px', direction: 'ltr', letterSpacing: '1px' }}
            placeholder="مثال: MN-ABCD-EFGH-1234"
            value={activationCode}
            onChange={(e) => setActivationCode(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isRedeeming}
          >
            {isRedeeming ? 'جاري التفعيل...' : 'تفعيل الكود'}
          </button>
        </form>
      </div>

      <div className="card panel" style={{ marginTop: '16px' }}>
        <div className="panel-head">
          <h4>💳 طريقة الدفع المباشرة</h4>
          <span className="badge badge-warning">تفعيل يدوي سريِع</span>
        </div>
        <div className="payment-box">
          <p style={{ fontSize: '12px', lineHeight: 1.9 }}>
            حوّل قيمة الخطة عبر <b>Vodafone Cash</b> إلى الرقم التالي، ثم اضغط زر WhatsApp وأرسل صورة التحويل أو رقمه مع اسمك لتفعيل اشتراكك فورًا:
          </p>
          <div style={{ textAlign: 'center', margin: '13px 0' }}>
            <span className="number-copy">{config.vodafoneCash}</span>
          </div>
          <div className="actions" style={{ justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleCopyVodafone}
            >
              📋 نسخ رقم التحويل
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={() => handleWhatsApp('تم تحويل المبلغ عبر Vodafone Cash وأريد التفعيل')}
            >
              💬 أرسلت التحويل على WhatsApp
            </button>
          </div>
          <p
            className="muted"
            style={{ fontSize: '10px', textAlign: 'center', marginTop: '10px' }}
          >
            WhatsApp / الدعم: {config.whatsapp} • المالك والمصمم: {esc(config.owner)}
          </p>
        </div>
      </div>

      <div className="card panel" style={{ marginTop: '16px' }}>
        <div className="panel-head">
          <h4>📜 قبل الاشتراك</h4>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onNavigate('legal')}
          >
            الخصوصية والشروط
          </button>
        </div>
        <p className="muted" style={{ fontSize: '11px', lineHeight: 1.9 }}>
          يرجى مراجعة سياسة الخصوصية وشروط الاستخدام وسياسة الاسترداد قبل إتمام الشراء. الدفع يتم يدويًا والتفعيل يتم مباشرة فور تأكيد التحويل أو عبر استخدام كود تفعيل معتمد من المالك.
        </p>
      </div>

      <div className="product-footer">
        {config.name} • منتج رقمي مملوك لـ {esc(config.owner)} • الدعم وWhatsApp: {config.support}
      </div>
    </div>
  );
};
