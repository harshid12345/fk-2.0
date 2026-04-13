import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { calculateMatchScore } from '@/lib/matchScore';
import { Button } from '@/components/ui/button';
import { Users, Building2, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SCORE_COLORS = {
  strong: '#4ADE80',
  good: '#2EC4B6',
  moderate: '#FBBF24',
  weak: '#9BA8B7',
  disqualified: '#E55B5B',
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
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const approveApplicant = async (applicant: any) => {
    await supabase.from('applicants').update({ stage: 'approved' } as any).eq('id', applicant.id);

    const prop = properties.find(p => p.id === applicant.property_id);
    if (applicant.telegram_user_id && prop) {
      await supabase.functions.invoke('telegram-screener', {
        body: {
          action: 'send_slots',
          telegram_user_id: applicant.telegram_user_id,
          applicant_id: applicant.id,
          property_id: applicant.property_id,
          landlord_id: prop.landlord_id,
        },
      });
    }
    toast({ title: t('applicants.approved') });
    load();
  };

  const rejectApplicant = async (applicant: any) => {
    await supabase.from('applicants').update({ stage: 'rejected' } as any).eq('id', applicant.id);

    if (applicant.telegram_user_id) {
      await supabase.functions.invoke('telegram-screener', {
        body: {
          action: 'send_rejection',
          telegram_user_id: applicant.telegram_user_id,
          applicant_name: applicant.full_name,
        },
      });
    }
    toast({ title: t('applicants.rejected') });
    load();
  };

  // Compute match results — always recalculate live so criteria changes reflect immediately
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
    if (filter === 'approved') return a.stage === 'approved';
    if (filter === 'rejected') return a.stage === 'rejected';
    return true;
  });

  const pendingCount = reviewable.filter(a => isPendingStage(a.stage)).length;

  const filters = [
    { key: 'all' as const, label: t('applicants.filter_all'), count: reviewable.length },
    { key: 'pending' as const, label: t('applicants.filter_pending'), count: pendingCount },
    { key: 'approved' as const, label: t('applicants.filter_approved'), count: reviewable.filter(a => a.stage === 'approved').length },
    { key: 'rejected' as const, label: t('applicants.filter_rejected'), count: reviewable.filter(a => a.stage === 'rejected').length },
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
          <motion.button
            key={f.key}
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
              filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'
            }`}
          >
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
            <ApplicantCard key={a.id} applicant={a} index={i} onApprove={approveApplicant} onReject={rejectApplicant} />
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

function ApplicantCard({ applicant: a, index, onApprove, onReject }: { applicant: any; index: number; onApprove: (a: any) => void; onReject: (a: any) => void }) {
  const mr = a.matchResult;
  const score = mr?.score ?? 0;
  const isCriteriaFlagged = mr?.hardDisqualified || false;
  const displayLabel = isCriteriaFlagged ? 'Needs review' : (mr?.label || 'Unscored');
  const visibleFlags = Array.isArray(mr?.flags)
    ? mr.flags.filter((flag: string) => !flag.startsWith('Hard disqualifier'))
    : [];
  const color = getScoreColor(score, isCriteriaFlagged);
  const borderClass = !isCriteriaFlagged && score >= 8.5 ? 'border-l-2' : '';
  const isPending = !a.stage || a.stage === 'new' || a.stage === 'welcome' || a.stage === 'done' || a.stage === 'screening_complete';
  const isApproved = a.stage === 'approved';
  const isRejected = a.stage === 'rejected';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`glass-card rounded-2xl p-4 space-y-3 ${borderClass}`}
      style={!isCriteriaFlagged && score >= 8.5 ? { borderLeftColor: SCORE_COLORS.strong } : {}}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground">{a.full_name || 'Unknown'}</p>
            {isApproved && <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#4ADE80]/15 text-[#4ADE80]">APPROVED</span>}
            {isRejected && <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#E55B5B]/15 text-[#E55B5B]">REJECTED</span>}
            {!isApproved && !isRejected && isCriteriaFlagged && <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#E55B5B]/15 text-[#E55B5B]">REVIEW</span>}
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
        <div className="rounded-xl border border-[#E55B5B]/30 bg-[#E55B5B]/5 px-3 py-2">
          <p className="text-[11px] font-medium" style={{ color: SCORE_COLORS.disqualified }}>
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
        {a.num_occupants && <Badge text={`👤 ${a.num_occupants}`} variant="neutral" />}
        {a.desired_move_in && <Badge text={`📅 ${a.desired_move_in}`} variant="neutral" />}
        {a.desired_lease_length && <Badge text={`📋 ${a.desired_lease_length}`} variant="neutral" />}
        {a.lifestyle_answers?.smoking === 'No' && <Badge text="✅ Non-smoker" variant="green" />}
        {(!a.lifestyle_answers?.pets || a.lifestyle_answers?.pets === 'No pets') && <Badge text="✅ No pets" variant="green" />}
        {a.id_verified && <Badge text="✅ ID verified" variant="green" />}
        {a.consent_given && <Badge text="✅ GDPR consent" variant="green" />}
        {a.viewing_booked_at && (
          <Badge text={`📅 Viewing: ${new Date(a.viewing_booked_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`} variant="primary" />
        )}
      </div>

      {visibleFlags.length > 0 && (
        <div className="space-y-1">
          {visibleFlags.map((flag: string, fi: number) => (
            <p key={fi} className="text-[11px] flex items-center gap-1" style={{ color: SCORE_COLORS.moderate }}>
              ⚠️ {flag}
            </p>
          ))}
        </div>
      )}

      {isPending && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => onApprove(a)} className="flex-1 h-9 rounded-xl text-xs">
            <Check className="w-3.5 h-3.5 mr-1" /> Approve & Send Slots
          </Button>
          <Button size="sm" variant="outline" onClick={() => onReject(a)} className="flex-1 h-9 rounded-xl text-xs">
            <X className="w-3.5 h-3.5 mr-1" /> Reject
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
      <div className="flex-1 h-1.5 rounded-full bg-accent overflow-hidden">
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

function Badge({ text, variant }: { text: string; variant: 'green' | 'primary' | 'neutral' }) {
  const cls = variant === 'green'
    ? 'bg-[#4ADE80]/10 text-[#4ADE80]'
    : variant === 'primary'
    ? 'bg-primary/10 text-primary'
    : 'bg-accent text-muted-foreground';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium ${cls}`}>
      {text}
    </span>
  );
}
