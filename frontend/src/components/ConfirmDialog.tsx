import React, { useEffect } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  children?: React.ReactNode;
  onConfirm: () => void;
  onClose: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  confirmDisabled?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  children,
  onConfirm,
  onClose,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  confirmDisabled = false
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const Icon = variant === 'danger' ? AlertTriangle : HelpCircle;
  const iconBg = variant === 'danger' ? 'bg-red-100' : 'bg-amber-100';
  const iconColor = variant === 'danger' ? 'text-red-600' : 'text-amber-600';
  const confirmBtn = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
    : 'bg-red-700 hover:bg-red-800 disabled:bg-red-300';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full animate-fade-in">
        <div className="p-6">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${iconBg}`}>
            <Icon size={24} className={iconColor} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 text-center mb-2">{title}</h3>
          {message && (
            <p className="text-sm text-slate-500 text-center">{message}</p>
          )}
          {children && <div className="mt-4">{children}</div>}
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors border border-slate-200"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onClose(); }}
            disabled={confirmDisabled}
            className={`flex-1 px-4 py-2 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
