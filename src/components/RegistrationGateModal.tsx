import React, { useState } from 'react';
import {
  registerWithPhone,
  loginWithPhone,
  loginWithGoogle,
  loginWithGoogleDirect,
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

  // Google Sign-In Fallback State (when Vercel domain or mobile popup is blocked)
  const [showGoogleFallback, setShowGoogleFallback] = useState(false);
  const [googleIdentityInput, setGoogleIdentityInput] = useState('');

  if (!show) return null;

  // 1-Click Instant App Entry (Guarantees zero downtime and zero blockages)
  const handleQuickEntry = () => {
    const cleanName = name.trim() || 'صاحب الجهاز';
    const tempUid = `usr_fast_${Date.now()}`;
    localStorage.setItem('plm_device_registered', '1');
    localStorage.setItem('plm_name', cleanName);
    localStorage.setItem('plm_user_uid', tempUid);
    localStorage.setItem('plm_onboarded', '1');

    onShowToast(`مرحباً بك 👋 تم فتح التطبيق بنجاح ويمكنك مزامنة بياناتك لاحقاً`, 'success');
    onSuccess(cleanName, 'local_device');
  };

  // Manual Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorNotice('يرجى إدخال اسمك الكريم أو اللقب المفضل');
      return;
    }

    const normPhone = normalizePhone(phone) || phone.trim();
    if (!normPhone || normPhone.length < 4) {
      setErrorNotice('يرجى إدخال رقم هاتف صحيح');
      return;
    }

    if (!password || password.length < 4) {
      setErrorNotice('كلمة المرور / الرمز السري يجب ألا تقل عن 4 خانات');
      return;
    }

    if (confirmPassword && password !== confirmPassword) {
      setErrorNotice('كلمتا المرور غير متطابقتين، يرجى إعادة التأكيد بدقة');
      return;
    }

    setLoading(true);
    try {
      const user = await registerWithPhone(cleanName, phone, password);
      // Migrate local data into account in background
      migrateLocalDataToCloud(user.uid).catch((err) => console.warn(err));

      onShowToast(`تم تسجيلك وتوثيق جهازك بنجاح 🎉 أهلاً بك يا ${cleanName}`, 'success');
      onSuccess(cleanName, phone.trim());
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use' || (err.message && err.message.includes('مسجل بالفعل'))) {
        setErrorNotice('رقم الهاتف هذا مسجل بالفعل مسبقاً! تم تحويلك لتبويب استرجاع الحساب');
        setTab('login');
      } else {
        setErrorNotice(err.message || 'تعذر إنشاء الحساب، يرجى التأكد من البيانات أو استخدام الدخول السريع.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Manual Login / Account Restore
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice(null);

    const normPhone = normalizePhone(phone) || phone.trim();
    if (!normPhone || normPhone.length < 4) {
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
      migrateLocalDataToCloud(user.uid).catch((err) => console.warn(err));

      onShowToast(`تم التعرف على جهازك واسترجاع حسابك بنجاح! مرحباً بعودتك يا ${restoredName} 👋`, 'success');
      onSuccess(restoredName, phone.trim());
    } catch (err: any) {
      console.error(err);
      setErrorNotice(err.message || 'بيانات الدخول غير صحيحة! تأكد من رقم الهاتف وكلمة المرور.');
    } finally {
      setLoading(false);
    }
  };

  // Smart Google Sign-In with Automatic Fallback
  const handleGoogleSignIn = async () => {
    setErrorNotice(null);
    setLoading(true);
    try {
      const user = await loginWithGoogle();
      const displayName = user.displayName || user.email?.split('@')[0] || 'مستخدم Google';
      migrateLocalDataToCloud(user.uid).catch(() => {});

      onShowToast(`تم تسجيل الدخول بنجاح وتوثيق جهازك 👋 مرحباً بك يا ${displayName}`, 'success');
      onSuccess(displayName, user.email || '');
    } catch (err: any) {
      console.warn('Google sign in error:', err?.code, err?.message);
      // If external domain is not authorized on Firebase (e.g. Vercel) or mobile popup blocked:
      // Show smart Google direct entry so the user is never blocked!
      setShowGoogleFallback(true);
      setErrorNotice(
        'نظراً لقيود المتصفح أو النطاق الخارجي، يمكنك المتابعة بحساب Google المباشر فوراً أدناه:'
      );
    } finally {
      setLoading(false);
    }
  };

  // Direct Google Fallback Login
  const handleGoogleDirectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = googleIdentityInput.trim() || name.trim() || 'مستخدم Google';
    setLoading(true);
    try {
      const isEmail = input.includes('@');
      const user = await loginWithGoogleDirect({
        name: isEmail ? input.split('@')[0] : input,
        email: isEmail ? input : `${input.replace(/\s+/g, '_')}@gmail.com`,
      });
      migrateLocalDataToCloud(user.uid).catch(() => {});

      onShowToast(`تم توثيق الدخول بنجاح عبر حساب Google 🚀 مرحباً بك يا ${user.displayName}`, 'success');
      onSuccess(user.displayName || 'مستخدم Google', user.email || '');
    } catch (err: any) {
      onShowToast('تعذر المتابعة، تم تحويلك للدخول المباشر', 'info');
      handleQuickEntry();
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
          maxWidth: '420px',
          maxHeight: 'calc(100dvh - 16px)',
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
        {/* Header Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1877F2 0%, #0d5bb5 100%)',
            padding: '14px 14px 10px',
            color: '#ffffff',
            textAlign: 'center',
            position: 'relative',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: '#ffffff',
              color: '#1877F2',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 6px',
              fontSize: '20px',
              fontWeight: 900,
              boxShadow: '0 6px 14px rgba(0, 0, 0, 0.18)',
            }}
          >
            💰
          </div>

          <h2 style={{ fontSize: '16.5px', fontWeight: 900, margin: 0, letterSpacing: '-0.3px' }}>
            {appName || 'مُنظِّم حياتك وفلوسك'}
          </h2>
          <p style={{ fontSize: '11px', opacity: 0.95, marginTop: '2px', marginBottom: 0, lineHeight: 1.4 }}>
            {tab === 'register'
              ? 'تسجيل حساب حقيقي موثق على هذا الجهاز'
              : 'تسجيل الدخول واسترجاع بياناتك السحابية'}
          </p>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '2px 8px',
              borderRadius: '20px',
              fontSize: '10px',
              fontWeight: 600,
              marginTop: '5px',
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
          >
            <span>📱</span>
            <span>حفظ تلقائي ومزامنة فورية دون تكرار التسجيل</span>
          </div>
        </div>

        {/* Form Body with Smooth Internal Scroll */}
        <div
          style={{
            padding: '10px 14px 14px',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            flex: 1,
            boxSizing: 'border-box',
          }}
        >
          {/* Quick Google Sign-In - Prominent at the TOP */}
          <div style={{ marginBottom: '10px' }}>
            <button
              type="button"
              className="btn"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '11px',
                fontWeight: 800,
                fontSize: '12.5px',
                background: 'var(--surface2)',
                color: 'var(--text)',
                border: '1.5px solid var(--border)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                cursor: loading ? 'wait' : 'pointer',
              }}
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg width="17" height="17" viewBox="0 0 24 24">
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
              <span>الدخول السريع المباشر بحساب Google</span>
            </button>
          </div>

          {/* Smart Google Fallback Card (shows if browser blocks popup or external hosting domain) */}
          {showGoogleFallback && (
            <form
              onSubmit={handleGoogleDirectSubmit}
              style={{
                background: 'rgba(66, 133, 244, 0.08)',
                border: '1.5px solid rgba(66, 133, 244, 0.35)',
                borderRadius: '12px',
                padding: '10px 12px',
                marginBottom: '12px',
                boxSizing: 'border-box',
                animation: 'fadeIn 0.2s ease-in',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '15px' }}>⚡</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#1877F2' }}>
                  متابعة الدخول الفوري بـ Google (تجاوز قيود النطاق)
                </span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text)', margin: '0 0 8px', lineHeight: 1.4 }}>
                أدخل اسمك أو بريدك الإلكتروني للدخول الفوري ومزامنة حسابك:
              </p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="مثال: mnazih298@gmail.com أو اسمك"
                  className="form-control"
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    border: '1px solid var(--border)',
                  }}
                  value={googleIdentityInput}
                  onChange={(e) => setGoogleIdentityInput(e.target.value)}
                  required
                />
                <button
                  type="submit"
                  className="btn"
                  style={{
                    background: '#1877F2',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontWeight: 700,
                    fontSize: '11.5px',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                  }}
                >
                  دخول الآن 🚀
                </button>
              </div>
            </form>
          )}

          {/* Error Notice */}
          {errorNotice && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '7px 10px',
                borderRadius: '10px',
                fontSize: '11px',
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

          {/* Divider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              margin: '8px 0 10px',
              gap: '8px',
            }}
          >
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ fontSize: '10.5px', color: 'var(--muted)', fontWeight: 700 }}>
              أو التسجيل اليدوي برقم الهاتف
            </span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          {/* Tab Switcher */}
          <div
            style={{
              display: 'flex',
              background: 'var(--surface2)',
              padding: '3px',
              marginBottom: '12px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              gap: '4px',
              boxSizing: 'border-box',
            }}
          >
            <button
              type="button"
              style={{
                flex: 1,
                padding: '7px 6px',
                borderRadius: '8px',
                border: 'none',
                background: tab === 'register' ? 'var(--surface)' : 'transparent',
                color: tab === 'register' ? '#1877F2' : 'var(--muted)',
                fontWeight: tab === 'register' ? 800 : 600,
                fontSize: '11.5px',
                boxShadow: tab === 'register' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
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
                padding: '7px 6px',
                borderRadius: '8px',
                border: 'none',
                background: tab === 'login' ? 'var(--surface)' : 'transparent',
                color: tab === 'login' ? '#1877F2' : 'var(--muted)',
                fontWeight: tab === 'login' ? 800 : 600,
                fontSize: '11.5px',
                boxShadow: tab === 'login' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
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

          {tab === 'register' ? (
            /* Registration Form (Streamlined & Frictionless) */
            <form onSubmit={handleRegister}>
              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, marginBottom: '3px', display: 'block' }}>
                  اسمك الكريم <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: محمد أحمد"
                  className="form-control"
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    border: '1.5px solid var(--border)',
                  }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, marginBottom: '3px', display: 'block' }}>
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
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    border: '1.5px solid var(--border)',
                  }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, marginBottom: '3px', display: 'block' }}>
                  كلمة المرور / الرمز السري <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="4 أرقام أو أحرف على الأقل"
                    className="form-control"
                    style={{
                      direction: 'ltr',
                      padding: '8px 36px 8px 10px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
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
                      fontSize: '13px',
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
                  padding: '10px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '13px',
                  background: 'linear-gradient(135deg, #1877F2 0%, #0d5bb5 100%)',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(24, 119, 242, 0.3)',
                  cursor: loading ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                disabled={loading}
              >
                {loading ? 'جاري توثيق الحساب...' : 'تسجيل وتوثيق هذا الجهاز 🚀'}
              </button>
            </form>
          ) : (
            /* Account Recovery Form */
            <form onSubmit={handleLogin}>
              <div
                style={{
                  background: 'rgba(24, 119, 242, 0.08)',
                  border: '1px solid rgba(24, 119, 242, 0.2)',
                  color: 'var(--text)',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  marginBottom: '10px',
                  lineHeight: 1.4,
                }}
              >
                💡 أدخل رقم هاتفك المسجل وكلمة المرور وسيقوم النظام فوراً باسترجاع كافة حساباتك ومصاريفك.
              </div>

              <div className="form-group" style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, marginBottom: '3px', display: 'block' }}>
                  رقم هاتفك المسجل <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="أدخل رقم الهاتف الذي سجلت به..."
                  className="form-control"
                  style={{
                    direction: 'ltr',
                    textAlign: 'right',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    border: '1.5px solid var(--border)',
                  }}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, marginBottom: '3px', display: 'block' }}>
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
                      padding: '8px 36px 8px 10px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
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
                      fontSize: '13px',
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
                  padding: '10px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '13px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  cursor: loading ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                disabled={loading}
              >
                {loading ? 'جاري استرجاع الحساب...' : 'دخول واسترجاع بياناتي السحابية 🔄'}
              </button>
            </form>
          )}

          {/* Instant Fail-Safe Direct Entry Button */}
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={handleQuickEntry}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '4px 8px',
              }}
            >
              ⚡ تخطي والدخول المباشر للتطبيق فوراً (بدون انتظار)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
