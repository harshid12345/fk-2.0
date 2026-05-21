import { ReactNode, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import BottomTabBar from './BottomTabBar';
import FloatingBell from './FloatingBell';

const TAB_PATHS = ['/properties', '/tenants', '/settings'];

export default function MobileLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const activeIndex = TAB_PATHS.findIndex(p => location.pathname.startsWith(p));

  // Swipe between tabs
  const handleSwipe = useCallback((_: any, info: PanInfo) => {
    const threshold = 50;
    if (Math.abs(info.offset.x) > threshold && Math.abs(info.velocity.x) > 100) {
      if (info.offset.x > 0 && activeIndex > 0) {
        navigate(TAB_PATHS[activeIndex - 1]);
      } else if (info.offset.x < 0 && activeIndex < TAB_PATHS.length - 1) {
        navigate(TAB_PATHS[activeIndex + 1]);
      }
    }
  }, [activeIndex, navigate]);

  // Track scroll to set --scroll-y CSS var for animated page headers
  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const y = (e.target as HTMLDivElement).scrollTop;
    wrapperRef.current?.style.setProperty('--scroll-y', String(y));
  }

  return (
    <div ref={wrapperRef} className="min-h-screen bg-background" style={{ position: 'relative' }}>
      <FloatingBell />

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.08}
        onDragEnd={handleSwipe}
        className="pb-[83px] overflow-y-auto h-screen"
        onScroll={handleScroll}
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

      <BottomTabBar />
    </div>
  );
}
