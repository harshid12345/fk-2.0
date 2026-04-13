import { ReactNode, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Building2, Users, AlertCircle, TrendingUp, Menu, X, Settings, LogOut, Globe } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';

const TABS = [
  { path: '/properties', icon: Building2, key: 'nav.properties' },
  { path: '/issues', icon: AlertCircle, key: 'nav.issues' },
  { path: '/settings', icon: Settings, key: 'nav.settings' },
];

export default function MobileLayout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { lang, setLang, t } = useLanguage();

  const activeIndex = TABS.findIndex(tab => location.pathname.startsWith(tab.path));

  const handleSwipe = useCallback((_: any, info: PanInfo) => {
    const threshold = 50;
    if (Math.abs(info.offset.x) > threshold && Math.abs(info.velocity.x) > 100) {
      if (info.offset.x > 0 && activeIndex > 0) {
        navigate(TABS[activeIndex - 1].path);
      } else if (info.offset.x < 0 && activeIndex < TABS.length - 1) {
        navigate(TABS[activeIndex + 1].path);
      }
    }
  }, [activeIndex, navigate]);

  const isDetailPage = location.pathname.match(/\/properties\/.+/);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Drawer overlay */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-72 z-50 glass-card border-r border-border p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <span className="font-semibold text-foreground">FairKamer</span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-xl hover:bg-accent transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </motion.button>
              </div>

              <nav className="flex-1 space-y-1">
                {TABS.map((tab) => {
                  const isActive = location.pathname.startsWith(tab.path);
                  return (
                    <motion.button
                      key={tab.path}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { navigate(tab.path); setDrawerOpen(false); }}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm transition-all ${
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                    >
                      <tab.icon className="w-5 h-5" />
                      {t(tab.key)}
                    </motion.button>
                  );
                })}
              </nav>

              <div className="space-y-1 pt-4 border-t border-border">
                <button
                  onClick={() => setLang(lang === 'en' ? 'nl' : 'en')}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Globe className="w-5 h-5" />
                  {lang === 'en' ? 'English' : 'Nederlands'}
                </button>
                <button
                  onClick={() => { signOut(); setDrawerOpen(false); }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  {t('settings.sign_out')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content with scale effect when drawer is open */}
      <motion.div
        animate={{
          scale: drawerOpen ? 0.95 : 1,
          borderRadius: drawerOpen ? '20px' : '0px',
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="min-h-screen bg-background overflow-hidden"
      >
        {/* Top bar */}
        {!isDetailPage && (
          <div className="sticky top-0 z-30 glass-surface border-b border-border/50">
            <div className="flex items-center justify-between px-4 py-3">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setDrawerOpen(true)}
                className="p-2 -ml-2 rounded-xl"
              >
                <Menu className="w-5 h-5 text-foreground" />
              </motion.button>
              <span className="font-semibold text-foreground text-sm">FairKamer</span>
              <div className="w-9" /> {/* spacer */}
            </div>

            {/* Tab bar */}
            <div className="flex px-4 gap-1 pb-2">
              {TABS.map((tab, index) => {
                const isActive = location.pathname.startsWith(tab.path);
                return (
                  <motion.button
                    key={tab.path}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(tab.path)}
                    className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span>{t(tab.key)}</span>
                    {isActive && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute inset-0 bg-primary/10 rounded-xl"
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* Swipeable content */}
        <motion.div
          drag={!isDetailPage ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
          onDragEnd={handleSwipe}
          className="min-h-[calc(100vh-100px)]"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}
