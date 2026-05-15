import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { calculateMatchScore } from '@/lib/matchScore';
import { Button } from '@/components/ui/button';
import { Users, Check, X, Loader2, User, ChevronDown, Clock, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const MOCK_PROPERTIES = [
  { id: 'dev-prop-1', address: 'Prinsengracht 112', rent_amount: 1650, landlord_id: 'dev' },
  { id: 'dev-prop-2', address: 'Westerstraat 45B', rent_amount: 1200, landlord_id: 'dev' },
  { id: 'dev-prop-3', address: 'Vondelstraat 23', rent_amount: 1850, landlord_id: 'dev' },
];

const MOCK_APPLICANTS = [
  {
    id: 'dev-app-1',
    property_id: 'dev-prop-2',
    full_name: 'Sophie van den Berg',
    employment_type: 'Employed',
    monthly_income: 3200,
    num_occupants: '1',
    desired_move_in: '2026-06-01',
    stage: 'screening_complete',
    match_score: 7.8,
    match_label: 'Good match',
    hard_disqualified: false,
    hard_disqualify_reason: null,
    match_flags: [],
    lifestyle_answers: { smoking: 'No', pets: 'No' },
    social_scrape_data: null,
    cancellation_count: 0,
    no_response_count: 0,
    created_at: '2026-04-20T10:00:00Z',
  },
  {
    id: 'dev-app-2',
    property_id: 'dev-prop-2',
    full_name: 'Daan Jansen',
    employment_type: 'Freelancer',
    monthly_income: 2600,
    num_occupants: '2',
    desired_move_in: '2026-05-15',
    stage: 'screening_complete',
    match_score: 5.9,
    match_label: 'Moderate',
    hard_disqualified: false,
    hard_disqualify_reason: null,
    match_flags: ['Income slightly below 3x rent'],
    lifestyle_answers: { smoking: 'No', pets: 'Yes' },
    social_scrape_data: null,
    cancellation_count: 1,
    no_response_count: 0,
    created_at: '2026-04-19T14:30:00Z',
  },
  {
    id: 'dev-app-3',
    property_id: 'dev-prop-3',
    full_name: 'Emma de Vries',
    employment_type: 'Employed',
    monthly_income: 4100,
    num_occupants: '1',
    desired_move_in: '2026-06-01',
    stage: 'done',
    match_score: 8.6,
    match_label: 'Strong match',
    hard_disqualified: false,
    hard_disqualify_reason: null,
    match_flags: [],
    lifestyle_answers: { smoking: 'No', pets: 'No' },
    social_scrape_data: null,
    cancellation_count: 0,
    no_response_count: 0,
    created_at: '2026-04-21T09:00:00Z',
  },
];

// Returns a CSS color string based on score 0-10
function scoreColor(score: number, disqualified: boolean): string {
  if (disqualified) return 'hsl(var(--destructive))';
  if (score >= 8.5) return 'hsl(142, 52%, 40%)';   // green
  if (score >= 6.5) return 'hsl(11, 62%, 48%)';    // terracotta (primary)
  if (score >= 4.5) return 'hsl(38, 92%, 46%)';    // amber
  return 'hsl(var(--muted-foreground))';            // grey
}

// Returns status pill style; labels resolved via t() at call site
function stagePillStyle(hasBooking: boolean, isApproved: boolean, isDisqualified: boolean): { key: string; bg: string; color: string } | null {
  if (hasBooking) return { key: 'applicants.viewing_status', bg: 'hsl(38 92% 46% / 0.12)', color: 'hsl(38, 92%, 40%)' };
  if (isApproved) return { key: 'applicants.approved_status', bg: 'hsl(142 52% 38% / 0.12)', color: 'hsl(142, 52%, 36%)' };
  if (isDisqualified) return { key: 'applicants.review_status', bg: 'hsl(var(--destructive) / 0.10)', color: 'hsl(var(--destructive))' };
  return null;
}

export default function ApplicantsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [applicants, setApplicants] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<Record<string, any>>({});
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');

  const load = useCallback(async () => {
    if (!user) return;
    const { data: props } = await supabase.from('landlord_properties').select('id, address, rent_amount, landlord_id').eq('landlord_id', user.id);
    const realProps = props || [];
    const useMocks = realProps.length === 0;
    const allProps = useMocks ? MOCK_PROPERTIES : realProps;
    setProperties(allProps);
    if (allProps.length > 0) {
      let apps: any[] = [];
      if (!useMocks) {
        const realIds = realProps.map((p: any) => p.id);
        const { data: fetchedApps } = await supabase.from('applicants').select('*').in('property_id', realIds).neq('stage', 'rejected').order('created_at', { ascending: false });
        apps = fetchedApps || [];
      }
      if (useMocks) apps = MOCK_APPLICANTS;
      setApplicants(apps);
      const critMap: Record<string, any> = {};
      if (!useMocks) {
        const realIds = realProps.map((p: any) => p.id);
        const { data: crits } = await supabase.from('landlord_criteria').select('*').in('property_id', realIds);
        (crits || []).forEach((c: any) => { critMap[c.property_id] = c; });
        const { data: bks } = await supabase.from('viewing_bookings').select('*').eq('landlord_id', user.id).in('status', ['pending_landlord']);
        setBookings(bks || []);
      }
      setCriteria(critMap);
    } else {
      setApplicants([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const approveApplicant = async (applicant: any) => {
    setActionLoading(applicant.id);
    try {
      const { error } = await supabase.functions.invoke('whatsapp-notify-tenant', {
        body: { applicantId: applicant.id, action: 'approve' },
      });
      if (error) {
        toast({ title: 'Melding mislukt', description: String(error.message || error), variant: 'destructive' as any });
      } else {
        toast({ title: `${applicant.full_name || t('applicants.header_count')} — ${t('applicants.filter_approved').toLowerCase()}. WhatsApp ✓` });
      }
    } catch (e: any) {
      toast({ title: 'Fout bij goedkeuren', description: e.message, variant: 'destructive' as any });
    }
    setActionLoading(null);
    load();
  };

  const rejectApplicant = async (applicant: any) => {
    setActionLoading(applicant.id);
    try {
      const { error } = await supabase.functions.invoke('whatsapp-notify-tenant', {
        body: { applicantId: applicant.id, action: 'reject' },
      });
      if (error) {
        toast({ title: 'Melding mislukt', description: String(error.message || error), variant: 'destructive' as any });
      } else {
        toast({ title: `${applicant.full_name || 'Kandidaat'} afgewezen.` });
      }
    } catch (e: any) {
      toast({ title: 'Fout bij afwijzen', description: e.message, variant: 'destructive' as any });
    }
    setActionLoading(null);
    load();
  };

  const confirmViewing = async (applicant: any, booking: any) => {
    setActionLoading(applicant.id + '_confirm');
    try {
      const slotLabel = new Date(booking.slot_start).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'short' }) +
        ' om ' + new Date(booking.slot_start).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
      const { error } = await supabase.functions.invoke('whatsapp-notify-tenant', {
        body: { applicantId: applicant.id, action: 'confirm_booking', bookingId: booking.id, slotLabel },
      });
      if (error) {
        toast({ title: 'Bevestiging mislukt', variant: 'destructive' as any });
      } else {
        toast({ title: `Bezichtiging bevestigd voor ${applicant.full_name || 'kandidaat'}. WhatsApp verstuurd.` });
      }
    } catch (e: any) {
      toast({ title: 'Fout', description: e.message, variant: 'destructive' as any });
    }
    setActionLoading(null);
    load();
  };

  const rejectViewing = async (applicant: any, booking: any) => {
    setActionLoading(applicant.id + '_reject_viewing');
    try {
      await supabase.from('viewing_bookings').update({ status: 'cancelled_landlord' } as any).eq('id', booking.id);
      await supabase.from('applicants').update({ stage: 'approved' } as any).eq('id', applicant.id);
      toast({ title: `Bezichtigingstijd geweigerd. ${applicant.full_name || 'Kandidaat'} kan een nieuw moment kiezen.` });
    } catch (e: any) {
      toast({ title: 'Fout', description: e.message, variant: 'destructive' as any });
    }
    setActionLoading(null);
    load();
  };

  const enriched = applicants.map(a => {
    const prop = properties.find(p => p.id === a.property_id);
    const crit = criteria[a.property_id];
    const rent = prop?.rent_amount || 1000;
    const pendingBooking = bookings.find(b => b.applicant_id === a.id && b.status === 'pending_landlord');
    let matchResult;
    if (crit) {
      matchResult = calculateMatchScore(
        { ...a, smoking: a.lifestyle_answers?.smoking, pets: a.lifestyle_answers?.pets },
        crit, rent, null
      );
    } else if (a.match_label && a.match_score != null) {
      const score = a.match_score <= 10 ? a.match_score : a.match_score / 10;
      matchResult = {
        score, label: a.match_label,
        hardDisqualified: a.hard_disqualified || false,
        hardDisqualifyReason: a.hard_disqualify_reason || null,
        breakdown: { preferenceScore: 0, financialScore: 0, scrapedScore: 0 },
        flags: Array.isArray(a.match_flags) ? a.match_flags : [],
      };
    } else {
      matchResult = null;
    }
    return { ...a, matchResult, propertyAddress: prop?.address || '—', pendingBooking };
  });

  const reviewable = [...enriched].sort((a, b) => {
    if (a.pendingBooking && !b.pendingBooking) return -1;
    if (!a.pendingBooking && b.pendingBooking) return 1;
    const aFlagged = a.matchResult?.hardDisqualified ? 1 : 0;
    const bFlagged = b.matchResult?.hardDisqualified ? 1 : 0;
    if (aFlagged !== bFlagged) return aFlagged - bFlagged;
    return (b.matchResult?.score || 0) - (a.matchResult?.score || 0);
  });

  const isPendingStage = (stage: string | null | undefined) =>
    !stage || stage === 'new' || stage === 'welcome' || stage === 'done' || stage === 'screening_complete';
  const needsAction = (a: any) => isPendingStage(a.stage) || a.pendingBooking;

  const filtered = reviewable.filter(a => {
    if (filter === 'pending') return needsAction(a);
    if (filter === 'approved') return a.stage === 'approved' || a.stage === 'viewing_pending' || a.stage === 'viewing_booked';
    return true;
  });

  const pendingCount = reviewable.filter(a => needsAction(a)).length;

  const filters = [
    { key: 'all' as const, label: t('applicants.filter_all'), count: reviewable.length },
    { key: 'pending' as const, label: t('applicants.filter_pending'), count: pendingCount },
    { key: 'approved' as const, label: t('applicants.filter_approved'), count: reviewable.filter(a => a.stage === 'approved' || a.stage === 'viewing_pending' || a.stage === 'viewing_booked').length },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="px-5 pt-5 pb-10 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif text-foreground leading-tight">
          {t('applicants.title')}
        </h1>
        {reviewable.length > 0 && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {reviewable.length} kandidat{reviewable.length === 1 ? '' : 'en'}
          </p>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
        {filters.map(f => (
          <motion.button
            key={f.key}
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-accent text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 text-[10px] ${filter === f.key ? 'opacity-70' : 'opacity-50'}`}>
              {f.count}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card rounded-xl py-14 px-6 text-center"
        >
          <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
            {t('applicants.empty')}
          </p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a, i) => {
            const mr = a.matchResult;
            const score = mr?.score ?? 0;
            const isFlagged = mr?.hardDisqualified || false;
            const color = scoreColor(score, isFlagged);
            const isExpanded = expandedId === a.id;
            const isPending = isPendingStage(a.stage);
            const isApproved = a.stage === 'approved' || a.stage === 'viewing_pending' || a.stage === 'viewing_booked';
            const hasBookingAction = !!a.pendingBooking;
            const isLoading = actionLoading?.startsWith(a.id);
            const pill = stagePillStyle(hasBookingAction, isApproved, isFlagged && isPending);

            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, type: 'spring', damping: 28 }}
              >
                {/* Card row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  className="w-full glass-card rounded-xl p-4 flex items-center gap-3 text-left"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0 border border-border">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Name + address + score bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {a.full_name || 'Onbekend'}
                      </p>
                      {pill && (
                        <span
                          className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                          style={{ background: pill.bg, color: pill.color }}
                        >
                          {t(pill.key)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mb-2">
                      {a.propertyAddress}
                    </p>

                    {/* Match score bar */}
                    {mr && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 score-track">
                          <motion.div
                            className="score-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${(score / 10) * 100}%` }}
                            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
                            style={{ backgroundColor: color }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold shrink-0" style={{ color }}>
                          {score.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Expanded detail panel */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="glass-card rounded-xl mt-1 p-4 space-y-4">

                        {/* Pending viewing action */}
                        {hasBookingAction && (
                          <div className="rounded-lg border border-warning/25 bg-warning/5 p-3 space-y-2.5">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-warning" />
                              <p className="text-xs font-semibold text-foreground">
                                Bezichtigingsverzoek:{' '}
                                {new Date(a.pendingBooking.slot_start).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
                                om {new Date(a.pendingBooking.slot_start).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => confirmViewing(a, a.pendingBooking)}
                                disabled={isLoading}
                                className="flex-1 h-8 rounded-lg text-xs"
                              >
                                {actionLoading === a.id + '_confirm'
                                  ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                  : <Check className="w-3.5 h-3.5 mr-1" />}
                                Bevestigen
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => rejectViewing(a, a.pendingBooking)}
                                disabled={isLoading}
                                className="flex-1 h-8 rounded-lg text-xs border-destructive/30 text-destructive hover:bg-destructive/8"
                              >
                                {actionLoading === a.id + '_reject_viewing'
                                  ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                  : <X className="w-3.5 h-3.5 mr-1" />}
                                Weigeren
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Score breakdown */}
                        {mr?.breakdown && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-foreground">Scoreverdeling</p>
                            <BreakdownBar label="Voorkeur" value={mr.breakdown.preferenceScore} max={4} color={color} delay={0} />
                            <BreakdownBar label="Financieel" value={mr.breakdown.financialScore} max={4} color={color} delay={0.08} />
                            <BreakdownBar label="Achtergrond" value={mr.breakdown.scrapedScore} max={2} color={color} delay={0.16} />
                          </div>
                        )}

                        {/* Background check */}
                        <BackgroundCheckCard scrapeData={a.social_scrape_data} navigate={navigate} />

                        {/* Key info grid */}
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'Dienstverband', value: a.employment_type },
                            { label: 'Inkomen', value: a.monthly_income ? `€${a.monthly_income.toLocaleString('nl-NL')}` : null },
                            { label: 'Bewoners', value: a.num_occupants },
                            { label: 'Gewenste datum', value: a.desired_move_in },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-accent rounded-lg px-3 py-2.5">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                              <p className="text-xs font-semibold text-foreground">{value || '—'}</p>
                            </div>
                          ))}
                        </div>

                        {/* Hard disqualify reason */}
                        {isFlagged && mr?.hardDisqualifyReason && (
                          <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5">
                            <p className="text-xs font-medium text-destructive">{mr.hardDisqualifyReason}</p>
                          </div>
                        )}

                        {/* Reliability warning */}
                        {((a.cancellation_count || 0) + (a.no_response_count || 0)) >= 2 && (
                          <div className="rounded-lg border border-warning/25 bg-warning/5 px-3 py-2.5">
                            <p className="text-xs font-medium text-warning">
                              Betrouwbaarheidswaarschuwing: {a.cancellation_count || 0}× geannuleerd, {a.no_response_count || 0}× geen reactie
                            </p>
                          </div>
                        )}

                        {/* Approve / Reject */}
                        {isPending && !hasBookingAction && (
                          <div className="flex gap-2 pt-0.5">
                            <Button
                              size="sm"
                              onClick={() => approveApplicant(a)}
                              disabled={isLoading}
                              className="flex-1 h-9 rounded-lg text-xs"
                            >
                              {actionLoading === a.id
                                ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                : <Check className="w-3.5 h-3.5 mr-1" />}
                              Goedkeuren
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectApplicant(a)}
                              disabled={isLoading}
                              className="flex-1 h-9 rounded-lg text-xs border-destructive/30 text-destructive hover:bg-destructive/8"
                            >
                              {actionLoading === a.id
                                ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                : <X className="w-3.5 h-3.5 mr-1" />}
                              Afwijzen
                            </Button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Legal note */}
      <p className="text-[10px] text-muted-foreground/50 leading-relaxed pt-2">
        Matching is gebaseerd op financiële geschiktheid en praktische voorkeuren. In lijn met de Nederlandse
        AWGB en AVG wordt geen score toegekend op basis van nationaliteit, religie, geslacht of andere beschermde kenmerken.
      </p>
    </div>
  );
}

function BreakdownBar({ label, value, max, color, delay }: { label: string; value: number; max: number; color: string; delay: number }) {
  const pct = Math.round((Math.max(0, value) / max) * 100);
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[10px] text-muted-foreground w-[72px] shrink-0">{label}</span>
      <div className="flex-1 score-track">
        <motion.div
          className="score-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay }}
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">
        {value.toFixed(1)}/{max}
      </span>
    </div>
  );
}

function BackgroundCheckCard({ scrapeData, navigate }: { scrapeData: any; navigate: (path: string) => void }) {
  if (!scrapeData || scrapeData.skipped) {
    return (
      <div className="rounded-lg border border-border bg-accent/60 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-foreground">Achtergrondcheck</p>
          </div>
          <span className="text-[10px] text-muted-foreground">1.0 / 2.0</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Niet geconfigureerd.{' '}
          <button onClick={() => navigate('/settings')} className="text-primary underline">
            Voeg Apify token toe
          </button>
        </p>
      </div>
    );
  }

  const analysis = scrapeData.analysis;
  const score = scrapeData.scrapedScore ?? 1.0;
  const pct = Math.round((score / 2) * 100);
  const hasIssues = analysis?.noNegativeResults === false;

  return (
    <div className="rounded-lg border border-border bg-accent/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs font-semibold text-foreground">Achtergrondcheck</p>
        </div>
        <span className="text-[10px] text-muted-foreground">{score.toFixed(1)} / 2.0</span>
      </div>
      {analysis?.summary && (
        <p className={`text-[11px] ${hasIssues ? 'text-destructive' : 'text-muted-foreground'}`}>
          {analysis.summary}
        </p>
      )}
      <div className="score-track">
        <motion.div
          className="score-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{ backgroundColor: 'hsl(var(--primary))' }}
        />
      </div>
    </div>
  );
}
