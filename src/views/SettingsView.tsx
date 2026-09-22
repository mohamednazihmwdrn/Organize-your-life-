import React, { useState } from 'react';
import { CommercialConfig, PageId } from '../types';
import { dbAll, dbPut, dbClear, STORES, ensureDefaultAccount, clearLocalDatabase } from '../lib/db';
import {
  simplePinHash,
  todayISO,
  nowISO,
  esc,
} from '../lib/utils';
import { User } from 'firebase/auth';

interface SettingsViewProps {
  userName: string;
  userPhone?: string;
  theme: string;
  config: CommercialConfig;
  currentUser: User | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  onUpdateUserName: (name: string) => void;
  onToggleTheme: () => void;
  onNavigate: (page: PageId) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onReportIssue: () => void;
  onRefreshData: () => void;
  onOpenInstallModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userName,
  userPhone,
  theme,
  config,
  currentUser,
  onOpenAuthModal,
  onLogout,
  onUpdateUserName,
  onToggleTheme,
  onNavigate,
  onShowToast,
  onReportIssue,
  onRefreshData,
  onOpenInstallModal,
}) => {
  const [nameInput, setNameInput] = useState(userName);
  const [currencyInput, setCurrencyInput] = useState(
    localStorage.getItem('plm_currency') || 'جنيه'
  );
  const [deleteConfirmWord, setDeleteConfirmWord] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleSaveProfile = () => {
    const trimmed = nameInput.trim() || 'مستخدم';
    onUpdateUserName(trimmed);
    localStorage.setItem('plm_currency', currencyInput);
    onShowToast('تم حفظ التغييرات بنجاح', 'success');
  };

  const handleExportBackup = async () => {
    try {
      const data: Record<string, any> = {
        version: 7,
        exportedAt: nowISO(),
        userId: currentUser?.uid || 'guest',
        userEmail: currentUser?.email || '',
        product: { owner: config.owner, support: config.support, plans: config.plans },
        commercialConfig: config,
        settings: {
          name: userName,
          currency: localStorage.getItem('plm_currency') || 'جنيه',
          theme,
          pinEnabled: localStorage.getItem('plm_pin_enabled') === '1',
        },
      };

      for (const s of STORES) {
        data[s] = await dbAll(s);
      }

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `life-money-backup-${todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast('تم تصدير ملف النسخة الاحتياطية بنجاح', 'success');
    } catch (e: any) {
      onShowToast('فشل تصدير النسخة الاحتياطية: ' + e.message, 'error');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!confirm('سيتم استبدال البيانات الحالية بالبيانات المستوردة. هل أنت متأكد؟')) {
          return;
        }

        for (const s of STORES) {
          await dbClear(s);
          if (Array.isArray(data[s])) {
            for (const item of data[s]) {
              await dbPut(s, item);
            }
          }
        }

        if (data.settings) {
          if (data.settings.name) onUpdateUserName(data.settings.name);
          if (data.settings.currency) localStorage.setItem('plm_currency', data.settings.currency);
        }

        onShowToast('تم استيراد البيانات واستعادتها بنجاح', 'success');
        onRefreshData();
      } catch (err: any) {
        onShowToast('فشل استيراد الملف: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSetPin = () => {
    const pin = prompt('اكتب رمز PIN مكون من 4 إلى 8 أرقام:') || '';
    if (!/^\d{4,8}$/.test(pin)) {
      return onShowToast('رمز PIN يجب أن يتكون من 4 إلى 8 أرقام فقط', 'error');
    }
    localStorage.setItem('plm_pin_hash', simplePinHash(pin));
    localStorage.setItem('plm_pin_enabled', '1');
    onShowToast('تم تفعيل قفل PIN بنجاح', 'success');
  };

  const handleRemovePin = () => {
    localStorage.removeItem('plm_pin_hash');
    localStorage.removeItem('plm_pin_enabled');
    sessionStorage.setItem('plm_unlocked', '1');
    onShowToast('تم إلغاء قفل PIN', 'success');
  };

  const handleDeleteAllData = async () => {
    if (deleteConfirmWord.trim() !== 'DELETE') {
      return onShowToast('اكتب كلمة DELETE بشكل صحيح للتأكيد', 'error');
    }
    for (const s of STORES) {
      await dbClear(s);
    }
    await clearLocalDatabase();
    await ensureDefaultAccount();
    setShowDeleteModal(false);
    setDeleteConfirmWord('');
    onShowToast('تم مسح جميع البيانات وإعادة تعيين الحسابات', 'warning');
    onRefreshData();
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h3>الإعدادات والملف الشخصي</h3>
          <p>تخصيص البيانات، الحساب السحابي، الخصوصية، النسخ الاحتياطي وقفل الأمان.</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Mobile App Installation & APK */}
        <div
          className="card panel"
          style={{
            gridColumn: '1 / -1',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.07), rgba(16, 185, 129, 0.07))',
            border: '1.5px solid rgba(37, 99, 235, 0.3)',
            borderRadius: '18px',
          }}
        >
          <div className="panel-head" style={{ borderBottom: '1px solid rgba(37, 99, 235, 0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#1e3a8a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #2563eb',
                }}
              >
                <img
                  src="/pwa-192x192.png"
                  alt="شعار التطبيق"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/icon.svg';
                  }}
                />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>
                  📱 تحميل وتثبيت التطبيق على الهاتف (Android / iPhone / APK)
                </h4>
                <small style={{ color: 'var(--muted)' }}>
                  شعار التطبيق الرسمي، تشغيل بدون شريط متصفح، وأيقونة على الشاشة الرئيسية
                </small>
              </div>
            </div>
            <span className="badge badge-success">جاهز للتثبيت 100%</span>
          </div>
          <div style={{ padding: '16px 0 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.7, color: 'var(--text)' }}>
              يمكنك تشغيل هذا التطبيق على هاتفك المحمول كـ <strong>تطبيق حقيقي ومستقل تماماً</strong>، بأيقونته وشعاره الخاص وسرعة فائقة بدون شريط عنوان المتصفح. كما يمكنك تحويله إلى ملف <strong>APK</strong> بنقرة واحدة.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {onOpenInstallModal && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onOpenInstallModal}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 18px',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    borderRadius: '10px',
                  }}
                >
                  <span>📲</span>
                  <span>فتح دليل التثبيت وتحميل الـ APK</span>
                </button>
              )}
              <a
                href="https://www.pwabuilder.com"
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  borderRadius: '10px',
                }}
              >
                <span>📦</span>
                <span>توليد ملف APK عبر PWABuilder</span>
              </a>
            </div>
          </div>
        </div>

        {/* Cloud Account & User Profile */}
        <div className="card panel" style={{ border: currentUser ? '1px solid #10b981' : '1px solid var(--border)' }}>
          <div className="panel-head">
            <h4>👤 حساب العميل وتوثيق الجهاز</h4>
            {currentUser ? (
              <span className="badge badge-success">🟢 جهاز موثق وسحابي</span>
            ) : (
              <span className="badge badge-warning">🟡 غير مسجل</span>
            )}
          </div>
          {currentUser ? (
            <div style={{ fontSize: '13px', lineHeight: 1.8 }}>
              <div style={{ marginBottom: '8px' }}>
                <b style={{ color: 'var(--text)' }}>اسم صاحب الحساب:</b>{' '}
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{userName}</span>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <b style={{ color: 'var(--text)' }}>رقم الهاتف المسجل:</b>{' '}
                <span style={{ direction: 'ltr', display: 'inline-block', fontWeight: 600 }}>
                  {userPhone ||
                    localStorage.getItem('plm_registered_phone') ||
                    (currentUser.email?.startsWith('phone_')
                      ? currentUser.email.replace('phone_', '').replace('@plm.app', '')
                      : currentUser.email)}
                </span>
              </div>
              {currentUser.email && !currentUser.email.startsWith('phone_') && (
                <div style={{ marginBottom: '8px' }}>
                  <b style={{ color: 'var(--text)' }}>البريد الإلكتروني:</b>{' '}
                  <span style={{ direction: 'ltr', display: 'inline-block' }}>{currentUser.email}</span>
                </div>
              )}
              <div style={{ marginBottom: '8px' }}>
                <b style={{ color: 'var(--text)' }}>معرف العميل (UID):</b>{' '}
                <code style={{ fontSize: '11px', background: 'var(--card-alt)', padding: '2px 6px', borderRadius: '4px' }}>
                  {currentUser.uid.slice(0, 10)}...
                </code>
              </div>
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  marginBottom: '14px',
                  fontSize: '11.5px',
                  color: 'var(--text)',
                  lineHeight: 1.6,
                }}
              >
                🔒 <strong>حالة الجهاز:</strong> تم التعرف على هذا الجهاز كجهاز معتمد لك. يتم تسجيل دخولك تلقائياً دون طلب كلمة المرور في كل مرة، وتُحفظ جميع بياناتك ومعاملاتك سحابياً. في حال حذف التطبيق وتنزيله مجدداً، يمكنك الدخول برقم هاتفك لاسترجاع كل شيء.
              </div>
              <button
                type="button"
                className="btn btn-outline"
                style={{ width: '100%', borderColor: '#ef4444', color: '#ef4444', fontWeight: 700 }}
                onClick={() => {
                  if (
                    confirm(
                      'هل أنت متأكد من تسجيل الخروج من هذا الجهاز؟\n\nستحتاج إلى إدخال رقم هاتفك وكلمة مرورك لتسجيل الدخول مرة أخرى.'
                    )
                  ) {
                    onLogout();
                  }
                }}
              >
                🚪 تسجيل الخروج من هذا الجهاز
              </button>
            </div>
          ) : (
            <div>
              <p className="muted" style={{ fontSize: '12px', lineHeight: 1.8, marginBottom: '12px' }}>
                أنت تستخدم النظام حاليًا كـ <b>زائر محلي</b>. سجل دخولك الآن باسمك ورقم هاتفك لربط هذا الجهاز بحسابك السحابي وحفظ كافة معاملاتك.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px', fontWeight: 800 }}
                onClick={onOpenAuthModal}
              >
                ✨ تسجيل الدخول / إنشاء حساب عميل
              </button>
            </div>
          )}
        </div>

        <div className="card panel">
          <div className="panel-head">
            <h4>تفضيلات الحساب والعملة</h4>
          </div>
          <div className="form-group">
            <label>اسمك الكريم</label>
            <input
              className="form-control"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginTop: '10px' }}>
            <label>العملة المفضلة</label>
            <select
              className="form-control"
              value={currencyInput}
              onChange={(e) => setCurrencyInput(e.target.value)}
            >
              <option value="جنيه">جنيه مصري (EGP)</option>
              <option value="ر.س">ريال سعودي (SAR)</option>
              <option value="د.إ">درهم إماراتي (AED)</option>
              <option value="$">دولار أمريكي (USD)</option>
              <option value="د.ك">دينار كويتي (KWD)</option>
              <option value="د.أ">دينار أردني (JOD)</option>
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: '12px' }}
            onClick={handleSaveProfile}
          >
            حفظ البيانات
          </button>
        </div>

        <div className="card panel">
          <div className="panel-head">
            <h4>المظهر ووضع الشاشة</h4>
          </div>
          <div className="setting-item">
            <div>
              <b>الوضع الليلي (Dark Mode)</b>
              <small className="muted" style={{ display: 'block' }}>
                مريح للعين وموفر للبطارية
              </small>
            </div>
            <button
              type="button"
              className={`toggle ${theme === 'dark' ? 'on' : ''}`}
              onClick={onToggleTheme}
            ></button>
          </div>
        </div>

        <div className="card panel">
          <div className="panel-head">
            <h4>النسخ الاحتياطي واستعادة البيانات</h4>
          </div>
          <p className="muted" style={{ fontSize: '11px', lineHeight: 1.8, marginBottom: '12px' }}>
            صدّر بياناتك الكاملة إلى ملف JSON واحفظها في مكان آمن. الاستيراد يستعيد بياناتك بالكامل.
          </p>
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExportBackup}
            >
              ⬇️ تصدير نسخة احتياطية
            </button>
            <label className="btn btn-outline" style={{ margin: 0, cursor: 'pointer' }}>
              ⬆️ استيراد ملف
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImportBackup}
              />
            </label>
          </div>
        </div>

        <div className="card panel">
          <div className="panel-head">
            <h4>🔐 قفل التطبيق بـ PIN</h4>
          </div>
          <p className="muted" style={{ fontSize: '11px', lineHeight: 1.8, marginBottom: '10px' }}>
            تعيين رمز أمان PIN لقفل شاشة التطبيق محليًا على هذا الجهاز.
          </p>
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSetPin}
            >
              تعيين / تغيير PIN
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleRemovePin}
            >
              إلغاء قفل PIN
            </button>
          </div>
        </div>

        <div className="card panel">
          <div className="panel-head">
            <h4>💬 الدعم الفني وتقديم بلاغ/مشكلة</h4>
          </div>
          <p className="muted" style={{ fontSize: '11px', lineHeight: 1.8, marginBottom: '10px' }}>
            إذا واجهتك أي مشكلة في التطبيق أو الدفع أو التفعيل، يمكنك إرسال مشكلتك مباشرة للمالك والمصمم.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onReportIssue}
          >
            📩 إرسال مشكلة / طلب دعم للمالك
          </button>
        </div>

        <div className="card panel">
          <div className="panel-head">
            <h4>مسح وقضايا البيانات</h4>
          </div>
          <p className="muted" style={{ fontSize: '11px', lineHeight: 1.8 }}>
            حذف كافة السجلات والحسابات والعمليات الخاصة بك والبدء من جديد.
          </p>
          <button
            type="button"
            className="btn btn-danger"
            style={{ marginTop: '12px' }}
            onClick={() => setShowDeleteModal(true)}
          >
            🗑️ حذف كل البيانات نهائياً
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-backdrop show">
          <div className="modal">
            <div className="modal-head">
              <h4>⚠️ تحذير: حذف جميع البيانات</h4>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowDeleteModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ lineHeight: 2, fontSize: '13px' }}>
                سيتم مسح كافة البيانات المسجلة نهائيًا. لتأكيد المسح، اكتب كلمة <b>DELETE</b> أدناه:
              </p>
              <input
                className="form-control"
                style={{ marginTop: '10px' }}
                placeholder="DELETE"
                value={deleteConfirmWord}
                onChange={(e) => setDeleteConfirmWord(e.target.value)}
              />
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteAllData}
              >
                تأكيد الحذف النهائِي
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowDeleteModal(false)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="product-footer">
        © {config.year || 2026} {esc(config.owner)} — جميع الحقوق محفوظة • WhatsApp / الدعم: {config.support}
      </div>
    </div>
  );
};
