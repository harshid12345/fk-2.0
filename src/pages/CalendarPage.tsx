import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar as CalIcon, Clock, User, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import LandlordAvailabilityPro from '@/components/LandlordAvailabilityPro';
import { motion } from 'framer-motion';

interface Booking {
  id: string;
  slot_start: string;
  slot_end: string;
  status: string;
  applicant_id: string;
  property_id: string;
  applicant?: { full_name: string | null };
  property?: { address: string | null };
}

const DAY_KEYS = [
  'calendar.day_mon', 'calendar.day_tue', 'calendar.day_wed', 'calendar.day_thu',
  'calendar.day_fri', 'calendar.day_sat', 'calendar.day_sun',
];

// Status styles are looked up by key; labels are set via t() in JSX
const STATUS_BG: Record<string, { bg: string; color: string; key: string }> = {
  pending_landlord: { bg: 'hsl(38 92% 46% / 0.12)', color: 'hsl(38, 92%, 40%)',   key: 'calendar.status_pending' },
  confirmed:        { bg: 'hsl(142 52% 38% / 0.12)', color: 'hsl(142, 52%, 36%)', key: 'calendar.status_confirmed' },
  scheduled:        { bg: 'hsl(142 52% 38% / 0.12)', color: 'hsl(142, 52%, 36%)', key: 'calendar.status_scheduled' },
};

export default function CalendarPage() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const locale = lang === 'nl' ? 'nl-NL' : 'en-GB';
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('viewing_bookings')
        .select('id, slot_start, slot_end, status, applicant_id, property_id')
        .eq('landlord_id', user.id)
        .gte('slot_start', nowIso)
        .not('status', 'in', '(cancelled_tenant,cancelled_landlord,cancelled,declined)')
        .order('slot_start', { ascending: true })
        .limit(100);

      if (error) console.error('Calendar load error', error);

      const list = (data || []) as Booking[];
      const aIds = Array.from(new Set(list.map(b => b.applicant_id))).filter(Boolean);
      const pIds = Array.from(new Set(list.map(b => b.property_id))).filter(Boolean);
      const [{ data: apps }, { data: props }] = await Promise.all([
        aIds.length
          ? supabase.from('applicants').select('id, full_name').in('id', aIds)
          : Promise.resolve({ data: [] as any[] }),
        pIds.length
          ? supabase.from('landlord_properties').select('id, address').in('id', pIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const aMap = new Map((apps || []).map((a: any) => [a.id, a]));
      const pMap = new Map((props || []).map((p: any) => [p.id, p]));
      list.forEach(b => {
        b.applicant = aMap.get(b.applicant_id);
        b.property = pMap.get(b.property_id);
      });

      setBookings(list);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel('calendar-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viewing_bookings', filter: `landlord_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Group by date
  const grouped: Record<string, { label: string; sortKey: string; items: Booking[] }> = {};
  bookings.forEach(b => {
    const d = new Date(b.slot_start);
    const dayName = t(DAY_KEYS[(d.getDay() + 6) % 7]);
    const dateLabel = `${dayName} ${d.toLocaleDateString(locale, { day: 'numeric', month: 'long' })}`;
    const key = d.toDateString();
    if (!grouped[key]) grouped[key] = { label: dateLabel, sortKey: d.toISOString().slice(0, 10), items: [] };
    grouped[key].items.push(b);
  });
  const groups = Object.values(grouped).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return (
    <div className="px-5 pt-5 pb-12 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-serif text-foreground leading-tight">{t('calendar.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('calendar.subtitle')}
        </p>
      </motion.div>

      {/* Availability editor */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="glass-card rounded-xl p-4"
      >
        <LandlordAvailabilityPro />
      </motion.div>

      {/* Upcoming viewings */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-foreground">{t('calendar.upcoming_title')}</h2>
          {bookings.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {bookings.length} {t('calendar.upcoming_count')}
            </span>
          )}
        </div>

        {loading ? (
          <div className="shimmer rounded-xl h-20" />
        ) : bookings.length === 0 ? (
          <div className="glass-card rounded-xl p-8 flex flex-col items-center text-center border border-dashed">
            <CalIcon className="w-8 h-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground mb-1">
              {t('calendar.empty_title')}
            </p>
            <p className="text-xs text-muted-foreground max-w-[220px]">
              {t('calendar.empty_desc')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group, gi) => (
              <motion.div
                key={group.sortKey}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.04 }}
                className="space-y-1.5"
              >
                {/* Date label */}
                <div className="px-1 py-0.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>

                {group.items.map(b => {
                  const start = new Date(b.slot_start);
                  const end = new Date(b.slot_end);
                  const time = `${start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
                  const name = b.applicant?.full_name || t('calendar.unknown_candidate');
                  const addr = b.property?.address || '';
                  const statusDef = STATUS_BG[b.status];
                  const status = statusDef ? { ...statusDef, label: t(statusDef.key) } : null;

                  return (
                    <Link key={b.id} to={`/properties/${b.property_id}`} className="block">
                      <div className="glass-card rounded-xl p-3.5 flex items-center gap-3 hover:shadow-sm transition-shadow">
                        {/* Time block */}
                        <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                          <Clock className="w-4 h-4 text-primary" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span className="text-sm font-semibold text-foreground truncate">{name}</span>
                            </div>
                            {status && (
                              <span
                                className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                                style={{ background: status.bg, color: status.color }}
                              >
                                {status.label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {time}{addr ? ` · ${addr}` : ''}
                          </p>
                        </div>

                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  );
}
