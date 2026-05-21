import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageCircle, X, ChevronDown, AlertTriangle, User } from 'lucide-react';
import { toast } from 'sonner';

interface Applicant {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  age: number | null;
  employment_type: string | null;
  monthly_income_range: string | null;
  num_occupants: string | null;
  desired_move_in: string | null;
  smoking: string | null;
  pets: string | null;
  bkr_status: string | null;
  match_score: number | null;
  match_label: string | null;
  match_flags: string[] | null;
  hard_disqualified: boolean | null;
  hard_disqualify_reason: string | null;
  social_scrape_data: any;
  stage: string | null;
  property_id: string;
  lifestyle_answers: any;
}

interface Property {
  id: string;
  address: string;
  rent_amount: number | null;
}

function scoreColor(score: number, disqualified: boolean): string {
  if (disqualified) return '#888888';
  if (score >= 8.5) return 'hsl(142, 52%, 40%)';
  if (score >= 6.5) return '#C84B2F';
  if (score >= 4.5) return 'hsl(38, 92%, 46%)';
  return '#888888';
}

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  );
}

function TenantSheet({ applicant, property, onClose, onStageChange }: {
  applicant: Applicant;
  property: Property | undefined;
  onClose: () => void;
  onStageChange: (id: string, stage: string) => void;
}) {
  const score = applicant.match_score ?? 0;
  const disq = !!applicant.hard_disqualified;
  const color = scoreColor(score, disq);
  const firstName = applicant.full_name?.split(' ')[0] ?? 'huurder';
  const address = property?.address ?? 'dit pand';

  const rawPhone = (applicant.phone ?? '').replace(/\s/g, '');
  const waPhone = rawPhone.startsWith('+') ? rawPhone.slice(1) : rawPhone.startsWith('0') ? `31${rawPhone.slice(1)}` : rawPhone;
  const waText = encodeURIComponent(`Hoi ${firstName}! Ik ben de verhuurder van ${address}. Ik heb je aanmelding ontvangen en wil je graag uitnodigen voor een bezichtiging. Wanneer schikt het jou? \u2013 FairKamer`);
  const waUrl = `https://wa.me/${waPhone}?text=${waText}`;

  async function handleWhatsApp() {
    window.open(waUrl, '_blank');
    const { error } = await supabase.from('applicants').update({ stage: 'contacted' }).eq('id', applicant.id);
    if (!error) { onStageChange(applicant.id, 'contacted'); toast.success(`${applicant.full_name ?? 'Huurder'} gemarkeerd als gecontacteerd`); }
  }

  async function handleReject() {
    const { error } = await supabase.from('applicants').update({ stage: 'rejected' }).eq('id', applicant.id);
    if (!error) { onStageChange(applicant.id, 'rejected'); onClose(); toast.success(`${applicant.full_name ?? 'Huurder'} afgewezen`); }
  }

  const scrape = applicant.social_scrape_data;
  const hasScrape = scrape && typeof scrape === 'object' && Object.keys(scrape).length > 0;
  const prefScore = !disq ? Math.min(4, (score / 10) * 5) : 0;
  const finScore = !disq ? Math.min(4, (score / 10) * 4.5) : 0;
  const bgScore = !disq ? Math.min(2, (score / 10) * 2.5) : 0;
  const lifestyle = applicant.lifestyle_answers ?? {};

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl overflow-hidden" style={{ maxHeight: '90vh' }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-muted" /></div>
        <button onClick={onClose} className="absolute top-3 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>

        <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: 'calc(90vh - 40px)' }}>
          <div className="flex items-start justify-between mb-5 pt-1">
            <div><h2 className="text-xl font-serif font-bold text-foreground">{applicant.full_name ?? '\u2014'}</h2><p className="text-sm text-muted-foreground mt-0.5">{address}</p></div>
            <div className="text-right"><p className="text-3xl font-bold leading-none" style={{ color }}>{disq ? '\u2014' : score.toFixed(1)}</p><p className="text-xs text-muted-foreground mt-0.5">{disq ? 'Disqualified' : (applicant.match_label ?? '\u2014')}</p></div>
          </div>

          {disq && applicant.hard_disqualify_reason && (
            <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" /><p className="text-sm text-destructive">{applicant.hard_disqualify_reason}</p></div>
          )}

          {!disq && (
            <div className="mb-4 glass-card rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Score</p>
              {[{ label: 'Voorkeur', value: prefScore, max: 4 }, { label: 'Financieel', value: finScore, max: 4 }, { label: 'Achtergrond', value: bgScore, max: 2 }].map(({ label, value, max }) => (
                <div key={label}><div className="flex justify-between mb-1"><span className="text-xs text-muted-foreground">{label}</span><span className="text-xs font-medium text-foreground">{value.toFixed(1)} / {max}</span></div><ScoreBar value={value} max={max} color={color} /></div>
              ))}
            </div>
          )}

          {applicant.match_flags && applicant.match_flags.length > 0 && (
            <div className="mb-4 space-y-1.5">{applicant.match_flags.map((flag, i) => (<div key={i} className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{flag}</div>))}</div>
          )}

          <div className="mb-4 glass-card rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financieel</p>
            <div className="grid grid-cols-2 gap-3">
              {[{ label: 'Inkomen', value: applicant.monthly_income_range ?? lifestyle.income_range }, { label: 'Werk', value: applicant.employment_type }, { label: 'BKR', value: applicant.bkr_status }, { label: 'Leeftijd', value: applicant.age != null ? `${applicant.age} jaar` : null }].map(({ label, value }) => (
                <div key={label}><p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p><p className="text-sm font-semibold text-foreground mt-0.5">{value ?? '\u2014'}</p></div>
              ))}
            </div>
          </div>

          <div className="mb-4 glass-card rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Woonsituatie</p>
            <div className="grid grid-cols-2 gap-3">
              {[{ label: 'Personen', value: applicant.num_occupants }, { label: 'Intrek', value: applicant.desired_move_in }, { label: 'Roken', value: applicant.smoking ?? lifestyle.smoking }, { label: 'Huisdieren', value: applicant.pets ?? lifestyle.pets }].map(({ label, value }) => (
                <div key={label}><p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p><p className="text-sm font-semibold text-foreground mt-0.5">{value ?? '\u2014'}</p></div>
              ))}
            </div>
          </div>

          <div className="mb-6 glass-card rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Achtergrondcheck</p>
            {hasScrape ? (<p className="text-sm text-foreground">{typeof scrape.summary === 'string' ? scrape.summary : 'Scan beschikbaar.'}</p>) : (<p className="text-sm text-muted-foreground italic">Scan loopt nog of geen Apify-token ingesteld.</p>)}
          </div>

          <div className="space-y-3">
            <button onClick={handleWhatsApp} disabled={!rawPhone} className="w-full h-12 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: '#25D366' }}>
              <MessageCircle className="w-5 h-5" />WhatsApp sturen
            </button>
            <button onClick={handleReject} className="w-full h-11 rounded-xl font-medium text-destructive border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors">Afwijzen</button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function TenantCard({ applicant, onClick }: { applicant: Applicant; onClick: () => void }) {
  const score = applicant.match_score ?? 0;
  const disq = !!applicant.hard_disqualified;
  const color = scoreColor(score, disq);
  return (
    <motion.button whileTap={{ scale: 0.985 }} onClick={onClick} className="w-full text-left glass-card rounded-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><User className="w-5 h-5 text-primary" /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-semibold text-foreground text-sm truncate">{applicant.full_name ?? '\u2014'}</p>
          {applicant.stage === 'contacted' && (<span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Contact</span>)}
        </div>
        <p className="text-xs text-muted-foreground truncate">{applicant.employment_type ?? '\u2014'} \u00b7 {applicant.monthly_income_range ?? '\u2014'}</p>
        <p className="text-xs text-muted-foreground truncate">{applicant.num_occupants ?? '\u2014'} \u00b7 {applicant.desired_move_in ?? '\u2014'}</p>
        {disq && <p className="text-xs text-destructive mt-0.5 truncate">\u26a0 {applicant.hard_disqualify_reason}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-2xl font-bold leading-none" style={{ color }}>{disq ? '\u2014' : score.toFixed(1)}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{disq ? 'Disqualified' : (applicant.match_label ?? '\u2014')}</p>
      </div>
    </motion.button>
  );
}

const STATUS_FILTERS = [
  { key: 'active' as const, label: 'Nieuw' },
  { key: 'contacted' as const, label: 'Gecontacteerd' },
  { key: 'rejected' as const, label: 'Afgewezen' },
  { key: 'all' as const, label: 'Alles' },
];

export default function TenantsPage() {
  const { user } = useAuth();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'contacted' | 'rejected' | 'all'>('active');
  const [selected, setSelected] = useState<Applicant | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: props } = await supabase.from('landlord_properties').select('id, address, rent_amount').eq('landlord_id', user.id);
    const propList = (props as Property[]) || [];
    setProperties(propList);
    if (propList.length > 0) {
      const ids = propList.map(p => p.id);
      const { data: apps } = await supabase.from('applicants').select('id, full_name, phone, email, age, employment_type, monthly_income_range, num_occupants, desired_move_in, smoking, pets, bkr_status, match_score, match_label, match_flags, hard_disqualified, hard_disqualify_reason, social_scrape_data, stage, property_id, lifestyle_answers').in('property_id', ids).order('match_score', { ascending: false, nullsFirst: false });
      setApplicants((apps as Applicant[]) || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function handleStageChange(id: string, stage: string) {
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, stage } : a));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, stage } : null);
  }

  const propertyMap = Object.fromEntries(properties.map(p => [p.id, p]));

  const filtered = applicants.filter(a => {
    if (selectedProperty !== 'all' && a.property_id !== selectedProperty) return false;
    if (statusFilter === 'active') return a.stage !== 'rejected' && a.stage !== 'contacted';
    if (statusFilter === 'contacted') return a.stage === 'contacted';
    if (statusFilter === 'rejected') return a.stage === 'rejected';
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.hard_disqualified && !b.hard_disqualified) return 1;
    if (!a.hard_disqualified && b.hard_disqualified) return -1;
    return (b.match_score ?? 0) - (a.match_score ?? 0);
  });

  if (loading) return (
    <div className="pb-36">
      <div className="px-5 pt-5 pb-3"><div className="shimmer h-8 w-40 rounded-lg mb-1" /><div className="shimmer h-4 w-24 rounded" /></div>
      <div className="px-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="shimmer h-20 rounded-xl" />)}</div>
    </div>
  );

  return (
    <div className="pb-36">
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-3xl font-serif text-foreground leading-tight">Huurders</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{sorted.length} {sorted.length === 1 ? 'kandidaat' : 'kandidaten'}</p>
      </div>

      <div className="px-5 mb-4 flex gap-2 overflow-x-auto items-center" style={{ scrollbarWidth: 'none' }}>
        {properties.length > 1 && (
          <div className="relative shrink-0">
            <select value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)} className="appearance-none pl-3 pr-7 py-1.5 text-xs font-medium rounded-full border border-border bg-card text-foreground cursor-pointer">
              <option value="all">Alle panden</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.address}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          </div>
        )}
        {STATUS_FILTERS.map(({ key, label }) => (
          <button key={key} onClick={() => setStatusFilter(key)} className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${statusFilter === key ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-card text-muted-foreground'}`}>{label}</button>
        ))}
      </div>

      <div className="px-5 space-y-2">
        {sorted.length === 0 ? (
          <div className="glass-card rounded-xl py-14 text-center"><p className="text-muted-foreground text-sm">Geen kandidaten gevonden</p><p className="text-xs text-muted-foreground mt-1">Deel je aanmeldlink om de eerste aanmelding te ontvangen</p></div>
        ) : (
          <AnimatePresence>
            {sorted.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, type: 'spring', damping: 26, stiffness: 260 }}>
                <TenantCard applicant={a} onClick={() => setSelected(a)} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <TenantSheet key={selected.id} applicant={selected} property={propertyMap[selected.property_id]} onClose={() => setSelected(null)} onStageChange={handleStageChange} />
        )}
      </AnimatePresence>
    </div>
  );
}
