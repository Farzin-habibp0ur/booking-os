'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from './cn';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {typeof window !== 'undefined' &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" role="region" aria-label="Notifications">
            {toasts.map((t) => (
              <div
                key={t.id}
                role="alert"
                aria-live="assertive"
                className={cn(
                  'pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all animate-in slide-in-from-right fade-in duration-200 min-w-[280px]',
                  t.type === 'success' && 'bg-green-600 text-white',
                  t.type === 'error' && 'bg-red-600 text-white',
                  t.type === 'info' && 'bg-blue-600 text-white',
                )}
              >
                {t.type === 'success' && <CheckCircle2 size={16} />}
                {t.type === 'error' && <AlertCircle size={16} />}
                {t.type === 'info' && <Info size={16} />}
                <span className="flex-1">{t.message}</span>
                <button onClick={() => removeToast(t.id)} className="opacity-70 hover:opacity-100">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
