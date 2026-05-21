import { useState, useEffect, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';

interface Notification {
  id: string;
  title: string | null;
  body: string | null;
  read: boolean | null;
  created_at: string;
}

function timeAgo(iso: string, t: (k: string) => string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return t('notif.now');
  if (diff < 3600) return `${Math.floor(diff / 60)} ${t('notif.min_ago')}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ${t('notif.hr_ago')}`;
  return `${Math.floor(diff / 86400)} ${t('notif.day_ago')}`;
}

export default function FloatingBell() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('id, title, body, read, created_at')
      .eq('landlord_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setNotifs(data as Notification[]); });
  }, [user]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unread = notifs.filter(n => !n.read).length;

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    const ids = notifs.filter(n => !n.read).map(n => n.id);
    if (ids.length === 0) return;
    await supabase.from('notifications').update({ read: true }).in('id', ids);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }

  return (
    <div ref={panelRef} style={{ position: 'fixed', top: 16, right: 16, zIndex: 41 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: 40, height: 40, borderRadius: 999,
          background: 'hsl(27 100% 97%)',
          border: '1px solid hsl(27 30% 90%)',
          boxShadow: '0 2px 8px rgba(26,20,16,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative',
        }}
      >
        <Bell style={{ width: 18, height: 18, color: 'hsl(24 10% 30%)' }} strokeWidth={1.8} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 8, height: 8, borderRadius: 999,
            background: '#C84B2F',
            border: '2px solid hsl(27 100% 97%)',
          }} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute', top: 48, right: 0,
              width: 300, maxHeight: 380,
              background: 'hsl(0 0% 100%)',
              border: '1px solid hsl(27 30% 90%)',
              borderRadius: 16,
              boxShadow: '0 8px 32px rgba(26,20,16,0.14)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px 10px',
              borderBottom: '1px solid hsl(27 30% 90%)',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(0 0% 10%)' }}>{t('notif.title')}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{ fontSize: 11, color: '#C84B2F', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                  >
                    {t('notif.mark_read')}
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  style={{ width: 24, height: 24, borderRadius: 999, background: 'hsl(27 30% 96%)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X style={{ width: 12, height: 12, color: 'hsl(24 10% 45%)' }} />
                </button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifs.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'hsl(24 10% 45%)', textAlign: 'center', padding: '28px 16px', margin: 0 }}>
                  {t('notif.empty')}
                </p>
              ) : (
                notifs.map(n => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '10px 14px',
                      borderBottom: '1px solid hsl(27 30% 92%)',
                      background: n.read ? 'transparent' : 'hsl(27 100% 98%)',
                      border: 'none', cursor: 'pointer',
                      display: 'block',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <p style={{ fontSize: 12.5, fontWeight: n.read ? 400 : 600, color: 'hsl(0 0% 10%)', margin: 0, lineHeight: 1.35 }}>
                        {n.title || '—'}
                      </p>
                      {!n.read && (
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: '#C84B2F', flexShrink: 0, marginTop: 4 }} />
                      )}
                    </div>
                    {n.body && (
                      <p style={{ fontSize: 11.5, color: 'hsl(24 10% 45%)', margin: '2px 0 0', lineHeight: 1.35 }}>{n.body}</p>
                    )}
                    <p style={{ fontSize: 10.5, color: 'hsl(24 10% 55%)', margin: '3px 0 0' }}>{timeAgo(n.created_at, t)}</p>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
