import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

const TABS = [
  { path: '/properties', icon: Home,     label: 'Panden' },
  { path: '/tenants',    icon: Users,    label: 'Huurders' },
  { path: '/settings',   icon: Settings, label: 'Instellingen' },
] as const;

export default function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-start justify-around"
      style={{
        background: '#1a1a1a',
        borderTop: '1px solid #2a2a2a',
        paddingBottom: 'env(safe-area-inset-bottom)',
        minHeight: 83,
      }}
    >
      {TABS.map(({ path, icon: Icon, label }) => {
        const isActive = location.pathname.startsWith(path);
        return (
          <motion.button
            key={path}
            whileTap={{ scale: 0.78 }}
            onClick={() => navigate(path)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 pt-2"
            style={{ height: 49 }}
            aria-label={label}
          >
            <div
              className="flex items-center justify-center rounded-xl transition-colors duration-150"
              style={{
                width: 44,
                height: 28,
                background: isActive ? 'rgba(200, 75, 47, 0.12)' : 'transparent',
              }}
            >
              <Icon
                style={{
                  width: 21,
                  height: 21,
                  color: isActive ? '#C84B2F' : '#666666',
                  strokeWidth: isActive ? 2.2 : 1.6,
                }}
              />
            </div>
            <span
              className="text-[10px] font-medium"
              style={{ color: isActive ? '#C84B2F' : '#666666' }}
            >
              {label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
