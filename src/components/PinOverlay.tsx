import React, { useState } from 'react';
import { simplePinHash } from '../lib/utils';

interface PinOverlayProps {
  show: boolean;
  onSuccess: () => void;
}

export const PinOverlay: React.FC<PinOverlayProps> = ({ show, onSuccess }) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!show) return null;

  const handleUnlock = () => {
    const savedHash = localStorage.getItem('plm_pin_hash');
    if (simplePinHash(pinInput) === savedHash) {
      sessionStorage.setItem('plm_unlocked', '1');
      setErrorMsg('');
      setPinInput('');
      onSuccess();
    } else {
      setErrorMsg('رمز PIN غير صحيح.');
    }
  };

  return (
    <div id="pinOverlay" className="pin-overlay show">
      <div className="pin-card">
        <div className="pin-logo">🔐</div>
        <h3>التطبيق مقفول</h3>
        <p className="muted" style={{ fontSize: '12px', lineHeight: 1.8, margin: '8px 0 15px' }}>
          أدخل رمز PIN لفتح بياناتك على هذا الجهاز.
        </p>
        <input
          id="unlockPin"
          className="form-control"
          type="password"
          inputMode="numeric"
          maxLength={8}
          placeholder="رمز PIN"
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleUnlock();
          }}
        />
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '10px' }}
          onClick={handleUnlock}
        >
          فتح التطبيق
        </button>
        {errorMsg && (
          <div id="pinError" style={{ color: 'var(--danger)', fontSize: '11px', marginTop: '9px' }}>
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
};
