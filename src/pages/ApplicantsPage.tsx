import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { calculateMatchScore } from '@/lib/matchScore';
import { Button } from '@/components/ui/button';
import { Users, Check, X, Loader2, User, ChevronDown, Clock, Search, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const SCORE_COLORS = {
  strong: 'hsl(var(--success))',
  good: 'hsl(var(--primary))',
  moderate: 'hsl(var(--warning))',
  weak: 'hsl(var(--muted-foreground))',
  disqualified: 'hsl(var(--destructive))',
};

function getScoreColor(score: number, disqualified: boolean) {
  if (disqualified) return SCORE_COLORS.disqualified;
  if (score >= 8.5) return SCORE_COLORS.strong;
  if (score >= 6.5) return SCORE_COLORS.good;
  if (score >= 4.5) return SCORE_COLORS.moderate;
  return SCORE_COLORS.weak;
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
    setProperties(props || []);
    if (props && props.length > 0) {
      const ids = props.map(p => p.id);
      // Don't load rejected applicants
      const { data: apps } = await supabase.from('applicants').select('*').in('property_id', ids).neq('stage', 'rejected').order('created_at', { ascending: false });
      setApplicants(apps || []);
      const { data: crits } = await supabase.from('landlord_criteria').select('*').in('property_id', ids);
      const critMap: Record<string, any> = {};
      (crits || []).forEach((c: any) => { critMap[c.property_id] = c; });
      setCriteria(critMap);
      // Load pending bookings
      const { data: bks } = await supabase.from('viewing_bookings').select('*').eq('landlord_id', user.id).in('status', ['pending_landlord']);
      setBookings(bks || []);
    } else {
      setApplicants([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const approveApplicant = async (applicant: any) => {
    setActionLoading(applicant.id);
    try {
      const { error } = await supabase.functions.invoke('telegram-notify-tenant', {
        body: { applicantId: applicant.id, action: 'approve' },
      });
      if (error) {
        toast({ title: 'Failed to notify tenant', description: String(error.message || error), variant: 'destructive' as any });
      } else {
        toast({ title: `${applicant.full_name || 'Applicant'} approved. Viewing invitation sent.` });
      }
    } catch (e: any) {
      toast({ title: 'Error approving applicant', description: e.message, variant: 'destructive' as any });
    }
    setActionLoading(null);
    load();
  };

  const rejectApplicant = async (applicant: any) => {
    setActionLoading(applicant.id);
    try {
      const { error } = await supabase.functions.invoke('telegram-notify-tenant', {
        body: { applicantId: applicant.id, action: 'reject' },
      });
      if (error) {
        toast({ title: 'Failed to notify tenant', description: String(error.message || error), variant: 'destructive' as any });
      } else {
        toast({ title: `${applicant.full_name || 'Applicant'} rejected.` });
      }
    } catch (e: any) {
      toast({ title: 'Error rejecting applicant', description: e.message, variant: 'destructive' as any });
    }
    setActionLoading(null);
    load();
  };

  const confirmViewing = async (applicant: any, booking: any) => {
    setActionLoading(applicant.id + '_confirm');
    try {
      const slotLabel = new Date(booking.slot_start).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) +
        ' at ' + new Date(booking.slot_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const { error } = await supabase.functions.invoke('telegram-notify-tenant', {
        body: { applicantId: applicant.id, action: 'confirm_booking', bookingId: booking.id, slotLabel },
      });
      if (error) {
        toast({ title: 'Failed to confirm viewing', variant: 'destructive' as any });
      } else {
        toast({ title: `Viewing confirmed for ${applicant.full_name || 'applicant'}.` });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' as any });
    }
    setActionLoading(null);
    load();
  };

  const rejectViewing = async (applicant: any, booking: any) => {
    setActionLoading(applicant.id + '_reject_viewing');
    try {
      await supabase.from('viewing_bookings').update({ status: 'cancelled_landlord' } as any).eq('id', booking.id);
      await supabase.from('applicants').update({ stage: 'approved' } as any).eq('id', applicant.id);
      toast({ title: `Viewing slot rejected. ${applicant.full_name || 'Applicant'} can pick a new time.` });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' as any });
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
    // Pending bookings first
    if (a.pendingBooking && !b.pendingBooking) return -1;
    if (!a.pendingBooking && b.pendingBooking) return 1;
    const aFlagged = a.matchResult?.hardDisqualified ? 1 : 0;
    const bFlagged = b.matchResult?.hardDisqualified ? 1 : 0;
    if (aFlagged !== bFlagged) return aFlagged - bFlagged;
    return (b.matchResult?.score || 0) - (a.matchResult?.score || 0);
  });

  const isPendingStage = (stage: string | null | undefined) => !stage || stage === 'new' || stage === 'welcome' || stage === 'done' || stage === 'screening_complete';
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
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="px-5 py-5 pb-8 space-y-4">
      <h1 className="text-lg font-semibold text-foreground">{t('applicants.title')}</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map(f => (
          <motion.button key={f.key} whileTap={{ scale: 0.95 }} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
              filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'
            }`}>
            {f.label} ({f.count})
          </motion.button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Users className="w-9 h-9 text-muted-foreground mx-auto mb-2.5" />
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">{t('applicants.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a, i) => {
            const mr = a.matchResult;
            const score = mr?.score ?? 0;
            const isFlagged = mr?.hardDisqualified || false;
            const color = getScoreColor(score, isFlagged);
            const isExpanded = expandedId === a.id;
            const isPending = isPendingStage(a.stage);
            const isApproved = a.stage === 'approved' || a.stage === 'viewing_pending' || a.stage === 'viewing_booked';
            const hasBookingAction = !!a.pendingBooking;
            const isLoading = actionLoading?.startsWith(a.id);

            // Status label
            let statusLabel = '';
            let statusClass = '';
            if (hasBookingAction) {
              statusLabel = 'Viewing request';
              statusClass = 'bg-warning/15 text-warning';
            } else if (isApproved) {
              statusLabel = 'Approved';
              statusClass = 'bg-success/15 text-success';
            } else if (isFlagged && isPending) {
              statusLabel = 'Review';
              statusClass = 'bg-destructive/15 text-destructive';
            }

            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  className="w-full glass-card rounded-2xl p-3.5 flex items-center gap-3 text-left transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{a.full_name || 'Unknown'}</p>
                      {statusLabel && <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${statusClass}`}>{statusLabel}</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{a.propertyAddress}</p>
                  </div>
                  {mr && (
                    <div className="text-right shrink-0 mr-1">
                      <p className="text-lg font-bold leading-none" style={{ color }}>{score.toFixed(1)}</p>
                      <p className="text-[9px] font-medium mt-0.5" style={{ color }}>{isFlagged ? 'Review' : mr.label}</p>
                    </div>
                  )}
                  <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="glass-card rounded-2xl mt-1 p-4 space-y-3">
                        {/* Pending booking action */}
                        {hasBookingAction && (
                          <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-warning" />
                              <p className="text-xs font-medium text-foreground">
                                Viewing request: {new Date(a.pendingBooking.slot_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at {new Date(a.pendingBooking.slot_start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => confirmViewing(a, a.pendingBooking)} disabled={isLoading} className="flex-1 h-8 rounded-xl text-xs">
                                {actionLoading === a.id + '_confirm' ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                                Confirm
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => rejectViewing(a, a.pendingBooking)} disabled={isLoading} className="flex-1 h-8 rounded-xl text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
                                {actionLoading === a.id + '_reject_viewing' ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <X className="w-3.5 h-3.5 mr-1" />}
                                Decline
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Score breakdown */}
                        {mr && mr.breakdown && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-foreground">Score breakdown</p>
                            <ScoreBar label="Preference" value={mr.breakdown.preferenceScore} max={4} color={color} />
                            <ScoreBar label="Financial" value={mr.breakdown.financialScore} max={4} color={color} />
                            <ScoreBar label="Background" value={mr.breakdown.scrapedScore} max={2} color={color} />
                          </div>
                        )}

                        {/* Background Check card */}
                        <BackgroundCheckCard scrapeData={a.social_scrape_data} />

                        {/* Key info */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-accent rounded-xl p-2.5">
                            <p className="text-muted-foreground">Employment</p>
                            <p className="text-foreground font-medium mt-0.5">{a.employment_type || '—'}</p>
                          </div>
                          <div className="bg-accent rounded-xl p-2.5">
                            <p className="text-muted-foreground">Income</p>
                            <p className="text-foreground font-medium mt-0.5">{a.monthly_income ? `€${a.monthly_income}` : '—'}</p>
                          </div>
                          <div className="bg-accent rounded-xl p-2.5">
                            <p className="text-muted-foreground">Occupants</p>
                            <p className="text-foreground font-medium mt-0.5">{a.num_occupants || '—'}</p>
                          </div>
                          <div className="bg-accent rounded-xl p-2.5">
                            <p className="text-muted-foreground">Move-in</p>
                            <p className="text-foreground font-medium mt-0.5">{a.desired_move_in || '—'}</p>
                          </div>
                        </div>

                        {/* Flags */}
                        {isFlagged && mr?.hardDisqualifyReason && (
                          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2">
                            <p className="text-[11px] font-medium text-destructive">{mr.hardDisqualifyReason}</p>
                          </div>
                        )}

                        {/* Reliability warning */}
                        {((a.cancellation_count || 0) + (a.no_response_count || 0)) >= 2 && (
                          <div className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2">
                            <p className="text-[11px] font-medium text-warning">
                              Reliability warning: {a.cancellation_count || 0} cancellation(s), {a.no_response_count || 0} no-response(s)
                            </p>
                          </div>
                        )}

                        {/* Approve/Reject for new applicants */}
                        {isPending && !hasBookingAction && (
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" onClick={() => approveApplicant(a)} disabled={isLoading} className="flex-1 h-9 rounded-xl text-xs">
                              {actionLoading === a.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => rejectApplicant(a)} disabled={isLoading} className="flex-1 h-9 rounded-xl text-xs border-destructive/30 text-destructive hover:bg-destructive/10">
                              {actionLoading === a.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <X className="w-3.5 h-3.5 mr-1" />}
                              Reject
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

      <p className="text-[10px] text-muted-foreground/60 leading-relaxed pt-4">
        Matching is based on financial fit and practical preferences only. In compliance with Dutch AWGB and AVG,
        no scoring is applied based on nationality, religion, gender, or other protected characteristics.
      </p>
    </div>
  );
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-[70px] shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground w-[35px] text-right">{value.toFixed(1)}/{max}</span>
    </div>
  );
}

function BackgroundCheckCard({ scrapeData }: { scrapeData: any }) {
  const navigate = useNavigate();

  if (!scrapeData) {
    return (
      <div className="rounded-xl border border-border bg-accent/50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs font-medium text-foreground">Background check</p>
        </div>
        <p className="text-[11px] text-muted-foreground">Not configured. Add your Apify API token in Settings to enable social media verification.</p>
        <p className="text-[11px] text-muted-foreground">Background score: 1.0 / 2.0 (neutral)</p>
        <button onClick={() => navigate('/settings')} className="text-[11px] text-primary underline">Go to Settings</button>
      </div>
    );
  }

  if (scrapeData.skipped) {
    return (
      <div className="rounded-xl border border-border bg-accent/50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs font-medium text-foreground">Background check</p>
        </div>
        <p className="text-[11px] text-muted-foreground">Not configured. Add your Apify API token in Settings.</p>
        <p className="text-[11px] text-muted-foreground">Background score: 1.0 / 2.0 (neutral)</p>
        <button onClick={() => navigate('/settings')} className="text-[11px] text-primary underline">Go to Settings</button>
      </div>
    );
  }

  const analysis = scrapeData.analysis;
  const score = scrapeData.scrapedScore ?? 1.0;
  const profiles = analysis?.profilesFound || [];
  const pct = Math.round((score / 2) * 100);

  return (
    <div className="rounded-xl border border-border bg-accent/50 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-primary" />
        <p className="text-xs font-medium text-foreground">Background check</p>
      </div>

      {profiles.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">Profiles found:</p>
          <div className="flex flex-wrap gap-1.5">
            {profiles.map((p: string) => (
              <span key={p} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium capitalize">{p}</span>
            ))}
          </div>
        </div>
      )}

      {analysis?.socialConsistent !== null && analysis?.socialConsistent !== undefined && (
        <p className="text-[11px] text-muted-foreground">
          Consistency: {analysis.socialConsistent ? 'Name and info match across platforms' : 'Inconsistencies detected'}
        </p>
      )}

      {analysis?.confirmsEmployer === true && (
        <p className="text-[11px] text-muted-foreground">Employment: Confirmed via online profile</p>
      )}

      {analysis?.noNegativeResults === true && (
        <p className="text-[11px] text-muted-foreground">Search results: No negative mentions found</p>
      )}
      {analysis?.noNegativeResults === false && (
        <p className="text-[11px] text-destructive">Search results: Potential concerns found</p>
      )}

      {analysis?.flaggedConcerns && analysis.flaggedConcerns.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-2.5 py-1.5">
          {analysis.flaggedConcerns.map((c: string, i: number) => (
            <p key={i} className="text-[11px] text-warning flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{c}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Background score</span>
          <span className="text-[10px] text-muted-foreground">{score.toFixed(1)} / 2.0</span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full bg-primary" />
        </div>
      </div>

      {analysis?.summary && (
        <p className="text-[11px] text-muted-foreground italic">"{analysis.summary}"</p>
      )}

      <p className="text-[9px] text-muted-foreground/60">Uses only publicly available data with tenant consent. GDPR compliant.</p>
    </div>
  );
}
