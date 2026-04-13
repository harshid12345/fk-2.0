import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { calculateMatchScore, getIncomeEstimate } from '@/lib/matchScore';
import { Users, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  const [applicants, setApplicants] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new' | 'done'>('all');
  const [showDisqualified, setShowDisqualified] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: props } = await supabase.from('landlord_properties').select('id, address, rent_amount').eq('landlord_id', user.id);
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
    load();
  }, [user]);

  // Compute match results client-side for display
  const enriched = applicants.map(a => {
    const prop = properties.find(p => p.id === a.property_id);
    const crit = criteria[a.property_id];
    const rent = prop?.rent_amount || 1000;

    // Use stored values or compute
    let matchResult;
    if (a.match_label && a.match_score != null) {
      // Use stored score (divide by 10 since stored as 0-100)
      const score = a.match_score <= 10 ? a.match_score : a.match_score / 10;
      matchResult = {
        score,
        label: a.match_label,
        hardDisqualified: a.hard_disqualified || false,
        hardDisqualifyReason: a.hard_disqualify_reason || null,
        breakdown: { preferenceScore: 0, financialScore: 0, scrapedScore: 0 },
        flags: Array.isArray(a.match_flags) ? a.match_flags : [],
      };
    } else if (crit) {
      matchResult = calculateMatchScore(
        { ...a, smoking: a.lifestyle_answers?.smoking, pets: a.lifestyle_answers?.pets },
        crit, rent, null
      );
    } else {
      matchResult = null;
    }

    return { ...a, matchResult, propertyAddress: prop?.address || '—' };
  });

  const qualified = enriched.filter(a => !a.matchResult?.hardDisqualified);
  const disqualified = enriched.filter(a => a.matchResult?.hardDisqualified);

  // Sort qualified by score descending
  qualified.sort((a, b) => (b.matchResult?.score || 0) - (a.matchResult?.score || 0));

  const filtered = qualified.filter(a => {
    if (filter === 'new') return !a.stage || a.stage === 'new' || a.stage === 'welcome';
    if (filter === 'done') return a.stage === 'done';
    return true;
  });

  const filters = [
    { key: 'all' as const, label: t('applicants.filter_all') },
    { key: 'new' as const, label: t('applicants.filter_new') },
    { key: 'done' as const, label: t('applicants.filter_done') },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="px-5 py-5 pb-8 space-y-4">
      <h1 className="text-lg font-semibold text-foreground">{t('applicants.title')}</h1>

      {/* Filters */}
      <div className="flex gap-2">
        {filters.map(f => (
          <motion.button
            key={f.key}
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'
            }`}
          >
            {f.label} {f.key === 'all' ? `(${qualified.length})` : ''}
          </motion.button>
        ))}
      </div>

      {filtered.length === 0 && disqualified.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Users className="w-9 h-9 text-muted-foreground mx-auto mb-2.5" />
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">{t('applicants.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Qualified applicants */}
          {filtered.map((a, i) => (
            <ApplicantCard key={a.id} applicant={a} index={i} />
          ))}

          {/* Disqualified section */}
          {disqualified.length > 0 && (
            <Collapsible open={showDisqualified} onOpenChange={setShowDisqualified}>
              <CollapsibleTrigger className="w-full flex items-center justify-between p-3 rounded-xl bg-accent/50 text-sm text-muted-foreground hover:bg-accent transition-colors">
                <span>Disqualified ({disqualified.length})</span>
                {showDisqualified ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                {disqualified.map((a, i) => (
                  <DisqualifiedCard key={a.id} applicant={a} index={i} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      {/* Legal footer */}
      <p className="text-[10px] text-muted-foreground/60 leading-relaxed pt-4">
        Matching is based on financial fit and practical preferences only. In compliance with Dutch AWGB and AVG,
        no scoring is applied based on nationality, religion, gender, or other protected characteristics.
      </p>
    </div>
  );
}

function ApplicantCard({ applicant: a, index }: { applicant: any; index: number }) {
  const mr = a.matchResult;
  const score = mr?.score ?? 0;
  const color = getScoreColor(score, false);
  const borderClass = score >= 8.5 ? 'border-l-2' : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`glass-card rounded-2xl p-4 space-y-3 ${borderClass}`}
      style={score >= 8.5 ? { borderLeftColor: SCORE_COLORS.strong } : {}}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{a.full_name || 'Unknown'}</p>
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
            <p className="text-[10px] font-medium" style={{ color }}>{mr.label}</p>
          </div>
        )}
      </div>

      {/* Score breakdown bars */}
      {mr && mr.breakdown && (
        <div className="space-y-2">
          <ScoreBar label="Preference" value={mr.breakdown.preferenceScore} max={4} color={color} />
          <ScoreBar label="Financial" value={mr.breakdown.financialScore} max={4} color={color} />
          <ScoreBar label="Background" value={mr.breakdown.scrapedScore} max={2} color={color} />
        </div>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {a.lifestyle_answers?.smoking === 'No' && (
          <Badge text="✅ Non-smoker" variant="green" />
        )}
        {(!a.lifestyle_answers?.pets || a.lifestyle_answers?.pets === 'No pets') && (
          <Badge text="✅ No pets" variant="green" />
        )}
        {a.id_verified && (
          <Badge text="✅ ID verified" variant="green" />
        )}
        {a.viewing_booked_at && (
          <Badge text={`📅 ${new Date(a.viewing_booked_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`} variant="primary" />
        )}
      </div>

      {/* Warning flags */}
      {mr?.flags && mr.flags.length > 0 && (
        <div className="space-y-1">
          {mr.flags.map((flag: string, fi: number) => (
            <p key={fi} className="text-[11px] flex items-center gap-1" style={{ color: SCORE_COLORS.moderate }}>
              ⚠️ {flag}
            </p>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function DisqualifiedCard({ applicant: a, index }: { applicant: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="rounded-2xl p-4 space-y-2 border border-[#E55B5B]/30 bg-[#E55B5B]/5"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-[#E55B5B] uppercase tracking-wider">🔴 Disqualified</span>
      </div>
      <p className="text-sm font-medium text-foreground">{a.full_name || 'Unknown'}</p>
      <p className="text-xs text-muted-foreground">
        {a.employment_type || a.occupation || '—'} · €{a.monthly_income || '—'}/mo
      </p>
      <p className="text-xs text-[#E55B5B]">
        Reason: {a.matchResult?.hardDisqualifyReason || 'Does not meet requirements'}
      </p>
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
