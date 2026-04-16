import { ReactNode, useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Building2, Users, Settings, Menu, X, LogOut, Globe, Moon, Sun, Bell, Calendar as CalIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import OnboardingTour from './OnboardingTour';

const TABS = [
  { path: '/properties', icon: Building2, key: 'nav.properties' },
  { path: '/applicants', icon: Users, key: 'nav.applicants' },
  { path: '/calendar', icon: CalIcon, key: 'nav.calendar' },
  { path: '/settings', icon: Settings, key: 'nav.settings' },
];

export default function MobileLayout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const { isDark, toggle: toggleTheme } = useTheme();

  const activeIndex = TABS.findIndex(tab => location.pathname.startsWith(tab.path));

  // Fetch unread notification count
  useEffect(() => {
    if (!user) return;
    const fetchCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('landlord_id', user.id)
        .eq('read', false);
      setUnreadCount(count || 0);
    };
    fetchCount();
    const channel = supabase
      .channel('notif-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `landlord_id=eq.${user.id}` }, () => fetchCount())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

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
  const isNotificationsPage = location.pathname === '/notifications';

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <OnboardingTour />
      {/* Drawer overlay */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-72 z-50 bg-sidebar border-r border-sidebar-border p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <span className="font-semibold text-sidebar-foreground">FairKamer</span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-xl hover:bg-sidebar-accent transition-colors"
                >
                  <X className="w-5 h-5 text-sidebar-foreground/60" />
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
                          ? 'bg-sidebar-accent text-primary font-medium border-l-[3px] border-l-primary'
                          : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                      }`}
                    >
                      <tab.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                      {t(tab.key)}
                    </motion.button>
                  );
                })}
              </nav>

              <div className="space-y-1 pt-4 border-t border-sidebar-border">
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                >
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  {isDark ? 'Light mode' : 'Dark mode'}
                </button>
                <button
                  onClick={() => setLang(lang === 'en' ? 'nl' : 'en')}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <Globe className="w-5 h-5" />
                  {lang === 'en' ? 'English' : 'Nederlands'}
                </button>
                <button
                  onClick={() => { signOut(); setDrawerOpen(false); }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  {t('settings.sign_out')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
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
          <div className="sticky top-0 z-30 glass-surface border-b border-border">
            <div className="flex items-center justify-between px-4 py-3">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setDrawerOpen(true)}
                className="p-2 -ml-2 rounded-xl"
              >
                <Menu className="w-5 h-5 text-foreground" />
              </motion.button>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
                  <Building2 className="w-3 h-3 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground text-sm">FairKamer</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => navigate('/notifications')}
                className="relative p-2 -mr-2 rounded-xl"
              >
                <Bell className={`w-5 h-5 ${isNotificationsPage ? 'text-primary' : 'text-foreground'}`} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </motion.button>
            </div>

            {/* Tab bar */}
            <div className="flex px-4 gap-1 pb-2">
              {TABS.map((tab) => {
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
