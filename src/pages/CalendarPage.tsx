import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar as CalIcon, Clock, User, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import LandlordAvailabilityPro from '@/components/LandlordAvailabilityPro';

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

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  pending_landlord: { label: 'Needs confirm', tone: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  confirmed: { label: 'Confirmed', tone: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
  scheduled: { label: 'Scheduled', tone: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
};

export default function CalendarPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      // Fetch ALL upcoming non-cancelled bookings (not limited to current week)
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('viewing_bookings')
        .select('id, slot_start, slot_end, status, applicant_id, property_id')
        .eq('landlord_id', user.id)
        .gte('slot_start', nowIso)
        .not('status', 'in', '(cancelled_tenant,cancelled_landlord,cancelled,declined)')
        .order('slot_start', { ascending: true })
        .limit(100);

      if (error) {
        console.error('Calendar load error', error);
      }

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

    // Realtime: refresh when bookings change
    const channel = supabase
      .channel('calendar-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viewing_bookings', filter: `landlord_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Group by date label (e.g. "Mon · 21 Apr")
  const grouped: Record<string, { label: string; sortKey: string; items: Booking[] }> = {};
  bookings.forEach(b => {
    const d = new Date(b.slot_start);
    const dayName = DAY_NAMES[(d.getDay() + 6) % 7];
    const dateLabel = `${dayName} · ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
    const key = d.toDateString();
    if (!grouped[key]) grouped[key] = { label: dateLabel, sortKey: d.toISOString().slice(0, 10), items: [] };
    grouped[key].items.push(b);
  });
  const groups = Object.values(grouped).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return (
    <div className="px-5 py-5 pb-12 space-y-6 max-w-2xl mx-auto">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
        <p className="text-sm text-muted-foreground">Set your availability and see upcoming viewings.</p>
      </header>

      {/* Availability editor */}
      <Card className="p-4">
        <LandlordAvailabilityPro />
      </Card>

      {/* Upcoming viewings */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-foreground">Upcoming viewings</h2>
          <span className="text-xs text-muted-foreground">
            {bookings.length} {bookings.length === 1 ? 'viewing' : 'viewings'}
          </span>
        </div>

        {loading ? (
          <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
        ) : bookings.length === 0 ? (
          <Card className="p-6 flex flex-col items-center text-center border-dashed">
            <CalIcon className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-foreground font-medium">No upcoming viewings</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Viewings appear here once an applicant books a slot via the Telegram bot.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {groups.map(group => (
              <div key={group.sortKey} className="space-y-1.5">
                <div className="px-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {group.label}
                  </span>
                </div>
                {group.items.map(b => {
                  const start = new Date(b.slot_start);
                  const end = new Date(b.slot_end);
                  const time = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                  const name = b.applicant?.full_name || 'Applicant';
                  const addr = b.property?.address || '';
                  const status = STATUS_LABEL[b.status];
                  return (
                    <Link key={b.id} to={`/properties/${b.property_id}`} className="block">
                      <Card className="p-3 hover:bg-accent/40 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Clock className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                              <span className="truncate">{name}</span>
                              {status && (
                                <Badge variant="outline" className={`ml-1 text-[10px] px-1.5 py-0 h-4 ${status.tone}`}>
                                  {status.label}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {time}{addr ? ` · ${addr}` : ''}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
