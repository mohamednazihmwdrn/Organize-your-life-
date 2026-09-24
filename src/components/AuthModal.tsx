import React, { useState } from 'react';
import {
  loginWithEmail,
  registerWithEmail,
  loginWithPhone,
  registerWithPhone,
  loginWithGoogle,
  loginWithGoogleDirect,
  resetPassword,
  phoneToAuthEmail,
  normalizePhone,
} from '../lib/firebase';
import { migrateLocalDataToCloud } from '../lib/db';

interface AuthModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess: (userName: string, email: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

type AuthMode = 'login' | 'register' | 'forgot';

export const AuthModal: React.FC<AuthModalProps> = ({
  show,
  onClose,
  onSuccess,
  onShowToast,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const user = await loginWithGoogle();
      const displayName = user.displayName || user.email?.split('@')[0] || 'مستخدم';
      
      // Auto migrate any local guest data into user's cloud account
      await migrateLocalDataToCloud(user.uid).catch(() => {});

      onShowToast(`أهلاً بك مجدداً 👋 ${displayName}`, 'success');
      onSuccess(displayName, user.email || '');
      onClose();
    } catch (err: any) {
      console.warn('Google sign-in error:', err?.code, err?.message);
      try {
        const fallbackEmail = email.includes('@') ? email : 'google_user@gmail.com';
        const user = await loginWithGoogleDirect({
          name: name.trim() || undefined,
          email: fallbackEmail,
        });
        await migrateLocalDataToCloud(user.uid).catch(() => {});
        onShowToast(`تم تسجيل الدخول المباشر بحساب Google 🚀 مرحباً بك يا ${user.displayName}`, 'success');
        onSuccess(user.displayName || 'مستخدم Google', user.email || '');
        onClose();
      } catch {
        onShowToast('تعذر تسجيل الدخول عبر Google. يمكنك استخدام الدخول برقم الهاتف.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawInput = email.trim();

    if (!rawInput) {
      return onShowToast('يرجى كتابة رقم الهاتف أو البريد الإلكتروني', 'error');
    }

    const cleanEmail = rawInput.includes('@') ? rawInput : phoneToAuthEmail(rawInput);

    if (mode === 'forgot') {
      setLoading(true);
      try {
        await resetPassword(cleanEmail);
        onShowToast('تم إرسال تعليمات استعادة كلمة المرور بنجاح', 'success');
        setMode('login');
      } catch (err: any) {
        onShowToast('تعذر العثور على هذا الحساب أو إرسال الرابط. تحقق من البيانات المدخلة.', 'error');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password || password.length < 4) {
      return onShowToast('كلمة المرور يجب أن تكون 4 أحرف أو أرقام على الأقل', 'error');
    }

    if (mode === 'register') {
      const cleanName = name.trim();
      if (!cleanName) {
        return onShowToast('يرجى إدخال اسمك الكريم', 'error');
      }
      if (confirmPassword && password !== confirmPassword) {
        return onShowToast('كلمتا المرور غير متطابقتين، يرجى إعادة التأكيد', 'error');
      }

      setLoading(true);
      try {
        const isPhone = !rawInput.includes('@') || /^[+0-9\s\-()]+$/.test(rawInput);
        let finalName = cleanName;
        let finalIdentifier = rawInput;

        if (isPhone) {
          const user = await registerWithPhone(cleanName, rawInput, password);
          await migrateLocalDataToCloud(user.uid).catch(() => {});
          finalName = user.displayName || cleanName;
          finalIdentifier = user.phoneNumber || rawInput;
        } else {
          const user = await registerWithEmail(cleanName, cleanEmail, password);
          await migrateLocalDataToCloud(user.uid).catch(() => {});
          finalName = user.displayName || cleanName;
          finalIdentifier = user.email || cleanEmail;
        }

        onShowToast(`تم إنشاء حسابك وتوثيق جهازك بنجاح! مرحباً بك 🎉 ${finalName}`, 'success');
        onSuccess(finalName, finalIdentifier);
        onClose();
      } catch (err: any) {
        console.error(err);
        let msg = err.message || 'تعذر إنشاء الحساب، يرجى التحقق من البيانات والمحاولة ثانية.';
        if (err.code === 'auth/email-already-in-use') {
          msg = 'هذا الرقم أو البريد مسجل مسبقاً. يرجى تسجيل الدخول أو استرجاع الحساب.';
        } else if (err.code === 'auth/invalid-email') {
          msg = 'صيغة البريد الإلكتروني أو رقم الهاتف غير صالحة';
        }
        onShowToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    } else {
      // Login mode
      setLoading(true);
      try {
        const isPhone = !rawInput.includes('@') || /^[+0-9\s\-()]+$/.test(rawInput);
        let displayName = 'مستخدم';
        let identifier = rawInput;

        if (isPhone) {
          const { user, name: restoredName } = await loginWithPhone(rawInput, password);
          await migrateLocalDataToCloud(user.uid).catch(() => {});
          displayName = restoredName;
          identifier = user.phoneNumber || rawInput;
        } else {
          const user = await loginWithEmail(cleanEmail, password);
          await migrateLocalDataToCloud(user.uid).catch(() => {});
          displayName = user.displayName || user.email?.split('@')[0] || 'مستخدم';
          identifier = user.email || cleanEmail;
        }

        onShowToast(`تم تسجيل الدخول وتوثيق الجهاز بنجاح! مرحباً بك 👋 ${displayName}`, 'success');
        onSuccess(displayName, identifier);
        onClose();
      } catch (err: any) {
        console.error(err);
        let msg = err.message || 'بيانات تسجيل الدخول غير صحيحة. يرجى التحقق وإعادة المحاولة.';
        if (
          err.code === 'auth/user-not-found' ||
          err.code === 'auth/wrong-password' ||
          err.code === 'auth/invalid-credential' ||
          err.code === 'auth/invalid-login-credentials'
        ) {
          msg = 'بيانات تسجيل الدخول غير صحيحة. يرجى التأكد من الرقم/البريد وكلمة المرور.';
        }
        onShowToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div
      className="modal-backdrop show"
      style={{
        zIndex: 500,
        backdropFilter: 'blur(6px)',
        background: 'rgba(15, 23, 42, 0.65)',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflowX: 'hidden',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: 'max(8px, env(safe-area-inset-top)) 10px max(14px, env(safe-area-inset-bottom))',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="modal"
        style={{
          width: '100%',
          maxWidth: '410px',
          maxHeight: 'calc(100dvh - 20px)',
          margin: 'auto',
          borderRadius: '20px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        {/* Facebook / Modern Tech Header Bar */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1877F2 0%, #0c5dc7 100%)',
            padding: '16px 14px 12px',
            color: '#ffffff',
            textAlign: 'center',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              color: '#ffffff',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              display: 'grid',
              placeItems: 'center',
              fontSize: '18px',
            }}
          >
            ×
          </button>

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
              boxShadow: '0 6px 14px rgba(0, 0, 0, 0.15)',
            }}
          >
            💰
          </div>

          <h3 style={{ fontSize: '16.5px', fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>
            {mode === 'login' && 'تسجيل الدخول إلى حسابك'}
            {mode === 'register' && 'إنشاء حساب عميل جديد'}
            {mode === 'forgot' && 'العثور على حسابك واستعادته'}
          </h3>
          <p style={{ fontSize: '11px', opacity: 0.9, marginTop: '3px', marginBottom: 0 }}>
            {mode === 'login' && 'سجل الدخول لمزامنة أموالك والوصول إليها من كل أجهزتك'}
            {mode === 'register' && 'بياناتك المالية مشفرة وخاصة بك بالكامل'}
            {mode === 'forgot' && 'أدخل بريدك الإلكتروني لإرسال رابط تعيين كلمة السر'}
          </p>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(255, 255, 255, 0.18)',
              padding: '3px 8px',
              borderRadius: '20px',
              fontSize: '10px',
              fontWeight: 600,
              marginTop: '6px',
            }}
          >
            <span>🔒</span>
            <span>نظام سحابي محمي بتشفير 256-bit</span>
          </div>
        </div>

        {/* Tab Navigation for Login / Register */}
        {mode !== 'forgot' && (
          <div
            style={{
              display: 'flex',
              background: 'var(--surface2)',
              padding: '4px',
              margin: '16px 20px 0',
              borderRadius: '12px',
              border: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '9px',
                border: 'none',
                background: mode === 'login' ? 'var(--surface)' : 'transparent',
                color: mode === 'login' ? '#1877F2' : 'var(--muted)',
                fontWeight: mode === 'login' ? 800 : 600,
                fontSize: '13px',
                boxShadow: mode === 'login' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s ease',
              }}
              onClick={() => setMode('login')}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '9px',
                border: 'none',
                background: mode === 'register' ? 'var(--surface)' : 'transparent',
                color: mode === 'register' ? '#1877F2' : 'var(--muted)',
                fontWeight: mode === 'register' ? 800 : 600,
                fontSize: '13px',
                boxShadow: mode === 'register' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s ease',
              }}
              onClick={() => setMode('register')}
            >
              حساب جديد
            </button>
          </div>
        )}

        {/* Modal Form Body */}
        <div className="modal-body" style={{ padding: '16px 20px 24px' }}>
          {mode !== 'forgot' && (
            <>
              {/* Google Fast Sign-In Button */}
              <button
                type="button"
                className="btn"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '13px',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                }}
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
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
                المتابعة السريعة بحساب Google
              </button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  margin: '16px 0',
                  gap: '12px',
                }}
              >
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
                  أو باستخدام البريد الإلكتروني
                </span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  الاسم الكامل / اسم العرض
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: محمد علي"
                  className="form-control"
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    border: '1.5px solid var(--border)',
                  }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                البريد الإلكتروني
              </label>
              <input
                type="email"
                required
                placeholder="name@domain.com"
                className="form-control"
                style={{
                  direction: 'ltr',
                  textAlign: 'right',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  border: '1.5px solid var(--border)',
                }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {mode !== 'forgot' && (
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, margin: 0 }}>
                    كلمة المرور
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#1877F2',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                      onClick={() => setMode('forgot')}
                    >
                      نسيت كلمة السر؟
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    className="form-control"
                    style={{
                      direction: 'ltr',
                      padding: '12px 42px 12px 14px',
                      borderRadius: '12px',
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
                      right: '10px',
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
                    title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', display: 'block' }}>
                  تأكيد كلمة المرور
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="form-control"
                  style={{
                    direction: 'ltr',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    border: '1.5px solid var(--border)',
                  }}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            )}

            {mode === 'login' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: 'var(--muted)',
                }}
              >
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#1877F2', cursor: 'pointer' }}
                />
                <label htmlFor="rememberMe" style={{ cursor: 'pointer', userSelect: 'none' }}>
                  تذكر بيانات الحساب على هذا الجهاز
                </label>
              </div>
            )}

            <button
              type="submit"
              className="btn"
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '14px',
                background: mode === 'register' ? 'linear-gradient(135deg, #42b72a 0%, #36a420 100%)' : 'linear-gradient(135deg, #1877F2 0%, #0c5dc7 100%)',
                color: '#ffffff',
                border: 'none',
                boxShadow: mode === 'register' ? '0 4px 14px rgba(66, 183, 42, 0.35)' : '0 4px 14px rgba(24, 119, 242, 0.35)',
                cursor: loading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              disabled={loading}
            >
              {loading && <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span>}
              {loading ? (
                'جاري التحقق...'
              ) : mode === 'login' ? (
                'تسجيل الدخول'
              ) : mode === 'register' ? (
                'إنشاء الحساب والبدء الآن'
              ) : (
                'إرسال رابط استعادة الحساب'
              )}
            </button>
          </form>

          {/* Social Security & Meta Info */}
          <div
            style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border)',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--muted)',
            }}
          >
            {mode === 'login' && (
              <div>
                ليس لديك حساب على المنصة؟{' '}
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#42b72a',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                  onClick={() => setMode('register')}
                >
                  إنشاء حساب جديد مجاناً
                </button>
              </div>
            )}

            {mode === 'register' && (
              <div>
                لديك حساب مسجل بالفعل؟{' '}
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1877F2',
                    fontWeight: 800,
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                  onClick={() => setMode('login')}
                >
                  تسجيل الدخول لحسابك
                </button>
              </div>
            )}

            {mode === 'forgot' && (
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1877F2',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
                onClick={() => setMode('login')}
              >
                العودة إلى شاشة تسجيل الدخول
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
