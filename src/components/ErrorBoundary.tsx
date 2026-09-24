import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleHardReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
          await caches.delete(key);
        }
      }
    } catch (e) {
      console.warn('Error clearing caches:', e);
    }
    window.location.reload();
  };

  private handleBypassToApp = () => {
    try {
      localStorage.setItem('plm_device_registered', '1');
      localStorage.setItem('plm_name', 'صاحب الجهاز');
      localStorage.setItem('plm_onboarded', '1');
    } catch (e) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            fontFamily: 'Cairo, Tajawal, system-ui, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              maxWidth: '460px',
              width: '100%',
              backgroundColor: '#1e293b',
              borderRadius: '20px',
              padding: '24px 20px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 16px',
                fontSize: '28px',
              }}
            >
              ⚠️
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px', color: '#ffffff' }}>
              مُنظِّم حياتك وفلوسك
            </h2>

            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '20px' }}>
              حدث تعارض في الذاكرة المؤقتة للتحديث الأخير. اضغط على الزر أدناه لتحديث التطبيق والفتح فوراً:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={this.handleHardReload}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#1877F2',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(24, 119, 242, 0.4)',
                }}
              >
                <span>🔄</span>
                <span>تحديث التطبيق ومسح الذاكرة المؤقتة فوراً</span>
              </button>

              <button
                type="button"
                onClick={this.handleBypassToApp}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#334155',
                  color: '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <span>⚡</span>
                <span>تجاوز والفتح المباشر للتطبيق</span>
              </button>
            </div>

            {this.state.error && (
              <details style={{ marginTop: '18px', textAlign: 'left', direction: 'ltr' }}>
                <summary
                  style={{
                    color: '#64748b',
                    fontSize: '11px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  Technical Details (Click to view)
                </summary>
                <pre
                  style={{
                    fontSize: '10px',
                    background: '#0f172a',
                    padding: '10px',
                    borderRadius: '8px',
                    color: '#f87171',
                    overflowX: 'auto',
                    marginTop: '8px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: '120px',
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
