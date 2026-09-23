import React, { useState } from 'react';
import {
  registerWithPhone,
  loginWithPhone,
  loginWithGoogle,
  normalizePhone,
} from '../lib/firebase';
import { migrateLocalDataToCloud } from '../lib/db';

interface RegistrationGateModalProps {
  show: boolean;
  appName: string;
  onSuccess: (name: string, phone: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const RegistrationGateModal: React.FC<RegistrationGateModalProps> = ({
  show,
  appName,
  onSuccess,
  onShowToast,
}) => {
  const [tab, setTab] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  if (!show) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorNotice('يرجى إدخال اسمك الكريم أو اللقب المفضل');
      return;
    }

    const normPhone = normalizePhone(phone);
    if (!normPhone || normPhone.length < 8) {
      setErrorNotice('يرجى إدخال رقم هاتف صحيح مكوّن من 8 أرقام على الأقل');
      return;
    }

    if (!password || password.length < 6) {
      setErrorNotice('كلمة المرور / الرمز السري يجب ألا تقل عن 6 خانات لتأمين حسابك');
      return;
    }

    if (password !== confirmPassword) {
      setErrorNotice('كلمتا المرور غير متطابقتين، يرجى إعادة التأكيد بدقة');
      return;
    }

    setLoading(true);
    try {
      const user = await registerWithPhone(cleanName, phone, password);
      // Migrate any pending local records to their new cloud account
      await migrateLocalDataToCloud(user.uid).catch((e) => console.warn(e));

      onShowToast(`تم تسجيلك بنجاح وتوثيق جهازك 🎉 أهلاً بك يا ${cleanName}`, 'success');
      onSuccess(cleanName, phone.trim());
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use' || (err.message && err.message.includes('مسجل بالفعل'))) {
        setErrorNotice('رقم الهاتف هذا مسجل بالفعل مسبقاً! تم تحويلك لتبويب استرجاع الحساب والدخول');
        setTab('login');
      } else {
        setErrorNotice(err.message || 'تعذر إنشاء الحساب، يرجى التحقق من صحة البيانات والاتصال بالإنترنت');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);

    const normPhone = normalizePhone(phone);
    if (!normPhone || normPhone.length < 7) {
      setErrorNotice('يرجى إدخال رقم الهاتف المسجل به حسابك');
      return;
    }

    if (!password) {
      setErrorNotice('يرجى إدخال كلمة المرور أو الرمز السري الخاص بحسابك');
      return;
    }

    setLoading(true);
    try {
      const { user, name: restoredName } = await loginWithPhone(phone, password);
      // Migrate local data into restored account
      await migrateLocalDataToCloud(user.uid).catch((e) => console.warn(e));

      onShowToast(`تم التعرف على جهازك واسترجاع حسابك بنجاح! مرحباً بعودتك يا ${restoredName} 👋`, 'success');
      onSuccess(restoredName, phone.trim());
    } catch (err: any) {
      console.error(err);
      setErrorNotice(err.message || 'بيانات الدخول غير صحيحة! تأكد من رقم الهاتف المسجل وكلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorNotice(null);
    setLoading(true);
    try {
      const user = await loginWithGoogle();
      const displayName = user.displayName || user.email?.split('@')[0] || 'مستخدم';
      await migrateLocalDataToCloud(user.uid);

      onShowToast(`تم تسجيل الدخول بنجاح وتوثيق جهازك 👋 مرحباً بك يا ${displayName}`, 'success');
      onSuccess(displayName, user.email || '');
    } catch (err: any) {
      if (!err.message?.includes('popup-closed')) {
        setErrorNotice('تعذر التسجيل عبر Google، تحقق من اتصال الإنترنت.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="registration-gate"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'max(8px, env(safe-area-inset-top)) 10px max(14px, env(safe-area-inset-bottom))',
        overflowX: 'hidden',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '410px',
          maxHeight: 'calc(100dvh - 20px)',
          margin: 'auto',
          borderRadius: '20px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          overflow: 'hidden',
          padding: 0,
          background: 'var(--surface)',
          animation: 'fadeIn 0.25s ease-out',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        {/* Header Banner - Compact & Mobile Optimized */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1877F2 0%, #0d5bb5 100%)',
            padding: '16px 14px 12px',
            color: '#ffffff',
            textAlign: 'center',
            position: 'relative',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#ffffff',
              color: '#1877F2',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 6px',
              fontSize: '22px',
              fontWeight: 900,
              boxShadow: '0 6px 14px rgba(0, 0, 0, 0.18)',
            }}
          >
            💰
          </div>

          <h2 style={{ fontSize: '17px', fontWeight: 900, margin: 0, letterSpacing: '-0.3px' }}>
            {appName || 'مُنظِّم حياتك وفلوسك'}
          </h2>
          <p style={{ fontSize: '11.5px', opacity: 0.95, marginTop: '3px', marginBottom: 0, lineHeight: 1.4 }}>
            {tab === 'register'
              ? 'تسجيل حساب حقيقي موثق لأول مرة على هذا الجهاز'
              : 'تسجيل الدخول واسترجاع بياناتك بعد تنزيل التطبيق'}
          </p>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '10.5px',
              fontWeight: 600,
              marginTop: '6px',
              maxWidth: '100%',
              boxSizing: 'border-box',
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            <span>📱</span>
            <span>حفظ تلقائي لهوية هذا الجهاز دون الحاجة لإعادة التسجيل</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            background: 'var(--surface2)',
            padding: '3px',
            margin: '8px 12px 0',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            flexShrink: 0,
            gap: '4px',
            boxSizing: 'border-box',
          }}
        >
          <button
            type="button"
            style={{
              flex: 1,
              padding: '8px 6px',
              borderRadius: '9px',
              border: 'none',
              background: tab === 'register' ? 'var(--surface)' : 'transparent',
              color: tab === 'register' ? '#1877F2' : 'var(--muted)',
              fontWeight: tab === 'register' ? 800 : 600,
              fontSize: '12px',
              boxShadow: tab === 'register' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.18s ease',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              textAlign: 'center',
            }}
            onClick={() => {
              setTab('register');
              setErrorNotice(null);
            }}
          >
            ✍️ تسجيل جديد
          </button>
          <button
            type="button"
            style={{
              flex: 1,
              padding: '8px 6px',
              borderRadius: '9px',
              border: 'none',
              background: tab === 'login' ? 'var(--surface)' : 'transparent',
              color: tab === 'login' ? '#1877F2' : 'var(--muted)',
              fontWeight: tab === 'login' ? 800 : 600,
              fontSize: '12px',
              boxShadow: tab === 'login' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.18s ease',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              textAlign: 'center',
            }}
            onClick={() => {
              setTab('login');
              setErrorNotice(null);
            }}
          >
            🔄 استرجاع حسابي
          </button>
        </div>

        {/* Modal Form Body - Internal Smooth Scrolling */}
        <div
          style={{
            padding: '12px 14px 16px',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            flex: 1,
          }}
        >
          {/* Error Notice */}
          {errorNotice && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '8px 12px',
                borderRadius: '10px',
                fontSize: '11.5px',
                fontWeight: 600,
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>⚠️</span>
              <span>{errorNotice}</span>
            </div>
          )}

          {tab === 'register' ? (
            /* Registration Form */
            <form onSubmit={handleRegister}>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
                  اسمك الكريم (الاسم الأول واسم العائلة) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: محمد أحمد علي"
                  className="form-control"
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    border: '1.5px solid var(--border)',
                  }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
                  رقم هاتفك المحمول <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="مثال: 01012345678 أو 0501234567"
                  className="form-control"
                  style={{
                    direction: 'ltr',
                    textAlign: 'right',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    border: '1.5px solid var(--border)',
                  }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <span style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px', display: 'block' }}>
                  يُستخدم رقم هاتفك كمعرّف أساسي لحسابك واسترجاع بياناتك عند الحاجة.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
                  كلمة المرور / الرمز السري للحساب <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="6 خانات أو أكثر (أرقام أو أحرف)"
                    className="form-control"
                    style={{
                      direction: 'ltr',
                      padding: '10px 38px 10px 12px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      border: '1.5px solid var(--border)',
                    }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--muted)',
                      fontSize: '14px',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'إخفاء' : 'إظهار'}
                  >
                    {showPassword ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
                  تأكيد كلمة المرور <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="أعد كتابة كلمة المرور للتأكيد"
                  className="form-control"
                  style={{
                    direction: 'ltr',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    border: '1.5px solid var(--border)',
                  }}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div
                style={{
                  background: 'var(--surface2)',
                  padding: '8px 10px',
                  borderRadius: '10px',
                  fontSize: '10.5px',
                  color: 'var(--text)',
                  marginBottom: '12px',
                  lineHeight: 1.5,
                  border: '1px solid var(--border)',
                }}
              >
                🔒 <strong>تأكيد تلقائي:</strong> سيحفظ النظام بياناتك على هذا الجهاز وسيتعرف عليك دائماً كصاحب الجهاز دون طلب التسجيل مجدداً.
              </div>

              <button
                type="submit"
                className="btn"
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  background: 'linear-gradient(135deg, #1877F2 0%, #0d5bb5 100%)',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(24, 119, 242, 0.35)',
                  cursor: loading ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                disabled={loading}
              >
                {loading ? 'جاري توثيق الحساب والجهاز...' : 'تسجيل وتوثيق هذا الجهاز 🚀'}
              </button>
            </form>
          ) : (
            /* Login Form (After reinstall or clearing data) */
            <form onSubmit={handleLogin}>
              <div
                style={{
                  background: 'rgba(24, 119, 242, 0.08)',
                  border: '1px solid rgba(24, 119, 242, 0.2)',
                  color: 'var(--text)',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  fontSize: '11.5px',
                  marginBottom: '12px',
                  lineHeight: 1.5,
                }}
              >
                💡 <strong>استرجاع الحساب:</strong> أدخل رقم هاتفك المسجل وكلمة المرور وسيقوم النظام فوراً باسترجاع كافة حساباتك ومصاريفك وديونك المحفوظة.
              </div>

              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
                  رقم هاتفك المسجل <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="أدخل رقم هاتفك الذي سجلت به..."
                  className="form-control"
                  style={{
                    direction: 'ltr',
                    textAlign: 'right',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    border: '1.5px solid var(--border)',
                  }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, marginBottom: '4px', display: 'block' }}>
                  كلمة المرور / الرمز السري <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="كلمة مرور حسابك..."
                    className="form-control"
                    style={{
                      direction: 'ltr',
                      padding: '10px 38px 10px 12px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      border: '1.5px solid var(--border)',
                    }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--muted)',
                      fontSize: '14px',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'إخفاء' : 'إظهار'}
                  >
                    {showPassword ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn"
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                  cursor: loading ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                disabled={loading}
              >
                {loading ? 'جاري استرجاع الحساب والبيانات...' : 'دخول واسترجاع بياناتي السحابية 🔄'}
              </button>
            </form>
          )}

          {/* Alternative Google Sign-in */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '12px 0 8px',
              gap: '10px',
            }}
          >
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ fontSize: '10.5px', color: 'var(--muted)', fontWeight: 600 }}>
              أو خيار الدخول بحساب Google
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          <button
            type="button"
            className="btn"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '9px 12px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '12px',
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            التسجيل المباشر بحساب Google
          </button>
        </div>
      </div>
    </div>
  );
};
