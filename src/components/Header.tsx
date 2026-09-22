import React, { useRef } from 'react';
import { PageId } from '../types';
import { User } from 'firebase/auth';

interface HeaderProps {
  currentPage: PageId;
  pageTitle: string;
  todayText: string;
  currentUser: User | null;
  onGoBack: () => void;
  onOpenSidebar: () => void;
  onRefresh: () => void;
  onToggleTheme: () => void;
  onQuickAdd: () => void;
  onOpenAuthModal: () => void;
  onOwnerTapTrigger: () => void;
  onOpenInstallModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  pageTitle,
  todayText,
  currentUser,
  onGoBack,
  onOpenSidebar,
  onRefresh,
  onToggleTheme,
  onQuickAdd,
  onOpenAuthModal,
  onOwnerTapTrigger,
  onOpenInstallModal,
}) => {
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTitleTap = () => {
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

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {currentPage !== 'dashboard' && (
          <button
            id="backBtn"
            className="icon-btn top-back-btn"
            title="رجوع"
            onClick={onGoBack}
          >
            ‹
          </button>
        )}
        <button
          type="button"
          className="icon-btn menu-mobile"
          title="القائمة"
          onClick={onOpenSidebar}
        >
          ☰
        </button>
        <div
          className="top-title"
          onClick={handleTitleTap}
          style={{ cursor: 'pointer', userSelect: 'none' }}
          title="اضغط 5 مرات لفتح لوحة المالك"
        >
          <h2 id="pageTitle">{pageTitle}</h2>
          <small id="todayText">{todayText}</small>
        </div>
      </div>
      <div className="top-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {currentUser ? (
          <button
            type="button"
            className="icon-btn"
            title={`مسجل دخول: ${currentUser.email}`}
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#10b981',
              fontSize: '13px',
              fontWeight: 800,
              padding: '0 8px',
              borderRadius: '8px',
              width: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            onClick={onOpenAuthModal}
          >
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }}></span>
            <span style={{ fontSize: '11px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser.displayName || currentUser.email?.split('@')[0] || 'حسابي'}
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-outline"
            style={{
              fontSize: '11px',
              padding: '5px 9px',
              borderRadius: '8px',
              fontWeight: 800,
              borderColor: 'var(--primary)',
              color: 'var(--primary)',
            }}
            onClick={onOpenAuthModal}
          >
            دخول / تسجيل
          </button>
        )}
        {onOpenInstallModal && (
          <button
            type="button"
            className="icon-btn"
            title="تثبيت التطبيق على الهاتف"
            onClick={onOpenInstallModal}
            style={{ color: '#2563eb', fontWeight: 800 }}
          >
            📲
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          title="تحديث البيانات"
          onClick={onRefresh}
        >
          ↻
        </button>
        <button
          type="button"
          className="icon-btn"
          title="الوضع الليلي"
          onClick={onToggleTheme}
        >
          🌙
        </button>
        <button
          type="button"
          className="icon-btn"
          title="إضافة سريعة"
          onClick={onQuickAdd}
        >
          ＋
        </button>
      </div>
    </header>
  );
};
