import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Bell, Calendar, AlertTriangle, CheckCircle2, Check, X, Loader2 } from 'lucide-react';

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
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());

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

    const unread = (data || []).filter(n => !n.read);
    if (unread.length > 0) {
      const ids = unread.map(n => n.id);
      await supabase.from('notifications').update({ read: true } as any).in('id', ids);
    }
  };

  const confirmBooking = async (notification: any) => {
    const { related_applicant_id, related_booking_id } = notification;
    if (!related_applicant_id) return;

    setActionLoading(notification.id + '_confirm');
    try {
      // Use related_booking_id if present, otherwise look up by applicant
      const query = related_booking_id
        ? supabase.from('viewing_bookings').select('id, slot_start').eq('id', related_booking_id).maybeSingle()
        : supabase.from('viewing_bookings').select('id, slot_start').eq('applicant_id', related_applicant_id).eq('status', 'pending_landlord').order('created_at', { ascending: false }).limit(1).maybeSingle();
      const { data: booking } = await query;

      if (!booking) {
        toast({ title: 'Booking not found', description: 'It may have already been handled.', variant: 'destructive' as any });
        setResolved(prev => new Set([...prev, notification.id]));
        setActionLoading(null);
        return;
      }

      const slotLabel = new Date(booking.slot_start).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' })
        + ' om ' + new Date(booking.slot_start).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });

      await supabase.functions.invoke('whatsapp-notify-tenant', {
        body: { applicantId: related_applicant_id, action: 'confirm_booking', bookingId: booking.id, slotLabel },
      });

      setResolved(prev => new Set([...prev, notification.id]));
      toast({ title: 'Viewing confirmed — tenant notified' });
    } catch (e: any) {
      toast({ title: 'Error confirming', description: e.message, variant: 'destructive' as any });
    }
    setActionLoading(null);
  };

  const declineBooking = async (notification: any) => {
    const { related_applicant_id, related_booking_id } = notification;
    if (!related_applicant_id) return;

    setActionLoading(notification.id + '_decline');
    try {
      // Use related_booking_id if present, otherwise look up by applicant
      const query = related_booking_id
        ? supabase.from('viewing_bookings').select('id, property_id').eq('id', related_booking_id).maybeSingle()
        : supabase.from('viewing_bookings').select('id, property_id').eq('applicant_id', related_applicant_id).eq('status', 'pending_landlord').order('created_at', { ascending: false }).limit(1).maybeSingle();
      const { data: booking } = await query;

      if (!booking) {
        toast({ title: 'Booking not found', description: 'It may have already been handled.', variant: 'destructive' as any });
        setResolved(prev => new Set([...prev, notification.id]));
        setActionLoading(null);
        return;
      }

      await supabase.from('viewing_bookings').update({ status: 'cancelled_landlord' } as any).eq('id', booking.id);
      await supabase.from('applicants').update({ stage: 'approved' } as any).eq('id', related_applicant_id);

      // Offer the tenant new slots
      await supabase.functions.invoke('whatsapp-screener', {
        body: { action: 'send_slots', applicant_id: related_applicant_id, property_id: booking.property_id, landlord_id: user?.id },
      });

      setResolved(prev => new Set([...prev, notification.id]));
      toast({ title: 'Declined — tenant offered new slots' });
    } catch (e: any) {
      toast({ title: 'Error declining', description: e.message, variant: 'destructive' as any });
    }
    setActionLoading(null);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  const visible = notifications.filter(n => !resolved.has(n.id));

  return (
    <div className="px-5 py-5 pb-8 space-y-4">
      <h1 className="text-lg font-semibold text-foreground">{t('notifications.title')}</h1>

      {visible.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Bell className="w-9 h-9 text-muted-foreground mx-auto mb-2.5" />
          <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((n, i) => {
            const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
            const Icon = config.icon;
            const isBookingRequest = n.type === 'booking_request';
            const isConfirming = actionLoading === n.id + '_confirm';
            const isDeclining = actionLoading === n.id + '_decline';
            const isActing = isConfirming || isDeclining;

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

                    {isBookingRequest && n.related_applicant_id && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => confirmBooking(n)}
                          disabled={isActing}
                          className="flex-1 h-8 rounded-lg text-xs"
                        >
                          {isConfirming
                            ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            : <Check className="w-3.5 h-3.5 mr-1" />}
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => declineBooking(n)}
                          disabled={isActing}
                          className="flex-1 h-8 rounded-lg text-xs border-destructive/30 text-destructive hover:bg-destructive/8"
                        >
                          {isDeclining
                            ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                            : <X className="w-3.5 h-3.5 mr-1" />}
                          Decline
                        </Button>
                      </div>
                    )}
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
