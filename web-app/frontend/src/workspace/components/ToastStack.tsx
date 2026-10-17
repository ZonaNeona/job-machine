import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type { Toast } from '../useWorkspace';

interface ToastStackProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast ${toast.tone}`} key={toast.id}>
          {toast.tone === 'success' ? <CheckCircle2 size={15} />
            : toast.tone === 'error' ? <AlertCircle size={15} />
              : <Info size={15} />}
          <span>{toast.message}</span>
          <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Закрыть уведомление">
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
