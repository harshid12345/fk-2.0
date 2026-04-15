import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Bell, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';

const TYPE_CONFIG: Record<string, { icon: any; borderColor: string }> = {
  booking_request: { icon: Calendar, borderColor: 'border-l-primary' },
  booking_confirmed: { icon: CheckCircle2, borderColor: 'border-l-success' },
  cancellation: { icon: AlertTriangle, borderColor: 'border-l-destructive' },
  reminder: { icon: Bell, borderColor: 'border-l-warning' },
  info: { icon: Bell, borderColor: 'border-l-muted-foreground' },
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `landlord_id=eq.${user.id}` }, () => loadNotifications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;
    const { data } = await supabase.from('notifications').select('*').eq('landlord_id', user.id).order('created_at', { ascending: false }).limit(50);
    setNotifications(data || []);
    setLoading(false);

    // Mark all as read
    const unread = (data || []).filter(n => !n.read);
    if (unread.length > 0) {
      const ids = unread.map(n => n.id);
      await supabase.from('notifications').update({ read: true } as any).in('id', ids);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="px-5 py-5 pb-8 space-y-4">
      <h1 className="text-lg font-semibold text-foreground">{t('notifications.title')}</h1>

      {notifications.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Bell className="w-9 h-9 text-muted-foreground mx-auto mb-2.5" />
          <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => {
            const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
            const Icon = config.icon;

            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={`glass-card rounded-2xl p-4 border-l-[3px] ${config.borderColor}`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{n.message || n.title}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {new Date(n.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
