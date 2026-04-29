export interface ToastMessage {
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
  setTimeout(() => dismissToast(id), 5000);
}

export function dismissToast(id: number) {
  currentToasts = currentToasts.filter((t) => t.id !== id);
  notify();
}

export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getToasts(): ToastMessage[] {
  return currentToasts;
}
