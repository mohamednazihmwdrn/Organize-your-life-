import React from 'react';

interface ModalProps {
  show: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  show,
  title,
  onClose,
  children,
  footer,
}) => {
  if (!show) return null;

  return (
    <div
      id="modal"
      className="modal-backdrop show"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <h4 id="modalTitle">{title}</h4>
          <button type="button" className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div id="modalBody" className="modal-body">
          {children}
        </div>
        {footer && (
          <div id="modalFoot" className="modal-foot">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
