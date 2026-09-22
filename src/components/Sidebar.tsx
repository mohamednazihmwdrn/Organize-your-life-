import React, { useRef } from 'react';
import { PageId, CommercialConfig } from '../types';
import { User } from 'firebase/auth';

interface SidebarProps {
  isOpen: boolean;
  currentPage: PageId;
  userName: string;
  config: CommercialConfig;
  currentUser: User | null;
  onNavigate: (page: PageId) => void;
  onClose: () => void;
  onOwnerTapTrigger: () => void;
  onOpenAuthModal: () => void;
  onLogout: () => void;
}

const NAV_ITEMS: { id: PageId; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '🏠', label: 'الرئيسية' },
  { id: 'money', icon: '💰', label: 'المال والحسابات' },
  { id: 'obligations', icon: '💳', label: 'الديون والأقساط' },
  { id: 'bills', icon: '🧾', label: 'الفواتير' },
  { id: 'subscriptions', icon: '🔁', label: 'الاشتراكات' },
  { id: 'reminders', icon: '🔔', label: 'التذكيرات' },
  { id: 'goals', icon: '🎯', label: 'الأهداف' },
  { id: 'documents', icon: '📂', label: 'المستندات' },
  { id: 'budgets', icon: '📌', label: 'الميزانيات' },
  { id: 'reports', icon: '📊', label: 'التقارير' },
  { id: 'plans', icon: '💎', label: 'الخطط والاشتراك' },
  { id: 'promotions', icon: '📣', label: 'التطبيقات والخدمات' },
  { id: 'legal', icon: '⚖️', label: 'الخصوصية والشروط' },
  { id: 'settings', icon: '⚙️', label: 'الإعدادات' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  currentPage,
  userName,
  config,
  currentUser,
  onNavigate,
  onClose,
  onOwnerTapTrigger,
  onOpenAuthModal,
  onLogout,
}) => {
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTitleClick = () => {
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapCountRef.current += 1;
    if (tapCountRef.current >= 5) {
      tapCountRef.current = 0;
      onOwnerTapTrigger();
    } else {
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, 1400);
    }
  };

  const sections = config.sections || {};

  return (
    <>
      <div
        className={`overlay ${isOpen ? 'show' : ''}`}
        id="overlay"
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="sidebar">
        <div
          className="brand"
          onClick={handleTitleClick}
          style={{ cursor: 'pointer', userSelect: 'none' }}
          title="اضغط 5 مرات لفتح لوحة المالك"
        >
          <div className="brand-icon">💰</div>
          <div>
            <h1 id="brandOwnerTrigger">
              {config.name || 'مُنظِّم حياتك وفلوسك'}
            </h1>
            <small>Personal Life Manager V2</small>
          </div>
        </div>

        <nav className="nav">
          {NAV_ITEMS.map((item) => {
            if (sections[item.id] === false && item.id !== 'dashboard') {
              return null;
            }
            return (
              <button
                key={item.id}
                type="button"
                data-page={item.id}
                className={currentPage === item.id ? 'active' : ''}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
              >
                <span className="ico">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
          {currentPage === 'owner' && (
            <button
              type="button"
              data-page="owner"
              className="active"
              style={{ background: '#fef3c7', color: '#a16207', fontWeight: 800 }}
              onClick={() => {
                onNavigate('owner');
                onClose();
              }}
            >
              <span className="ico">👑</span>
              لوحة المالك (نشطة)
            </button>
          )}
        </nav>

        <div className="sidebar-foot">
          <div className="user-mini" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{currentUser ? '🟢' : '🟡'}</span>
                <span id="sideUser" style={{ fontWeight: 800 }}>
                  {currentUser ? (currentUser.displayName || userName) : userName}
                </span>
              </div>
              {currentUser ? (
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  onClick={onLogout}
                  title="تسجيل الخروج"
                >
                  خروج
                </button>
              ) : (
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    onClose();
                    onOpenAuthModal();
                  }}
                >
                  دخول
                </button>
              )}
            </div>
            <small className="muted" style={{ display: 'block', fontSize: '10px' }}>
              {currentUser ? 'حساب سحابي خاص ومحمي (Online & Offline)' : 'وضع محلي (غير مسجل)'}
            </small>
          </div>

          <div
            style={{
              fontSize: '10px',
              color: 'var(--muted)',
              lineHeight: 1.8,
              marginTop: '9px',
              textAlign: 'center',
            }}
          >
            © {config.year || 2026} {config.owner || 'Mohamed Nazih'}
            <br />
            جميع الحقوق محفوظة
            <br />
            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: '9px', padding: '4px 7px', marginTop: '4px' }}
              onClick={() => {
                onNavigate('legal');
                onClose();
              }}
            >
              الخصوصية والشروط
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
