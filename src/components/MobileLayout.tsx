import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Bell } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import OnboardingTour from './OnboardingTour';
import BottomTabBar from './BottomTabBar';

const TAB_PATHS = ['/properties', '/maintenance', '/calendar', '/settings'];

export default function MobileLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const activeIndex = TAB_PATHS.findIndex(p => location.pathname.startsWith(p));
  const isDetailPage = !!location.pathname.match(/\/properties\/.+/);
  const isNotificationsPage = location.pathname === '/notifications';

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
      .channel('notif-count-ml')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `landlord_id=eq.${user.id}`,
      }, () => fetchCount())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Swipe between tabs
  const handleSwipe = useCallback((_: any, info: PanInfo) => {
    if (isDetailPage) return;
    const threshold = 50;
    if (Math.abs(info.offset.x) > threshold && Math.abs(info.velocity.x) > 100) {
      if (info.offset.x > 0 && activeIndex > 0) {
        navigate(TAB_PATHS[activeIndex - 1]);
      } else if (info.offset.x < 0 && activeIndex < TAB_PATHS.length - 1) {
        navigate(TAB_PATHS[activeIndex + 1]);
      }
    }
  }, [activeIndex, navigate, isDetailPage]);

  return (
    <div className="min-h-screen bg-background">
      <OnboardingTour />

      {/* Floating notification bell — top right, fixed */}
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => navigate('/notifications')}
        className="fixed top-4 right-4 z-40 w-9 h-9 flex items-center justify-center rounded-full"
        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
      >
        <Bell
          style={{
            width: 16,
            height: 16,
            color: isNotificationsPage ? '#C84B2F' : 'hsl(var(--foreground))',
          }}
        />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] flex items-center justify-center rounded-full text-white text-[9px] font-bold px-0.5"
            style={{ background: '#C84B2F' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </motion.button>

      {/* Page content */}
      <motion.div
        drag={!isDetailPage ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.08}
        onDragEnd={handleSwipe}
        /* pb-[83px] keeps content clear of the bottom tab bar */
        className="pb-[83px]"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Bottom tab bar */}
      <BottomTabBar />
    </div>
  );
}
