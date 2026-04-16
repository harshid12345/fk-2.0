import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar as CalIcon, Clock, User, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
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

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 7);
  return e;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const ws = startOfWeek(new Date());
      const we = endOfWeek(new Date());
      const { data } = await supabase
        .from('viewing_bookings')
        .select('id, slot_start, slot_end, status, applicant_id, property_id')
        .eq('landlord_id', user.id)
        .gte('slot_start', ws.toISOString())
        .lt('slot_start', we.toISOString())
        .neq('status', 'cancelled_tenant')
        .neq('status', 'cancelled_landlord')
        .order('slot_start', { ascending: true });

      const list = (data || []) as Booking[];

      // Hydrate applicant + property names in parallel
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
  }, [user]);

  // Group bookings by weekday index (0 = Mon)
  const weekStart = startOfWeek(new Date());
  const grouped: Record<number, Booking[]> = {};
  bookings.forEach(b => {
    const d = new Date(b.slot_start);
    const idx = (d.getDay() + 6) % 7;
    (grouped[idx] = grouped[idx] || []).push(b);
  });

  const totalThisWeek = bookings.length;

  return (
    <div className="px-5 py-5 pb-12 space-y-6 max-w-2xl mx-auto">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
        <p className="text-sm text-muted-foreground">Set your availability and see this week's viewings.</p>
      </header>

      {/* Availability editor */}
      <Card className="p-4">
        <LandlordAvailabilityPro />
      </Card>

      {/* This week summary */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-foreground">This week</h2>
          <span className="text-xs text-muted-foreground">
            {totalThisWeek} {totalThisWeek === 1 ? 'viewing' : 'viewings'}
          </span>
        </div>

        {loading ? (
          <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
        ) : totalThisWeek === 0 ? (
          <Card className="p-6 flex flex-col items-center text-center border-dashed">
            <CalIcon className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-foreground font-medium">No viewings scheduled</p>
            <p className="text-xs text-muted-foreground mt-1">You're free this week.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {DAY_NAMES.map((name, idx) => {
              const dayBookings = grouped[idx] || [];
              if (!dayBookings.length) return null;
              const date = new Date(weekStart);
              date.setDate(weekStart.getDate() + idx);
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-baseline gap-2 px-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{name}</span>
                    <span className="text-xs text-muted-foreground">
                      {date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  {dayBookings.map(b => {
                    const start = new Date(b.slot_start);
                    const end = new Date(b.slot_end);
                    const time = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                    const name = b.applicant?.full_name || 'Applicant';
                    const addr = b.property?.address || '';
                    return (
                      <Link
                        key={b.id}
                        to={`/properties/${b.property_id}`}
                        className="block"
                      >
                        <Card className="p-3 hover:bg-accent/40 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Clock className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="truncate">{name}</span>
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
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
