import { useEffect, useState } from 'react';
import { useT } from '../i18n/useT';
import {
  dismissToast,
  getToasts,
  subscribeToasts,
  type ToastMessage,
} from './toastStore';

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>(getToasts());
  const { t } = useT();

  useEffect(() => subscribeToasts(() => setToasts([...getToasts()])), []);

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast">
          <span>{toast.message}</span>
          <div className="toast-actions">
            {toast.onUndo && (
              <button
                className="toast-undo-btn"
                onClick={() => { toast.onUndo?.(); dismissToast(toast.id); }}
              >
                {t('toast.undo')}
              </button>
            )}
            <button className="toast-close-btn" onClick={() => dismissToast(toast.id)}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
