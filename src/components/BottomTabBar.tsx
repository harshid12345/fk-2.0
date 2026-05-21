import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';

export default function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('landlord_properties')
      .select('id')
      .eq('landlord_id', user.id)
      .then(async ({ data: props }) => {
        if (!props || props.length === 0) return;
        const ids = props.map((p: any) => p.id);
        const { count } = await supabase
          .from('applicants')
          .select('id', { count: 'exact', head: true })
          .in('property_id', ids)
          .neq('stage', 'rejected')
          .neq('stage', 'accepted')
          .neq('stage', 'contacted');
        setPendingCount(count ?? 0);
      });
  }, [user]);

  const TABS = [
    { path: '/properties', icon: Home,     label: t('tab.properties') },
    { path: '/tenants',    icon: Users,    label: t('tab.tenants'),   badge: pendingCount },
    { path: '/settings',   icon: Settings, label: t('tab.settings') },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-start justify-around"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid hsl(27 30% 90%)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        minHeight: 83,
      }}
    >
      {TABS.map(({ path, icon: Icon, label, badge }) => {
        const isActive = location.pathname.startsWith(path);
        return (
          <motion.button
            key={path}
            whileTap={{ scale: 0.78 }}
            onClick={() => navigate(path)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 relative"
            style={{ height: 49 }}
            aria-label={label}
          >
            <div
              className="flex items-center justify-center rounded-xl transition-colors duration-150 relative"
              style={{
                width: 44,
                height: 28,
                background: isActive ? 'rgba(200, 75, 47, 0.10)' : 'transparent',
              }}
            >
              <Icon
                style={{
                  width: 21,
                  height: 21,
                  color: isActive ? '#C84B2F' : 'hsl(24 10% 45%)',
                  strokeWidth: isActive ? 2.2 : 1.6,
                }}
              />
              {/* Badge */}
              {badge != null && badge > 0 && (
                <span
                  className="absolute flex items-center justify-center text-white font-bold"
                  style={{
                    top: 0, right: 0,
                    minWidth: 16, height: 16,
                    borderRadius: 999,
                    background: '#C84B2F',
                    fontSize: 9,
                    padding: '0 4px',
                    lineHeight: 1,
                    transform: 'translate(40%, -30%)',
                  }}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </div>
            <span
              className="text-[10px] font-medium"
              style={{ color: isActive ? '#C84B2F' : 'hsl(24 10% 45%)' }}
            >
              {label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
