import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Bell, Check, X, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';

const TYPE_CONFIG: Record<string, { icon: any; color: string }> = {
  booking_request: { icon: Calendar, color: '#2EC4B6' },
  booking_confirmed: { icon: CheckCircle2, color: '#4ADE80' },
  cancellation: { icon: AlertTriangle, color: '#E55B5B' },
  reminder: { icon: Bell, color: '#FBBF24' },
  info: { icon: Bell, color: '#9BA8B7' },
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadNotifications();

    // Realtime subscription
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `landlord_id=eq.${user.id}` },
        () => loadNotifications()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('landlord_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications(data || []);
    setLoading(false);
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true } as any).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleApproveBooking = async (notification: any) => {
    if (!notification.related_booking_id) return;
    // Update booking status to confirmed
    await supabase.from('viewing_bookings').update({ status: 'confirmed' } as any).eq('id', notification.related_booking_id);
    await markRead(notification.id);

    // Get booking + applicant info to message tenant
    const { data: booking } = await supabase.from('viewing_bookings').select('*').eq('id', notification.related_booking_id).single();
    if (booking) {
      const { data: applicant } = await supabase.from('applicants').select('telegram_user_id, full_name').eq('id', booking.applicant_id).single();
      const { data: property } = await supabase.from('landlord_properties').select('address').eq('id', booking.property_id).single();
      if (applicant?.telegram_user_id && property) {
        // Call edge function to send confirmation to tenant
        await supabase.functions.invoke('telegram-screener', {
          body: {
            action: 'send_confirmation',
            telegram_user_id: applicant.telegram_user_id,
            slot_start: booking.slot_start,
            address: property.address,
            tenant_name: applicant.full_name,
          },
        });
      }
    }
    loadNotifications();
  };

  const handleRejectBooking = async (notification: any) => {
    if (!notification.related_booking_id) return;
    await supabase.from('viewing_bookings').update({ status: 'cancelled_landlord' } as any).eq('id', notification.related_booking_id);
    await markRead(notification.id);
    loadNotifications();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="px-5 py-5 pb-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">{t('notifications.title')}</h1>
        {unreadCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
            {unreadCount}
          </span>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Bell className="w-9 h-9 text-muted-foreground mx-auto mb-2.5" />
          <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {notifications.map((n, i) => {
              const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
              const Icon = config.icon;
              const isBookingRequest = n.type === 'booking_request' && !n.read;

              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={`glass-card rounded-2xl p-4 space-y-2 transition-opacity ${n.read ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${config.color}15` }}>
                      <Icon className="w-4 h-4" style={{ color: config.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      {n.message && <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {new Date(n.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.read && !isBookingRequest && (
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => markRead(n.id)}
                        className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                      >
                        <Check className="w-3.5 h-3.5 text-muted-foreground" />
                      </motion.button>
                    )}
                  </div>

                  {isBookingRequest && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" onClick={() => handleApproveBooking(n)} className="flex-1 h-8 rounded-xl text-xs">
                        <Check className="w-3.5 h-3.5 mr-1" /> {t('notifications.approve')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleRejectBooking(n)} className="flex-1 h-8 rounded-xl text-xs">
                        <X className="w-3.5 h-3.5 mr-1" /> {t('notifications.reject')}
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
