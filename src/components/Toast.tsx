import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useStore.getState().undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        useStore.getState().redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
