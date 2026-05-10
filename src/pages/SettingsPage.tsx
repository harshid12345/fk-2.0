import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  ArrowRight, Check, RotateCcw, Building2, User, ChevronRight, Trash2, Shield,
  LogOut, HelpCircle, Mail, PlayCircle, Info, UserCircle2, BookOpen, Bell,
} from 'lucide-react';

interface CriteriaState {
  preferred_gender: string; min_age: string; max_age: string;
  smoking_allowed: string; pets_allowed: string; students_ok: boolean;
  professionals_ok: boolean; min_income_multiplier: string; notes: string;
}

const defaultCriteria: CriteriaState = {
  preferred_gender: 'any', min_age: '18', max_age: '65',
  smoking_allowed: 'No', pets_allowed: 'No', students_ok: true,
  professionals_ok: true, min_income_multiplier: '3.0', notes: '',
};

/** Uber-style list row */
function ListRow({ icon: Icon, title, subtitle, onClick, danger }: { icon: any; title: string; subtitle?: string; onClick: () => void; danger?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="w-full flex items-center gap-4 py-4 text-left"
    >
      <Icon className={`w-6 h-6 shrink-0 ${danger ? 'text-destructive' : 'text-foreground'}`} strokeWidth={1.75} />
      <div className="flex-1 min-w-0">
        <p className={`text-[17px] font-medium leading-tight ${danger ? 'text-destructive' : 'text-foreground'}`}>{title}</p>
        {subtitle && <p className="text-[13px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground/60 shrink-0" />
    </motion.button>
  );
}

/** Uber-style 3-tile quick action */
function QuickTile({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-muted hover:bg-accent transition-colors"
    >
      <Icon className="w-7 h-7 text-foreground" strokeWidth={1.75} />
      <span className="text-[15px] font-medium text-foreground">{label}</span>
    </motion.button>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [criteriaStep, setCriteriaStep] = useState(-1);
  const [criteria, setCriteria] = useState<CriteriaState>({ ...defaultCriteria });
  const [sameCriteriaForAll, setSameCriteriaForAll] = useState(true);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyForCriteria, setSelectedPropertyForCriteria] = useState<string | null>(null);
  const [criteriaCompleted, setCriteriaCompleted] = useState(false);
  const [openSheet, setOpenSheet] = useState<string | null>(null);

  const CRITERIA_QUESTIONS = [
    { key: 'preferred_gender', question: t('criteria.q_gender'), type: 'select', options: [{ value: 'any', label: t('criteria.no_pref') }, { value: 'male', label: t('criteria.male') }, { value: 'female', label: t('criteria.female') }] },
    { key: 'min_age', question: t('criteria.q_min_age'), type: 'number', placeholder: '18' },
    { key: 'max_age', question: t('criteria.q_max_age'), type: 'number', placeholder: '65' },
    { key: 'smoking_allowed', question: t('criteria.q_smoking'), type: 'select', options: [{ value: 'No', label: t('criteria.no') }, { value: 'Outside only', label: 'Outside only' }, { value: 'Yes', label: t('criteria.yes') }] },
    { key: 'pets_allowed', question: t('criteria.q_pets'), type: 'select', options: [{ value: 'No', label: t('criteria.no') }, { value: 'Negotiable', label: 'Negotiable' }, { value: 'Yes', label: t('criteria.yes') }] },
    { key: 'students_ok', question: t('criteria.q_students'), type: 'toggle' },
    { key: 'professionals_ok', question: t('criteria.q_professionals'), type: 'toggle' },
    { key: 'min_income_multiplier', question: t('criteria.q_income'), type: 'number', placeholder: '3.0' },
    { key: 'notes', question: t('criteria.q_notes'), type: 'textarea', placeholder: t('criteria.notes_placeholder') },
  ];

  useEffect(() => {
    if (!user) return;
    supabase.from('landlords').select('*').eq('id', user.id).single().then(({ data }: any) => {
      if (data) { setFullName(data.full_name || ''); setPhone(data.phone || ''); setEmail(data.email || ''); }
    });
    supabase.from('landlord_properties').select('id, address, city').then(({ data }) => { setProperties(data || []); });
    supabase.from('landlord_criteria').select('*').then(({ data }) => {
      if (data && data.length > 0) {
        setCriteriaCompleted(true);
        const f = data[0];
        setCriteria({
          preferred_gender: f.preferred_gender || 'any', min_age: f.min_age?.toString() || '18',
          max_age: f.max_age?.toString() || '65', smoking_allowed: f.smoking_allowed || 'No',
          pets_allowed: f.pets_allowed || 'No', students_ok: f.students_ok ?? true,
          professionals_ok: f.professionals_ok ?? true, min_income_multiplier: f.min_income_multiplier?.toString() || '3.0',
          notes: f.notes || '',
        });
      }
    });
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setLoading(true);
    await supabase.from('landlords').update({ full_name: fullName, phone, email }).eq('id', user.id);
    setLoading(false);
    toast({ title: t('settings.save') });
  };

  const saveCriteria = async () => {
    if (!user || properties.length === 0) return;
    setLoading(true);
    const data = {
      preferred_gender: criteria.preferred_gender === 'any' ? null : criteria.preferred_gender,
      min_age: parseInt(criteria.min_age) || null, max_age: parseInt(criteria.max_age) || null,
      smoking_allowed: criteria.smoking_allowed, pets_allowed: criteria.pets_allowed,
      students_ok: criteria.students_ok, professionals_ok: criteria.professionals_ok,
      min_income_multiplier: parseFloat(criteria.min_income_multiplier) || 3.0, notes: criteria.notes || null,
    };
    if (sameCriteriaForAll) {
      for (const p of properties) {
        await supabase.from('landlord_criteria').delete().eq('property_id', p.id);
        await supabase.from('landlord_criteria').insert([{ ...data, property_id: p.id }] as any);
      }
    } else if (selectedPropertyForCriteria) {
      await supabase.from('landlord_criteria').delete().eq('property_id', selectedPropertyForCriteria);
      await supabase.from('landlord_criteria').insert([{ ...data, property_id: selectedPropertyForCriteria }] as any);
    }
    setLoading(false); setCriteriaCompleted(true); setCriteriaStep(-1);
    toast({ title: t('settings.criteria_saved') });
  };

  const renderCriteriaQuestion = () => {
    const q = CRITERIA_QUESTIONS[criteriaStep];
    if (!q) return null;
    const key = q.key as keyof CriteriaState;
    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
        <p className="text-sm font-medium text-foreground">{q.question}</p>
        {q.type === 'select' && (
          <Select value={criteria[key] as string} onValueChange={v => setCriteria({ ...criteria, [key]: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{q.options!.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {q.type === 'number' && <Input type="number" value={criteria[key] as string} onChange={e => setCriteria({ ...criteria, [key]: e.target.value })} placeholder={q.placeholder} />}
        {q.type === 'toggle' && (
          <div className="flex items-center gap-3">
            <Switch checked={criteria[key] as boolean} onCheckedChange={v => setCriteria({ ...criteria, [key]: v })} />
            <span className="text-sm text-muted-foreground">{(criteria[key] as boolean) ? t('criteria.yes') : t('criteria.no')}</span>
          </div>
        )}
        {q.type === 'textarea' && <Textarea value={criteria[key] as string} onChange={e => setCriteria({ ...criteria, [key]: e.target.value })} placeholder={q.placeholder} rows={3} />}
        <div className="flex gap-2">
          {criteriaStep > 0 && <Button variant="outline" onClick={() => setCriteriaStep(criteriaStep - 1)} className="flex-1 h-11 rounded-xl">{t('settings.back')}</Button>}
          {criteriaStep < CRITERIA_QUESTIONS.length - 1 ? (
            <Button onClick={() => setCriteriaStep(criteriaStep + 1)} className="flex-1 h-11 rounded-xl">{t('settings.next')} <ArrowRight className="w-4 h-4 ml-1" /></Button>
          ) : (
            <Button onClick={saveCriteria} disabled={loading} className="flex-1 h-11 rounded-xl"><Check className="w-4 h-4 mr-1" /> {loading ? t('settings.saving') : t('settings.save_criteria')}</Button>
          )}
        </div>
      </motion.div>
    );
  };

  const initials = (fullName || email || 'U').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const answeredCount = criteriaCompleted ? CRITERIA_QUESTIONS.length : 0;
  const ringPct = (answeredCount / CRITERIA_QUESTIONS.length) * 100;

  const closeSheet = () => setOpenSheet(null);

  return (
    <div className="pb-12 bg-background min-h-full">
      {/* Header — name + avatar */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="px-5 pt-6 pb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[34px] font-bold leading-[1.05] text-foreground tracking-tight">
            {fullName || 'Your account'}
          </h1>
          <div className="mt-3 inline-flex items-center gap-1.5 bg-muted rounded-md px-2 py-1">
            <Shield className="w-3.5 h-3.5 text-foreground" />
            <span className="text-[13px] font-semibold text-foreground">Verified landlord</span>
          </div>
        </div>
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center shrink-0 ring-1 ring-border">
          {initials ? <span className="text-xl font-semibold text-muted-foreground">{initials}</span> : <UserCircle2 className="w-10 h-10 text-muted-foreground" />}
        </div>
      </motion.div>

      <div className="px-5 space-y-3">
        {/* 3-tile quick actions */}
        <div className="flex gap-3">
          <QuickTile icon={HelpCircle} label="Help" onClick={() => setOpenSheet('faq')} />
          <QuickTile icon={User} label="Profile" onClick={() => setOpenSheet('profile')} />
          <QuickTile icon={Bell} label="Activity" onClick={() => setOpenSheet('how')} />
        </div>

        {/* Big card — Tenant criteria checkup (Uber Safety checkup style) */}
        <motion.button
          whileTap={{ scale: 0.99 }}
          onClick={() => setOpenSheet('criteria')}
          className="w-full bg-muted rounded-2xl p-5 flex items-center justify-between gap-4 text-left"
        >
          <div className="min-w-0">
            <p className="text-[17px] font-semibold text-foreground">Tenant criteria</p>
            <p className="text-[13px] text-muted-foreground mt-1">Define who qualifies for your properties</p>
          </div>
          <div className="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={`${ringPct} 100`} pathLength={100} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[15px] font-bold text-primary">{answeredCount}/{CRITERIA_QUESTIONS.length}</span>
            </div>
          </div>
        </motion.button>

        {/* Compact info card */}
        <div className="bg-muted rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[17px] font-semibold text-foreground">Properties managed</p>
            <p className="text-[13px] text-muted-foreground mt-1">Active listings on FairKamer</p>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <span className="text-[22px] font-bold text-foreground">{properties.length}</span>
          </div>
        </div>

        {/* List rows */}
        <div className="pt-4 divide-y divide-border">
          <ListRow icon={PlayCircle} title="How the app works" subtitle="Replay the intro tour" onClick={() => setOpenSheet('how')} />
          <ListRow icon={BookOpen} title="FAQ" subtitle="Common questions" onClick={() => setOpenSheet('faq')} />
          <ListRow icon={Mail} title="Contact us" subtitle="Get help or share feedback" onClick={() => setOpenSheet('contact')} />
          <ListRow icon={Info} title="About & legal" subtitle="Version, terms, privacy" onClick={() => setOpenSheet('about')} />
          <ListRow icon={Trash2} title="Developer tools" subtitle="Clear test data" onClick={() => setOpenSheet('dev')} danger />
          <ListRow icon={LogOut} title="Sign out" onClick={async () => { await supabase.auth.signOut(); }} />
        </div>

        <p className="text-[11px] text-center text-muted-foreground/60 pt-6">FairKamer v1.0 · Netherlands</p>
      </div>

      {/* ─── Sheets ─── */}
      <Sheet open={openSheet === 'profile'} onOpenChange={closeSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Profile</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4">
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{t('settings.full_name')}</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{t('settings.email')}</Label><Input value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{t('settings.phone')}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <Button onClick={saveProfile} disabled={loading} className="w-full h-11 rounded-xl">{loading ? t('settings.saving') : t('settings.save')}</Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={openSheet === 'criteria'} onOpenChange={(o) => { if (!o) { setCriteriaStep(-1); closeSheet(); } }}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Tenant criteria</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-4">
            {criteriaStep === -1 ? (
              criteriaCompleted ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted rounded-xl p-3"><p className="text-[10px] text-muted-foreground">Gender</p><p className="font-medium mt-0.5 capitalize">{criteria.preferred_gender === 'any' ? 'Any' : criteria.preferred_gender}</p></div>
                    <div className="bg-muted rounded-xl p-3"><p className="text-[10px] text-muted-foreground">Age</p><p className="font-medium mt-0.5">{criteria.min_age} – {criteria.max_age}</p></div>
                    <div className="bg-muted rounded-xl p-3"><p className="text-[10px] text-muted-foreground">Smoking</p><p className="font-medium mt-0.5">{criteria.smoking_allowed}</p></div>
                    <div className="bg-muted rounded-xl p-3"><p className="text-[10px] text-muted-foreground">Pets</p><p className="font-medium mt-0.5">{criteria.pets_allowed}</p></div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <Label className="text-xs text-muted-foreground">{t('settings.same_for_all')}</Label>
                    <Switch checked={sameCriteriaForAll} onCheckedChange={setSameCriteriaForAll} />
                  </div>
                  {!sameCriteriaForAll && properties.map(p => (
                    <button key={p.id} onClick={() => { setSelectedPropertyForCriteria(p.id); setCriteriaStep(0); }}
                      className="flex items-center gap-2 w-full p-3 rounded-xl text-left text-sm bg-muted hover:bg-accent transition-colors">
                      <Building2 className="w-4 h-4 text-primary" /><span>{p.address}</span>
                    </button>
                  ))}
                  <Button variant="outline" onClick={() => setCriteriaStep(0)} className="w-full h-11 rounded-xl"><RotateCcw className="w-4 h-4 mr-1.5" /> Update criteria</Button>
                </div>
              ) : (
                <Button onClick={() => setCriteriaStep(0)} className="w-full h-12 rounded-xl"><ArrowRight className="w-4 h-4 mr-2" /> Set up criteria</Button>
              )
            ) : (
              <div>
                <div className="flex gap-1 mb-4">{CRITERIA_QUESTIONS.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= criteriaStep ? 'bg-primary' : 'bg-border'}`} />)}</div>
                {renderCriteriaQuestion()}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={openSheet === 'how'} onOpenChange={closeSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader><SheetTitle>How the app works</SheetTitle></SheetHeader>
          <p className="text-sm text-muted-foreground mt-3">Watch the same walkthrough that appeared the first time you opened FairKamer.</p>
          <Button className="w-full h-11 rounded-xl mt-4" onClick={() => { localStorage.removeItem('fk_onboarding_completed_v1'); window.location.reload(); }}>
            <PlayCircle className="w-4 h-4 mr-2" /> Replay intro tour
          </Button>
        </SheetContent>
      </Sheet>

      <Sheet open={openSheet === 'faq'} onOpenChange={closeSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>FAQ</SheetTitle></SheetHeader>
          <div className="space-y-3 text-sm mt-4">
            {[
              { q: 'How do applicants reach the screening bot?', a: 'Open any property, tap the link icon, and the message with your bot link is copied. Paste it into your Funda or Marktplaats reply.' },
              { q: 'How are match scores calculated?', a: 'Each applicant is scored on tenant criteria, financial fit, and verifiable signals from socials.' },
              { q: 'When are viewing reminders sent?', a: 'Tenants get an automatic Telegram reminder 48h, 24h, and 2h before their viewing.' },
              { q: 'Where do I set my viewing availability?', a: 'Go to the Calendar tab and toggle days on with start/end times.' },
              { q: 'Update criteria for one property?', a: 'Disable "Same for all" in Tenant criteria, then pick the property.' },
            ].map((it, i) => (
              <div key={i} className="rounded-xl bg-muted p-4">
                <p className="font-medium text-foreground mb-1">{it.q}</p>
                <p className="text-muted-foreground leading-relaxed text-[13px]">{it.a}</p>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={openSheet === 'contact'} onOpenChange={closeSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader><SheetTitle>Contact us</SheetTitle></SheetHeader>
          <p className="text-sm text-muted-foreground mt-3">Questions, bug reports, or feature requests — we read every message.</p>
          <a href="mailto:support@fairkamer.nl?subject=FairKamer%20support%20request"
            className="flex items-center justify-between p-4 rounded-xl bg-muted hover:bg-accent transition-colors mt-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">support@fairkamer.nl</p>
                <p className="text-[11px] text-muted-foreground">Replies within 1 business day</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </a>
        </SheetContent>
      </Sheet>

      <Sheet open={openSheet === 'about'} onOpenChange={closeSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader><SheetTitle>About & legal</SheetTitle></SheetHeader>
          <div className="space-y-3 text-sm text-muted-foreground mt-4">
            <p>FairKamer helps Dutch landlords screen and schedule tenants fairly under AVG/GDPR.</p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="rounded-xl bg-muted p-3"><p className="text-[10px]">Version</p><p className="text-foreground font-medium">1.0.0</p></div>
              <div className="rounded-xl bg-muted p-3"><p className="text-[10px]">Region</p><p className="text-foreground font-medium">Netherlands</p></div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={openSheet === 'dev'} onOpenChange={closeSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader><SheetTitle>Developer tools</SheetTitle></SheetHeader>
          <p className="text-xs text-muted-foreground mt-3">Clear test data. Cannot be undone.</p>
          <div className="flex gap-2 mt-4">
            <Button variant="destructive" className="flex-1 h-11 rounded-xl"
              onClick={async () => {
                if (!user) return;
                if (!window.confirm('Delete all notifications?')) return;
                setLoading(true);
                await supabase.from('notifications').delete().eq('landlord_id', user.id);
                setLoading(false); toast({ title: 'Notifications cleared' });
              }} disabled={loading}>Notifications</Button>
            <Button variant="destructive" className="flex-1 h-11 rounded-xl"
              onClick={async () => {
                if (!user) return;
                if (!window.confirm('Delete all applicants and bookings?')) return;
                setLoading(true);
                const { data: props } = await supabase.from('landlord_properties').select('id').eq('landlord_id', user.id);
                if (props && props.length > 0) {
                  const ids = props.map(p => p.id);
                  await supabase.from('viewing_bookings').delete().in('property_id', ids);
                  await supabase.from('applicants').delete().in('property_id', ids);
                }
                setLoading(false); toast({ title: 'Applicants cleared' });
              }} disabled={loading}>Applicants</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
