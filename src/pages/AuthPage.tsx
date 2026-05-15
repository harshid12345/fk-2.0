import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';

const DEV_EMAIL = 'dev@fairkamer.local';
const DEV_PASSWORD = 'FairKamerDev123!';

// FairKamer wordmark — the "F" monogram in terracotta
function FKMonogram() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="44" height="44" rx="12" fill="hsl(11, 62%, 48%)" />
      <path
        d="M13 11h18v4H17v6h12v4H17v8h-4V11z"
        fill="white"
      />
    </svg>
  );
}

export default function AuthPage() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleGoogleSignIn = useCallback(async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast({ title: t('auth.failed'), description: error.message, variant: 'destructive' });
      setGoogleLoading(false);
    }
  }, [toast]);

  const handleDevLogin = useCallback(async () => {
    setDevLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email: DEV_EMAIL, password: DEV_PASSWORD }),
        }
      );
      const data = await res.json();
      if (data.access_token) {
        console.warn('DEV MODE: Auto-logged in as dev@fairkamer.local');
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
      } else {
        throw new Error(data.error_description || data.msg || 'Auth failed');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({ title: t('auth.dev_failed'), description: message, variant: 'destructive' });
      setDevLoading(false);
    }
  }, [toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      {/* Subtle background texture — two soft blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-[0.04]"
          style={{ background: 'hsl(11, 62%, 48%)' }}
        />
        <div
          className="absolute -bottom-24 -left-24 w-[360px] h-[360px] rounded-full opacity-[0.03]"
          style={{ background: 'hsl(11, 62%, 48%)' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 200 }}
        className="w-full max-w-[340px] relative"
      >
        {/* Logo + brand */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex flex-col items-center mb-8"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 16, stiffness: 240, delay: 0.08 }}
            className="mb-4"
          >
            <FKMonogram />
          </motion.div>
          <h1 className="text-2xl font-serif text-foreground tracking-tight">
            FairKamer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('auth.subtitle')}
          </p>
        </motion.div>

        {/* Auth card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="glass-card rounded-2xl px-7 py-8 space-y-4"
        >
          <p className="text-xs text-muted-foreground text-center pb-1">
            {t('auth.sign_in_hint')}
          </p>

          {/* Google button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full h-11 flex items-center justify-center gap-3 rounded-xl border border-border bg-background text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-60 shadow-sm"
          >
            {googleLoading ? (
              <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/40 border-t-foreground animate-spin" />
            ) : (
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {googleLoading ? t('auth.loading') : t('auth.google_btn')}
          </motion.button>

          {/* Divider */}
          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground">of</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Dev skip */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleDevLogin}
            disabled={devLoading}
            className="w-full h-9 flex items-center justify-center gap-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            {devLoading ? t('auth.loading') : t('auth.dev_skip')}
          </motion.button>
        </motion.div>

        {/* Footer note */}
        <p className="text-[11px] text-muted-foreground/60 text-center mt-5">
          {t('auth.footer')}
        </p>
      </motion.div>
    </div>
  );
}
