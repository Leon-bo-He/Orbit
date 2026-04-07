import { useEffect } from 'react';
import { useToastStore, type Toast } from '../../store/toast.store.js';

const TYPE_STYLES: Record<Toast['type'], string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-blue-600 text-white',
  warning: 'bg-amber-500 text-white',
};

const TYPE_ICONS: Record<Toast['type'], string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

const AUTO_DISMISS_MS = 4000;

function ToastItem({ toast }: { toast: Toast }) {
  const remove = useToastStore((s) => s.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => remove(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, remove]);

  return (
    <div
      className={`flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg text-sm max-w-xs w-full pointer-events-auto
        translate-x-0 opacity-100 transition-all duration-300 ${TYPE_STYLES[toast.type]}`}
      style={{ animation: 'toast-slide-in 0.25s ease-out' }}
    >
      <span className="font-bold flex-shrink-0 mt-0.5">{TYPE_ICONS[toast.type]}</span>
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => remove(toast.id)}
        className="flex-shrink-0 opacity-70 hover:opacity-100 ml-1 leading-none"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 sm:right-4 left-4 sm:left-auto z-[9999] flex flex-col gap-2 items-end pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
