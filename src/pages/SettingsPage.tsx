import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import LandlordAvailabilityPro from '@/components/LandlordAvailabilityPro';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Copy, Bot, MessageCircle, ArrowRight, Check, RotateCcw, Clock, Building2, User, ChevronDown, Link2 } from 'lucide-react';

interface CriteriaState {
  preferred_gender: string;
  min_age: string;
  max_age: string;
  smoking_allowed: string;
  pets_allowed: string;
  students_ok: boolean;
  professionals_ok: boolean;
  min_income_multiplier: string;
  notes: string;
}

const defaultCriteria: CriteriaState = {
  preferred_gender: 'any', min_age: '18', max_age: '65',
  smoking_allowed: 'No', pets_allowed: 'No', students_ok: true,
  professionals_ok: true, min_income_multiplier: '3.0', notes: '',
};

function SettingsSection({ id, icon: Icon, title, expanded, onToggle, children }: { id: string; icon: any; title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-primary" />
          <span className="font-medium text-foreground text-sm">{title}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-4">{children}</div>
      )}
    </div>
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
  const [expandedSection, setExpandedSection] = useState<string | null>('profile');
  const [apifyToken, setApifyToken] = useState('');
  const [apifyLoading, setApifyLoading] = useState(false);
  const [apifyConfigured, setApifyConfigured] = useState(false);

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
      if (data) {
        setFullName(data.full_name || ''); setPhone(data.phone || ''); setEmail(data.email || '');
        if (data.apify_token) { setApifyToken(data.apify_token); setApifyConfigured(true); }
      }
    });
    supabase.from('landlord_properties').select('id, address, city').then(({ data }) => { setProperties(data || []); });
    supabase.from('landlord_criteria').select('*').then(({ data }) => {
      if (data && data.length > 0) {
        setCriteriaCompleted(true);
        const first = data[0];
        setCriteria({
          preferred_gender: first.preferred_gender || 'any', min_age: first.min_age?.toString() || '18',
          max_age: first.max_age?.toString() || '65', smoking_allowed: first.smoking_allowed || 'No',
          pets_allowed: first.pets_allowed || 'No', students_ok: first.students_ok ?? true,
          professionals_ok: first.professionals_ok ?? true, min_income_multiplier: first.min_income_multiplier?.toString() || '3.0',
          notes: first.notes || '',
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
    const criteriaData = {
      preferred_gender: criteria.preferred_gender === 'any' ? null : criteria.preferred_gender,
      min_age: parseInt(criteria.min_age) || null, max_age: parseInt(criteria.max_age) || null,
      smoking_allowed: criteria.smoking_allowed, pets_allowed: criteria.pets_allowed,
      students_ok: criteria.students_ok, professionals_ok: criteria.professionals_ok,
      min_income_multiplier: parseFloat(criteria.min_income_multiplier) || 3.0, notes: criteria.notes || null,
    };
    if (sameCriteriaForAll) {
      for (const prop of properties) {
        await supabase.from('landlord_criteria').delete().eq('property_id', prop.id);
        await supabase.from('landlord_criteria').insert([{ ...criteriaData, property_id: prop.id }] as any);
      }
    } else if (selectedPropertyForCriteria) {
      await supabase.from('landlord_criteria').delete().eq('property_id', selectedPropertyForCriteria);
      await supabase.from('landlord_criteria').insert([{ ...criteriaData, property_id: selectedPropertyForCriteria }] as any);
    }
    setLoading(false);
    setCriteriaCompleted(true);
    setCriteriaStep(-1);
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
          {criteriaStep > 0 && <motion.div whileTap={{ scale: 0.97 }} className="flex-1"><Button variant="outline" onClick={() => setCriteriaStep(criteriaStep - 1)} className="w-full h-10 rounded-xl">{t('settings.back')}</Button></motion.div>}
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            {criteriaStep < CRITERIA_QUESTIONS.length - 1 ? (
              <Button onClick={() => setCriteriaStep(criteriaStep + 1)} className="w-full h-10 rounded-xl">{t('settings.next')} <ArrowRight className="w-4 h-4 ml-1" /></Button>
            ) : (
              <Button onClick={saveCriteria} disabled={loading} className="w-full h-10 rounded-xl"><Check className="w-4 h-4 mr-1" /> {loading ? t('settings.saving') : t('settings.save_criteria')}</Button>
            )}
          </motion.div>
        </div>
      </motion.div>
    );
  };

  const toggleSection = (id: string) => setExpandedSection(expandedSection === id ? null : id);

  return (
    <div className="pb-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="px-5 pt-4 pb-4">
        <h1 className="text-2xl font-semibold text-foreground">{t('settings.title')}</h1>
      </motion.div>

      <div className="px-5 space-y-3">
        <SettingsSection id="profile" icon={User} title={t('settings.profile')} expanded={expandedSection === 'profile'} onToggle={() => toggleSection('profile')}>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{t('settings.full_name')}</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{t('settings.email')}</Label><Input value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{t('settings.phone')}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <motion.div whileTap={{ scale: 0.97 }}><Button onClick={saveProfile} disabled={loading} className="w-full h-10 rounded-xl">{loading ? t('settings.saving') : t('settings.save')}</Button></motion.div>
          </div>
        </SettingsSection>

        <SettingsSection id="criteria" icon={Building2} title={t('settings.criteria')} expanded={expandedSection === 'criteria'} onToggle={() => toggleSection('criteria')}>
          {criteriaStep === -1 ? (
            criteriaCompleted ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-[11px] text-muted-foreground">{t('settings.gender_pref')}</p><p className="text-foreground capitalize mt-0.5">{criteria.preferred_gender === 'any' ? t('settings.any') : criteria.preferred_gender}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">{t('settings.age_range')}</p><p className="text-foreground mt-0.5">{criteria.min_age}–{criteria.max_age}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">{t('settings.smoking')}</p><p className="text-foreground mt-0.5">{criteria.smoking_allowed}</p></div>
                  <div><p className="text-[11px] text-muted-foreground">{t('settings.pets')}</p><p className="text-foreground mt-0.5">{criteria.pets_allowed}</p></div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <Label className="text-xs">{t('settings.same_for_all')}</Label>
                  <Switch checked={sameCriteriaForAll} onCheckedChange={setSameCriteriaForAll} />
                </div>
                {!sameCriteriaForAll && properties.map(p => (
                  <motion.button key={p.id} whileTap={{ scale: 0.98 }} onClick={() => { setSelectedPropertyForCriteria(p.id); setCriteriaStep(0); }}
                    className="flex items-center gap-2 w-full p-3 rounded-xl text-left text-sm bg-accent hover:bg-accent/80 transition-colors">
                    <Building2 className="w-4 h-4 text-primary" /><span className="text-foreground">{p.address}</span>
                  </motion.button>
                ))}
                <motion.div whileTap={{ scale: 0.97 }}><Button variant="outline" onClick={() => setCriteriaStep(0)} className="w-full h-9 rounded-xl text-xs"><RotateCcw className="w-3.5 h-3.5 mr-1" /> {t('settings.retake')}</Button></motion.div>
              </div>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-sm text-muted-foreground">{t('settings.criteria_desc')}</p>
                <motion.div whileTap={{ scale: 0.97 }}><Button onClick={() => setCriteriaStep(0)} className="h-10 rounded-xl">{t('settings.start_questionnaire')} <ArrowRight className="w-4 h-4 ml-1" /></Button></motion.div>
              </div>
            )
          ) : (
            <div>
              <div className="flex gap-1 mb-4">
                {CRITERIA_QUESTIONS.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= criteriaStep ? 'bg-primary' : 'bg-border'}`} />)}
              </div>
              {renderCriteriaQuestion()}
            </div>
          )}
        </SettingsSection>

        <SettingsSection id="availability" icon={Clock} title={t('settings.availability')} expanded={expandedSection === 'availability'} onToggle={() => toggleSection('availability')}>
          <LandlordAvailabilityPro />
        </SettingsSection>

        <SettingsSection id="integrations" icon={Link2} title="Integrations" expanded={expandedSection === 'integrations'} onToggle={() => toggleSection('integrations')}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Apify API Token</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={apifyToken}
                  onChange={e => setApifyToken(e.target.value)}
                  placeholder="apify_api_..."
                />
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button
                    onClick={async () => {
                      if (!user || !apifyToken.trim()) return;
                      setApifyLoading(true);
                      await supabase.from('landlords').update({ apify_token: apifyToken.trim() } as any).eq('id', user.id);
                      setApifyConfigured(true);
                      setApifyLoading(false);
                      toast({ title: 'Apify token saved' });
                    }}
                    disabled={apifyLoading || !apifyToken.trim()}
                    size="sm"
                    className="h-10 rounded-xl"
                  >
                    {apifyLoading ? 'Saving...' : 'Save'}
                  </Button>
                </motion.div>
              </div>
              <p className="text-[11px] text-muted-foreground">Used for tenant social media verification. Get your token at <a href="https://apify.com/account" target="_blank" rel="noopener noreferrer" className="text-primary underline">apify.com/account</a></p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`w-2 h-2 rounded-full ${apifyConfigured ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                <span className="text-[11px] text-muted-foreground">{apifyConfigured ? 'Connected' : 'Not configured'}</span>
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection id="bots" icon={Bot} title={t('settings.telegram')} expanded={expandedSection === 'bots'} onToggle={() => toggleSection('bots')}>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground mb-2">{t('settings.telegram_desc')}</p>
            {[
              { icon: Bot, name: t('settings.screening_bot'), desc: t('settings.screening_desc'), link: 'https://t.me/FairKamerBot' },
              { icon: MessageCircle, name: t('settings.concierge_bot'), desc: t('settings.concierge_desc'), link: 'https://t.me/FairKamerConcierge' },
            ].map((bot) => (
              <motion.div key={bot.name} whileTap={{ scale: 0.98 }} className="flex items-center justify-between p-3 rounded-xl bg-accent">
                <div className="flex items-center gap-3">
                  <bot.icon className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{bot.name}</p>
                    <p className="text-[11px] text-muted-foreground">{bot.desc}</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(bot.link); toast({ title: 'Copied!' }); }} className="h-8 w-8 p-0 rounded-lg">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
            ))}
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
