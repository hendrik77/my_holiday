import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { useT } from '../i18n/context';

interface ToastMessage {
  id: number;
  message: string;
  onUndo?: () => void;
}

let toastId = 0;
const listeners: Set<() => void> = new Set();
let currentToasts: ToastMessage[] = [];

function notify() {
  listeners.forEach((l) => l());
}

export function showToast(message: string, onUndo?: () => void) {
  const id = ++toastId;
  currentToasts = [...currentToasts, { id, message, onUndo }];
  notify();
  setTimeout(() => {
    currentToasts = currentToasts.filter((t) => t.id !== id);
    notify();
  }, 5000);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>(currentToasts);
  const { t } = useT();
  const undo = useStore((s) => s.undo);

  useEffect(() => {
    const listener = () => setToasts([...currentToasts]);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const dismiss = (id: number) => {
    currentToasts = currentToasts.filter((t) => t.id !== id);
    notify();
  };

  // Keyboard shortcuts for undo/redo
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
                onClick={() => { toast.onUndo?.(); dismiss(toast.id); }}
              >
                {t('toast.undo')}
              </button>
            )}
            <button className="toast-close-btn" onClick={() => dismiss(toast.id)}>
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
