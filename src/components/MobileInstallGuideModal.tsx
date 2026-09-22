import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Smartphone, Download, CheckCircle, Share2, PlusSquare, ArrowLeft, ExternalLink, Sparkles } from 'lucide-react';

interface MobileInstallGuideModalProps {
  show: boolean;
  onClose: () => void;
  appName?: string;
}

export const MobileInstallGuideModal: React.FC<MobileInstallGuideModalProps> = ({
  show,
  onClose,
  appName = 'مُنظِّم حياتك وفلوسك',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'install' | 'apk' | 'ios'>(isIOS ? 'ios' : 'install');
  const [installing, setInstalling] = useState(false);

  if (!show) return null;

  const handleInstallClick = async () => {
    setInstalling(true);
    try {
      const ok = await install();
      if (ok) {
        onClose();
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'max(8px, env(safe-area-inset-top)) 10px max(14px, env(safe-area-inset-bottom))',
        overflowX: 'hidden',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        direction: 'rtl',
        width: '100%',
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: 'calc(100dvh - 20px)',
          margin: 'auto',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          borderRadius: '20px',
          background: 'var(--card, #ffffff)',
          color: 'var(--text, #1e293b)',
          padding: '18px 16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid var(--border, #e2e8f0)',
          boxSizing: 'border-box',
        }}
      >
        {/* Header with App Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              width: '84px',
              height: '84px',
              margin: '0 auto 12px',
              borderRadius: '22px',
              overflow: 'hidden',
              boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.4)',
              border: '2px solid rgba(255, 255, 255, 0.9)',
              background: '#1e3a8a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src="/pwa-192x192.png"
              alt="شعار التطبيق"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                // fallback to svg
                (e.target as HTMLImageElement).src = '/icon.svg';
              }}
            />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 800 }}>
            تثبيت {appName} كتطبيق على هاتفك
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted, #64748b)' }}>
            احصل على التطبيق الحقيقي بشعاره وأيقونته الخاصة بدون شريط متصفح
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            background: 'var(--card-alt, #f1f5f9)',
            padding: '4px',
            borderRadius: '12px',
            marginBottom: '20px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('install')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'install' ? 'var(--primary, #2563eb)' : 'transparent',
              color: activeTab === 'install' ? '#ffffff' : 'var(--text, #334155)',
              transition: 'all 0.2s',
            }}
          >
            📱 التثبيت المباشر
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('apk')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'apk' ? 'var(--primary, #2563eb)' : 'transparent',
              color: activeTab === 'apk' ? '#ffffff' : 'var(--text, #334155)',
              transition: 'all 0.2s',
            }}
          >
            📦 ملف APK أندرويد
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ios')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '8px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'ios' ? 'var(--primary, #2563eb)' : 'transparent',
              color: activeTab === 'ios' ? '#ffffff' : 'var(--text, #334155)',
              transition: 'all 0.2s',
            }}
          >
            🍎 أجهزة آيفون
          </button>
        </div>

        {/* Tab 1: Direct PWA Install */}
        {activeTab === 'install' && (
          <div>
            {isInstalled ? (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '16px',
                  borderRadius: '14px',
                  textAlign: 'center',
                  marginBottom: '16px',
                }}
              >
                <CheckCircle style={{ width: '32px', height: '32px', color: '#10b981', margin: '0 auto 8px' }} />
                <h4 style={{ margin: '0 0 4px', fontSize: '15px', color: '#10b981' }}>
                  التطبيق مثبت بالفعل على هذا الهاتف!
                </h4>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted, #64748b)' }}>
                  أنت تستخدم النسخة المثبتة كـ تطبيق حقيقي ومستقل في هاتفك.
                </p>
              </div>
            ) : isInstallable ? (
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <p style={{ fontSize: '13px', lineHeight: 1.7, marginBottom: '16px' }}>
                  اضغط على الزر أدناه لتثبيت التطبيق مباشرة من رابطك. سيظهر فوراً في شاشة هاتفك وقائمة التطبيقات بأيقونته الرسمية بدون الحاجة لمتجر بلاي:
                </p>
                <button
                  type="button"
                  onClick={handleInstallClick}
                  disabled={installing}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '14px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.5)',
                  }}
                >
                  <Download style={{ width: '20px', height: '20px' }} />
                  {installing ? 'جاري التثبيت...' : 'تثبيت التطبيق على الشاشة الرئيسية الآن'}
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '13px', lineHeight: 1.8 }}>
                <div
                  style={{
                    background: 'var(--card-alt, #f8fafc)',
                    border: '1px solid var(--border, #e2e8f0)',
                    padding: '14px',
                    borderRadius: '14px',
                    marginBottom: '14px',
                  }}
                >
                  <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 700, color: 'var(--primary, #2563eb)' }}>
                    📲 خطوات التثبيت من متصفح جوجل كروم على أندرويد:
                  </h4>
                  <ol style={{ margin: 0, paddingRight: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>
                      افتح رابط تطبيقك في متصفح <strong>Google Chrome</strong> على هاتفك.
                    </li>
                    <li>
                      اضغط على <strong>زر القائمة (الثلاث نقاط ⋮)</strong> في أعلى الزاوية.
                    </li>
                    <li>
                      اختر <strong>«تثبيت التطبيق» (Install App)</strong> أو <strong>«إضافة إلى الشاشة الرئيسية»</strong>.
                    </li>
                    <li>
                      اضغط على <strong>«تثبيت»</strong> وسيقوم نظام أندرويد بإنشاء تطبيق حقيقي بأيقونته الخاصة في درج تطبيقات الهاتف.
                    </li>
                  </ol>
                </div>
              </div>
            )}

            <div
              style={{
                background: 'rgba(37, 99, 235, 0.06)',
                border: '1px solid rgba(37, 99, 235, 0.15)',
                padding: '12px 14px',
                borderRadius: '12px',
                fontSize: '12px',
                lineHeight: 1.7,
              }}
            >
              ✨ <strong>مميزات النسخة المثبتة:</strong> تعمل بدون شريط متصفح، تدعم العمل بدون إنترنت (Offline)، وتُخزن بياناتك الدخول تلقائياً.
            </div>
          </div>
        )}

        {/* Tab 2: Android APK */}
        {activeTab === 'apk' && (
          <div style={{ fontSize: '13px', lineHeight: 1.8 }}>
            <p style={{ margin: '0 0 12px', color: 'var(--text, #334155)' }}>
              إذا كنت تريد <strong>ملف APK حقيقي</strong> يمكنك إرساله لأصدقائك أو رفعه على متجر Google Play:
            </p>

            <div
              style={{
                background: 'var(--card-alt, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                padding: '14px',
                borderRadius: '14px',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 800,
                  }}
                >
                  1
                </span>
                <strong>أسهل طريقة مجانية (PWABuilder من مايكروسوفت):</strong>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '12.5px', color: 'var(--muted, #64748b)' }}>
                أداة رسمية معتمدة من Google و Microsoft لتحويل رابط الويب إلى ملف APK جاهز للتثبيت بنقرة واحدة:
              </p>
              <ol style={{ margin: 0, paddingRight: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>انسخ رابط موقعك المنشور على Vercel.</li>
                <li>
                  ادخل على موقع:{' '}
                  <a
                    href="https://www.pwabuilder.com"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'underline' }}
                  >
                    PWABuilder.com <ExternalLink style={{ width: '12px', height: '12px', display: 'inline' }} />
                  </a>
                </li>
                <li>ألصق الرابط واضغط على <strong>Start</strong>.</li>
                <li>اختر <strong>Package for Stores ➔ Android</strong> ثم اضغط <strong>Download APK</strong>.</li>
                <li>سينزل معك ملف الـ APK فوراً، ثبّته على هاتفك مباشرة!</li>
              </ol>
            </div>

            <div
              style={{
                background: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                padding: '12px',
                borderRadius: '12px',
                fontSize: '12px',
              }}
            >
              ✅ تم تجهيز ملف <strong>manifest.json</strong> والشعارات والأيقونات (192px و 512px و Maskable) تلقائياً، لذا سيعطيك موقع PWABuilder درجة تقييم 100% للتطبيق وجاهزية فورية للـ APK!
            </div>
          </div>
        )}

        {/* Tab 3: iOS (iPhone / iPad) */}
        {activeTab === 'ios' && (
          <div style={{ fontSize: '13px', lineHeight: 1.8 }}>
            <div
              style={{
                background: 'var(--card-alt, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                padding: '14px',
                borderRadius: '14px',
                marginBottom: '14px',
              }}
            >
              <h4 style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700, color: 'var(--primary, #2563eb)' }}>
                🍎 خطوات التثبيت على آيفون (Safari):
              </h4>
              <ol style={{ margin: 0, paddingRight: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>1. افتح الرابط في متصفح <strong>Safari</strong> حصراً.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>2. اضغط على زر <strong>المشاركة (Share)</strong> <Share2 style={{ width: '16px', height: '16px', display: 'inline', color: '#0284c7' }} /> في أسفل الشاشة.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>3. مرر لأسفل واختر <strong>«إضافة إلى الشاشة الرئيسية» (Add to Home Screen)</strong> <PlusSquare style={{ width: '16px', height: '16px', display: 'inline', color: '#059669' }} />.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>4. اضغط على <strong>«إضافة» (Add)</strong> في أعلى الزاوية.</span>
                </li>
              </ol>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted, #64748b)' }}>
              سيظهر التطبيق فوراً على شاشة الآيفون بجانب تطبيقاتك العادية وبنفس الشعار الرسمي.
            </p>
          </div>
        )}

        {/* Footer Close */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border, #e2e8f0)' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              border: '1px solid var(--border, #cbd5e1)',
              background: 'transparent',
              color: 'var(--text, #475569)',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            إغلاق النافذة
          </button>
        </div>
      </div>
    </div>
  );
};
