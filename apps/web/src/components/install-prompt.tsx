'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, X } from 'lucide-react';

const DISMISSED_KEY = 'pwa-install-dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Check if previously dismissed
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Detect iOS Safari
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isStandalone = (window.navigator as any).standalone === true;

    if (isiOS && !isStandalone) {
      setIsIos(true);
      setShowBanner(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  }, []);

  if (!showBanner) return null;

  return (
    <div
      className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:max-w-sm z-50 bg-white dark:bg-slate-900 rounded-2xl shadow-soft border border-slate-100 dark:border-slate-800 p-4"
      role="alert"
      data-testid="install-prompt"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 bg-sage-100 dark:bg-sage-900/30 rounded-xl flex items-center justify-center">
          <Download size={20} className="text-sage-600 dark:text-sage-400" />
        </div>
        <div className="flex-1 min-w-0">
          {isIos ? (
            <>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Install Booking OS
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tap the Share icon, then &quot;Add to Home Screen&quot;
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Install Booking OS for faster access
              </p>
              <button
                onClick={handleInstall}
                className="mt-2 px-4 py-1.5 bg-sage-600 hover:bg-sage-700 text-white text-xs font-medium rounded-xl transition-colors"
                data-testid="install-button"
              >
                Install
              </button>
            </>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label="Dismiss install prompt"
          data-testid="dismiss-button"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
