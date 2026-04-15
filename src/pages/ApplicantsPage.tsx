import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { calculateMatchScore } from '@/lib/matchScore';
import { Button } from '@/components/ui/button';
import { Users, Building2, Check, X, Trash2, Loader2 } from 'lucide-react';
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
  const [applicants, setApplicants] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const load = async () => {
    if (!user) return;
    const { data: props } = await supabase.from('landlord_properties').select('id, address, rent_amount, landlord_id').eq('landlord_id', user.id);
    setProperties(props || []);
    if (props && props.length > 0) {
      const ids = props.map(p => p.id);
      const { data: apps } = await supabase.from('applicants').select('*').in('property_id', ids).order('created_at', { ascending: false });
      setApplicants(apps || []);
      const { data: crits } = await supabase.from('landlord_criteria').select('*').in('property_id', ids);
      const critMap: Record<string, any> = {};
      (crits || []).forEach((c: any) => { critMap[c.property_id] = c; });
      setCriteria(critMap);
    } else {
      setApplicants([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const approveApplicant = async (applicant: any) => {
    setActionLoading(applicant.id);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-notify-tenant', {
        body: { applicantId: applicant.id, action: 'approve' },
      });
      if (error) {
        toast({ title: 'Failed to notify tenant', description: String(error.message || error), variant: 'destructive' as any });
      } else {
        toast({ title: `${applicant.full_name || 'Applicant'} approved! Viewing invitation sent.` });
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
      const { data, error } = await supabase.functions.invoke('telegram-notify-tenant', {
        body: { applicantId: applicant.id, action: 'reject' },
      });
      if (error) {
        toast({ title: 'Failed to notify tenant', description: String(error.message || error), variant: 'destructive' as any });
      } else {
        toast({ title: `${applicant.full_name || 'Applicant'} rejected. Notification sent.` });
      }
    } catch (e: any) {
      toast({ title: 'Error rejecting applicant', description: e.message, variant: 'destructive' as any });
    }
    setActionLoading(null);
    load();
  };

  const clearAllApplicants = async () => {
    if (!user) return;
    const ids = properties.map(p => p.id);
    if (ids.length === 0) return;
    await supabase.from('viewing_bookings').delete().eq('landlord_id', user.id);
    await supabase.from('notifications').delete().eq('landlord_id', user.id);
    for (const pid of ids) {
      await supabase.from('applicants').delete().in('property_id', ids);
    }
    toast({ title: 'All applicants cleared (dev mode)' });
    load();
  };

  const enriched = applicants.map(a => {
    const prop = properties.find(p => p.id === a.property_id);
    const crit = criteria[a.property_id];
    const rent = prop?.rent_amount || 1000;
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
    return { ...a, matchResult, propertyAddress: prop?.address || '—' };
  });

  const reviewable = [...enriched].sort((a, b) => {
    const aFlagged = a.matchResult?.hardDisqualified ? 1 : 0;
    const bFlagged = b.matchResult?.hardDisqualified ? 1 : 0;
    if (aFlagged !== bFlagged) return aFlagged - bFlagged;
    return (b.matchResult?.score || 0) - (a.matchResult?.score || 0);
  });

  const isPendingStage = (stage: string | null | undefined) => !stage || stage === 'new' || stage === 'welcome' || stage === 'done' || stage === 'screening_complete';

  const filtered = reviewable.filter(a => {
    if (filter === 'pending') return isPendingStage(a.stage);
    if (filter === 'approved') return a.stage === 'approved' || a.stage === 'viewing_pending' || a.stage === 'viewing_booked';
    if (filter === 'rejected') return a.stage === 'rejected';
    return true;
  });

  const pendingCount = reviewable.filter(a => isPendingStage(a.stage)).length;

  const filters = [
    { key: 'all' as const, label: t('applicants.filter_all'), count: reviewable.length },
    { key: 'pending' as const, label: t('applicants.filter_pending'), count: pendingCount },
    { key: 'approved' as const, label: t('applicants.filter_approved'), count: reviewable.filter(a => a.stage === 'approved' || a.stage === 'viewing_pending' || a.stage === 'viewing_booked').length },
    { key: 'rejected' as const, label: t('applicants.filter_rejected'), count: reviewable.filter(a => a.stage === 'rejected').length },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="px-5 py-5 pb-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">{t('applicants.title')}</h1>
        {applicants.length > 0 && (
          <Button size="sm" variant="outline" onClick={clearAllApplicants} className="h-7 px-2 text-[10px] rounded-lg border-destructive/30 text-destructive hover:bg-destructive/10">
            <Trash2 className="w-3 h-3 mr-1" /> DEV: Clear All
          </Button>
        )}
      </div>

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
        <div className="space-y-3">
          {filtered.map((a, i) => (
            <ApplicantCard key={a.id} applicant={a} index={i} onApprove={approveApplicant} onReject={rejectApplicant} actionLoading={actionLoading} />
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/60 leading-relaxed pt-4">
        Matching is based on financial fit and practical preferences only. In compliance with Dutch AWGB and AVG,
        no scoring is applied based on nationality, religion, gender, or other protected characteristics.
      </p>
    </div>
  );
}

function ApplicantCard({ applicant: a, index, onApprove, onReject, actionLoading }: { applicant: any; index: number; onApprove: (a: any) => void; onReject: (a: any) => void; actionLoading: string | null }) {
  const mr = a.matchResult;
  const score = mr?.score ?? 0;
  const isCriteriaFlagged = mr?.hardDisqualified || false;
  const displayLabel = isCriteriaFlagged ? 'Needs review' : (mr?.label || 'Unscored');
  const visibleFlags = Array.isArray(mr?.flags) ? mr.flags.filter((flag: string) => !flag.startsWith('Hard disqualifier')) : [];
  const color = getScoreColor(score, isCriteriaFlagged);
  const borderClass = !isCriteriaFlagged && score >= 8.5 ? 'border-l-2 border-l-success' : '';
  const isPending = !a.stage || a.stage === 'new' || a.stage === 'welcome' || a.stage === 'done' || a.stage === 'screening_complete';
  const isApproved = a.stage === 'approved' || a.stage === 'viewing_pending' || a.stage === 'viewing_booked';
  const isRejected = a.stage === 'rejected';
  const isLoading = actionLoading === a.id;

  const stageLabel = (() => {
    switch (a.stage) {
      case 'approved': return 'APPROVED';
      case 'viewing_pending': return 'VIEWING PENDING';
      case 'viewing_booked': return 'VIEWING BOOKED';
      case 'rejected': return 'REJECTED';
      default: return null;
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`glass-card rounded-2xl p-4 space-y-3 ${borderClass}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">{a.full_name || 'Unknown'}</p>
            {isApproved && <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-success/15 text-success">{stageLabel}</span>}
            {isRejected && <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-destructive/15 text-destructive">REJECTED</span>}
            {!isApproved && !isRejected && isCriteriaFlagged && <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-destructive/15 text-destructive">REVIEW</span>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {a.employment_type || a.occupation || '—'} · €{a.monthly_income || '—'}/mo
            {a.lifestyle_answers?.smoking === 'No' ? ' · Non-smoker' : ''}
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-1">
            <Building2 className="w-3 h-3" /> {a.propertyAddress}
          </p>
        </div>
        {mr && (
          <div className="text-right flex-shrink-0 ml-3">
            <p className="text-2xl font-bold" style={{ color }}>{score.toFixed(1)}</p>
            <p className="text-[10px] font-medium" style={{ color }}>{displayLabel}</p>
          </div>
        )}
      </div>

      {isCriteriaFlagged && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2">
          <p className="text-[11px] font-medium text-destructive">
            Criteria alert: {mr?.hardDisqualifyReason || 'This applicant conflicts with one of your current rules.'}
          </p>
        </div>
      )}

      {mr && mr.breakdown && (
        <div className="space-y-2">
          <ScoreBar label="Preference" value={mr.breakdown.preferenceScore} max={4} color={color} />
          <ScoreBar label="Financial" value={mr.breakdown.financialScore} max={4} color={color} />
          <ScoreBar label="Background" value={mr.breakdown.scrapedScore} max={2} color={color} />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {a.num_occupants && <BadgePill text={`👤 ${a.num_occupants}`} variant="neutral" />}
        {a.desired_move_in && <BadgePill text={`📅 ${a.desired_move_in}`} variant="neutral" />}
        {a.desired_lease_length && <BadgePill text={`📋 ${a.desired_lease_length}`} variant="neutral" />}
        {a.lifestyle_answers?.smoking === 'No' && <BadgePill text="✅ Non-smoker" variant="green" />}
        {(!a.lifestyle_answers?.pets || a.lifestyle_answers?.pets === 'No pets') && <BadgePill text="✅ No pets" variant="green" />}
        {a.id_verified && <BadgePill text="✅ ID verified" variant="green" />}
        {a.consent_given && <BadgePill text="✅ GDPR consent" variant="green" />}
        {a.viewing_booked_at && (
          <BadgePill text={`📅 Viewing: ${new Date(a.viewing_booked_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`} variant="primary" />
        )}
      </div>

      {visibleFlags.length > 0 && (
        <div className="space-y-1">
          {visibleFlags.map((flag: string, fi: number) => (
            <p key={fi} className="text-[11px] flex items-center gap-1 text-warning">⚠️ {flag}</p>
          ))}
        </div>
      )}

      {isPending && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => onApprove(a)} disabled={isLoading} className="flex-1 h-9 rounded-xl text-xs">
            {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
            {isLoading ? 'Sending...' : 'Approve & Send Slots'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onReject(a)} disabled={isLoading} className="flex-1 h-9 rounded-xl text-xs">
            {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <X className="w-3.5 h-3.5 mr-1" />}
            Reject
          </Button>
        </div>
      )}
    </motion.div>
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

function BadgePill({ text, variant }: { text: string; variant: 'green' | 'primary' | 'neutral' }) {
  const cls = variant === 'green'
    ? 'bg-success/10 text-success'
    : variant === 'primary'
    ? 'bg-primary/10 text-primary'
    : 'bg-accent text-muted-foreground';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium ${cls}`}>
      {text}
    </span>
  );
}
