import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

interface AlertDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  variant?: AlertVariant;
}

const VARIANTS = {
  success: {
    icon: CheckCircle,
    iconClass: 'text-green-600',
    bgClass: 'bg-green-100',
    defaultTitle: 'Sucesso',
    btnClass: 'bg-green-600 hover:bg-green-700'
  },
  error: {
    icon: XCircle,
    iconClass: 'text-red-600',
    bgClass: 'bg-red-100',
    defaultTitle: 'Erro',
    btnClass: 'bg-red-600 hover:bg-red-700'
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-yellow-600',
    bgClass: 'bg-yellow-100',
    defaultTitle: 'Atenção',
    btnClass: 'bg-yellow-600 hover:bg-yellow-700'
  },
  info: {
    icon: Info,
    iconClass: 'text-blue-600',
    bgClass: 'bg-blue-100',
    defaultTitle: 'Informação',
    btnClass: 'bg-blue-600 hover:bg-blue-700'
  }
};

export const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  title,
  message,
  onClose,
  variant = 'info'
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { icon: Icon, iconClass, bgClass, defaultTitle, btnClass } = VARIANTS[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full animate-fade-in">
        <div className="p-6">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${bgClass}`}>
            <Icon size={24} className={iconClass} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 text-center mb-2">
            {title || defaultTitle}
          </h3>
          <p className="text-sm text-slate-500 text-center">{message}</p>
        </div>
        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className={`w-full px-4 py-2 text-white rounded-lg font-medium transition-colors ${btnClass}`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
