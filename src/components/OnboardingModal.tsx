import React, { useState } from 'react';

interface OnboardingModalProps {
  show: boolean;
  appName: string;
  onStart: (name: string) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  show,
  appName,
  onStart,
}) => {
  const [name, setName] = useState('');

  if (!show) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(name.trim() || 'مستخدم');
  };

  return (
    <div id="onboarding" className="onboarding">
      <div className="welcome">
        <div className="logo">💰</div>
        <h2>{appName || 'مُنظِّم حياتك وفلوسك'}</h2>
        <p>
          كل فلوسك والتزاماتك وأهدافك وتذكيراتك في مكان واحد.
          <br />
          بياناتك محلية ومحفوظة بآمان على جهازك.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ textAlign: 'right', marginBottom: '12px' }}>
            <label>اسمك الكريِم</label>
            <input
              id="welcomeName"
              className="form-control"
              placeholder="مثال: محمد"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            ابدأ الآن 🚀
          </button>
        </form>
      </div>
    </div>
  );
};
