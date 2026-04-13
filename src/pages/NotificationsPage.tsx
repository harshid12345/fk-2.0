import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Bell, Check, X, Calendar, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

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
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadNotifications();

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

  const handleApprove = async (notification: any) => {
    const applicantId = notification.related_applicant_id;
    if (!applicantId) {
      toast.error('No applicant linked to this notification.');
      return;
    }

    setLoadingId(notification.id);
    setLoadingAction('approve');

    try {
      console.log('[Approve] Calling telegram-notify-tenant for applicant:', applicantId);

      const { data, error } = await supabase.functions.invoke('telegram-notify-tenant', {
        body: { applicantId, action: 'approve' },
      });

      console.log('[Approve] Response:', { data, error });

      if (error) {
        console.error('[Approve] Edge function error:', error);
        toast.error('Failed to send approval. Check console for details.');
        return;
      }

      if (data?.ok === false || data?.error) {
        console.error('[Approve] Function returned error:', data.error);
        toast.error(data.error || 'Applicant may have been deleted. Remove this notification.');
        await markRead(notification.id);
        return;
      }
        return;
      }

      // Mark notification as read
      await markRead(notification.id);

      // Also mark the related booking if present
      if (notification.related_booking_id) {
        await supabase.from('viewing_bookings').update({ status: 'confirmed' } as any).eq('id', notification.related_booking_id);
      }

      toast.success('Tenant approved! Viewing invitation sent via Telegram.');
      loadNotifications();
    } catch (err) {
      console.error('[Approve] Unexpected error:', err);
      toast.error('Something went wrong. Check the browser console.');
    } finally {
      setLoadingId(null);
      setLoadingAction(null);
    }
  };

  const handleReject = async (notification: any) => {
    const applicantId = notification.related_applicant_id;
    if (!applicantId) {
      toast.error('No applicant linked to this notification.');
      return;
    }

    setLoadingId(notification.id);
    setLoadingAction('reject');

    try {
      console.log('[Reject] Calling telegram-notify-tenant for applicant:', applicantId);

      const { data, error } = await supabase.functions.invoke('telegram-notify-tenant', {
        body: { applicantId, action: 'reject' },
      });

      console.log('[Reject] Response:', { data, error });

      if (error) {
        console.error('[Reject] Edge function error:', error);
        toast.error('Failed to send rejection. Check console for details.');
        return;
      }

      if (data?.ok === false || data?.error) {
        console.error('[Reject] Function returned error:', data.error);
        toast.error(data.error || 'Applicant may have been deleted.');
        await markRead(notification.id);
        return;
      }
        return;
      }

      await markRead(notification.id);

      if (notification.related_booking_id) {
        await supabase.from('viewing_bookings').update({ status: 'cancelled_landlord' } as any).eq('id', notification.related_booking_id);
      }

      toast.success('Tenant rejected. Notification sent via Telegram.');
      loadNotifications();
    } catch (err) {
      console.error('[Reject] Unexpected error:', err);
      toast.error('Something went wrong. Check the browser console.');
    } finally {
      setLoadingId(null);
      setLoadingAction(null);
    }
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
          {notifications.map((n, i) => {
            const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
            const Icon = config.icon;
            const isBookingRequest = n.type === 'booking_request' && !n.read;
            const isLoading = loadingId === n.id;
            const isApproveLoading = isLoading && loadingAction === 'approve';
            const isRejectLoading = isLoading && loadingAction === 'reject';

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
                    <Button
                      size="sm"
                      onClick={() => handleApprove(n)}
                      disabled={isLoading}
                      className="flex-1 h-8 rounded-xl text-xs"
                    >
                      {isApproveLoading ? (
                        <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Sending...</>
                      ) : (
                        <><Check className="w-3.5 h-3.5 mr-1" /> {t('notifications.approve')}</>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(n)}
                      disabled={isLoading}
                      className="flex-1 h-8 rounded-xl text-xs"
                    >
                      {isRejectLoading ? (
                        <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Sending...</>
                      ) : (
                        <><X className="w-3.5 h-3.5 mr-1" /> {t('notifications.reject')}</>
                      )}
                    </Button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
