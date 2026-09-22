import React from 'react';
import { PageId } from '../types';

interface BottomNavProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentPage,
  onNavigate,
}) => {
  return (
    <nav className="bottom-nav">
      <button
        type="button"
        data-page="dashboard"
        className={currentPage === 'dashboard' ? 'active' : ''}
        onClick={() => onNavigate('dashboard')}
      >
        <span>🏠</span>الرئيسية
      </button>
      <button
        type="button"
        data-page="money"
        className={currentPage === 'money' ? 'active' : ''}
        onClick={() => onNavigate('money')}
      >
        <span>💰</span>المال
      </button>
      <button
        type="button"
        data-page="obligations"
        className={currentPage === 'obligations' ? 'active' : ''}
        onClick={() => onNavigate('obligations')}
      >
        <span>💳</span>التزامات
      </button>
      <button
        type="button"
        data-page="goals"
        className={currentPage === 'goals' ? 'active' : ''}
        onClick={() => onNavigate('goals')}
      >
        <span>🎯</span>أهداف
      </button>
      <button
        type="button"
        data-page="settings"
        className={currentPage === 'settings' ? 'active' : ''}
        onClick={() => onNavigate('settings')}
      >
        <span>⚙️</span>المزيد
      </button>
    </nav>
  );
};
