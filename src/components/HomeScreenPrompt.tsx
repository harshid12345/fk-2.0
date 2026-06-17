import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/hooks/useLanguage';

const STORAGE_KEY = 'fk_home_prompted';

function isAlreadyInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function detectBrowser(): 'ios-safari' | 'android-chrome' | 'other' {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isSafariIOS = isIOS && !/(Chrome|CriOS|FxiOS|EdgiOS)/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isAndroidChrome = isAndroid && /Chrome/.test(ua) && !/EdgA/.test(ua);

  if (isSafariIOS) return 'ios-safari';
  if (isAndroidChrome) return 'android-chrome';
  return 'other';
}

function FKMonogram() {
  return (
    <svg width="52" height="52" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="44" height="44" rx="12" fill="hsl(11, 62%, 48%)" />
      <path d="M13 11h18v4H17v6h12v4H17v8h-4V11z" fill="white" />
    </svg>
  );
}

export default function HomeScreenPrompt() {
  const { t, lang } = useLanguage();
  const [dismissed, setDismissed] = useState(() => {
    return !!localStorage.getItem(STORAGE_KEY) || isAlreadyInstalled();
  });

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  const browser = detectBrowser();

  const instructionIcon = browser === 'ios-safari' ? '□↑' : browser === 'android-chrome' ? '⋮' : '📱';
  const instructionText = browser === 'ios-safari'
    ? t('home.prompt_ios')
    : browser === 'android-chrome'
    ? t('home.prompt_android')
    : t('home.prompt_other');

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm px-6"
        >
          <motion.div
            initial={{ scale: 0.93, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 220 }}
            className="w-full max-w-[340px] bg-card rounded-3xl p-7 shadow-xl border border-border"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <FKMonogram />

              <div>
                <h2 className="text-[20px] font-serif font-bold text-foreground leading-tight">
                  {t('home.prompt_title')}
                </h2>
              </div>

              <div className="w-full rounded-2xl bg-muted p-4 flex items-start gap-3 text-left">
                <span className="text-2xl leading-none mt-0.5">{instructionIcon}</span>
                <p className="text-[14px] text-foreground leading-snug">{instructionText}</p>
              </div>

              {browser === 'ios-safari' && (
                <div className="w-full flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3">
                  <span className="text-xl">1.</span>
                  <div className="text-[13px] text-muted-foreground text-left">
                    Tik <strong className="text-foreground">Delen</strong> → <strong className="text-foreground">Zet op beginscherm</strong>
                  </div>
                </div>
              )}

              {browser === 'android-chrome' && (
                <div className="w-full flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3">
                  <span className="text-xl">1.</span>
                  <div className="text-[13px] text-muted-foreground text-left">
                    Tik <strong className="text-foreground">⋮ menu</strong> → <strong className="text-foreground">Toevoegen aan beginscherm</strong>
                  </div>
                </div>
              )}

              <button
                onClick={dismiss}
                className="w-full h-12 rounded-2xl font-semibold text-sm text-white transition-colors"
                style={{ background: 'hsl(11, 62%, 48%)' }}
              >
                {t('home.prompt_dismiss')}
              </button>

              <button
                onClick={dismiss}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {lang === 'nl' ? 'Nu niet' : 'Maybe later'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
