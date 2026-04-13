import { useState, useEffect } from 'react';
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
import { Copy, Bot, MessageCircle, ArrowRight, Check, RotateCcw, Clock, Building2 } from 'lucide-react';

interface CriteriaState {
  preferred_gender: string;
  min_age: string;
  max_age: string;
  smoking_allowed: boolean;
  pets_allowed: boolean;
  students_ok: boolean;
  professionals_ok: boolean;
  min_income_multiplier: string;
  notes: string;
}

const defaultCriteria: CriteriaState = {
  preferred_gender: 'any',
  min_age: '18',
  max_age: '65',
  smoking_allowed: false,
  pets_allowed: false,
  students_ok: true,
  professionals_ok: true,
  min_income_multiplier: '3.0',
  notes: '',
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

  const [availability, setAvailability] = useState<Record<string, { enabled: boolean; from: string; to: string }>>(() => {
    const init: Record<string, { enabled: boolean; from: string; to: string }> = {};
    DAYS.forEach(d => { init[d] = { enabled: d !== 'Sunday', from: '10:00', to: '18:00' }; });
    return init;
  });

  const CRITERIA_QUESTIONS = [
    { key: 'preferred_gender', question: t('criteria.q_gender'), type: 'select', options: [{ value: 'any', label: t('criteria.no_pref') }, { value: 'male', label: t('criteria.male') }, { value: 'female', label: t('criteria.female') }] },
    { key: 'min_age', question: t('criteria.q_min_age'), type: 'number', placeholder: '18' },
    { key: 'max_age', question: t('criteria.q_max_age'), type: 'number', placeholder: '65' },
    { key: 'smoking_allowed', question: t('criteria.q_smoking'), type: 'toggle' },
    { key: 'pets_allowed', question: t('criteria.q_pets'), type: 'toggle' },
    { key: 'students_ok', question: t('criteria.q_students'), type: 'toggle' },
    { key: 'professionals_ok', question: t('criteria.q_professionals'), type: 'toggle' },
    { key: 'min_income_multiplier', question: t('criteria.q_income'), type: 'number', placeholder: '3.0' },
    { key: 'notes', question: t('criteria.q_notes'), type: 'textarea', placeholder: t('criteria.notes_placeholder') },
  ];

  useEffect(() => {
    if (!user) return;
    supabase.from('landlords').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) { setFullName(data.full_name || ''); setPhone(data.phone || ''); setEmail(data.email || ''); }
    });
    supabase.from('landlord_properties').select('id, address, city').then(({ data }) => { setProperties(data || []); });
    supabase.from('landlord_criteria').select('*').then(({ data }) => {
      if (data && data.length > 0) {
        setCriteriaCompleted(true);
        const first = data[0];
        setCriteria({
          preferred_gender: first.preferred_gender || 'any',
          min_age: first.min_age?.toString() || '18',
          max_age: first.max_age?.toString() || '65',
          smoking_allowed: first.smoking_allowed || false,
          pets_allowed: first.pets_allowed || false,
          students_ok: first.students_ok ?? true,
          professionals_ok: first.professionals_ok ?? true,
          min_income_multiplier: first.min_income_multiplier?.toString() || '3.0',
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
      min_age: parseInt(criteria.min_age) || null,
      max_age: parseInt(criteria.max_age) || null,
      smoking_allowed: criteria.smoking_allowed,
      pets_allowed: criteria.pets_allowed,
      students_ok: criteria.students_ok,
      professionals_ok: criteria.professionals_ok,
      min_income_multiplier: parseFloat(criteria.min_income_multiplier) || 3.0,
      notes: criteria.notes || null,
    };
    if (sameCriteriaForAll) {
      for (const prop of properties) {
        await supabase.from('landlord_criteria').delete().eq('property_id', prop.id);
        await supabase.from('landlord_criteria').insert({ ...criteriaData, property_id: prop.id });
      }
    } else if (selectedPropertyForCriteria) {
      await supabase.from('landlord_criteria').delete().eq('property_id', selectedPropertyForCriteria);
      await supabase.from('landlord_criteria').insert({ ...criteriaData, property_id: selectedPropertyForCriteria });
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
      <div className="space-y-4">
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
          {criteriaStep > 0 && <Button variant="outline" onClick={() => setCriteriaStep(criteriaStep - 1)} className="flex-1 h-9">{t('settings.back')}</Button>}
          {criteriaStep < CRITERIA_QUESTIONS.length - 1 ? (
            <Button onClick={() => setCriteriaStep(criteriaStep + 1)} className="flex-1 h-9">{t('settings.next')} <ArrowRight className="w-4 h-4 ml-1" /></Button>
          ) : (
            <Button onClick={saveCriteria} disabled={loading} className="flex-1 h-9"><Check className="w-4 h-4 mr-1" /> {loading ? t('settings.saving') : t('settings.save_criteria')}</Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-foreground">{t('settings.title')}</h1>

      {/* Profile */}
      <div className="p-5 bg-card rounded-xl border border-border space-y-4">
        <h3 className="font-medium text-foreground text-sm">{t('settings.profile')}</h3>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label className="text-xs">{t('settings.full_name')}</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs">{t('settings.email')}</Label><Input value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label className="text-xs">{t('settings.phone')}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
        </div>
        <Button onClick={saveProfile} disabled={loading} className="h-9 text-sm">{loading ? t('settings.saving') : t('settings.save')}</Button>
      </div>

      {/* Criteria */}
      <div className="p-5 bg-card rounded-xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground text-sm">{t('settings.criteria')}</h3>
          {criteriaCompleted && (
            <Button variant="ghost" size="sm" onClick={() => setCriteriaStep(0)} className="h-7 text-xs text-muted-foreground">
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> {t('settings.retake')}
            </Button>
          )}
        </div>
        {criteriaStep === -1 ? (
          criteriaCompleted ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">{t('settings.gender_pref')}</p><p className="text-foreground capitalize mt-0.5">{criteria.preferred_gender === 'any' ? t('settings.any') : criteria.preferred_gender}</p></div>
                <div><p className="text-muted-foreground text-xs">{t('settings.age_range')}</p><p className="text-foreground mt-0.5">{criteria.min_age}–{criteria.max_age}</p></div>
                <div><p className="text-muted-foreground text-xs">{t('settings.smoking')}</p><p className="text-foreground mt-0.5">{criteria.smoking_allowed ? t('settings.allowed') : t('settings.not_allowed')}</p></div>
                <div><p className="text-muted-foreground text-xs">{t('settings.pets')}</p><p className="text-foreground mt-0.5">{criteria.pets_allowed ? t('settings.allowed') : t('settings.not_allowed')}</p></div>
                <div><p className="text-muted-foreground text-xs">{t('settings.students')}</p><p className="text-foreground mt-0.5">{criteria.students_ok ? t('settings.ok') : t('settings.no')}</p></div>
                <div><p className="text-muted-foreground text-xs">{t('settings.income_mult')}</p><p className="text-foreground mt-0.5">{criteria.min_income_multiplier}x</p></div>
              </div>
              {criteria.notes && <p className="text-sm text-muted-foreground italic">"{criteria.notes}"</p>}
              <div className="border-t border-border pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">{t('settings.same_for_all')}</Label>
                  <Switch checked={sameCriteriaForAll} onCheckedChange={setSameCriteriaForAll} />
                </div>
                {!sameCriteriaForAll && properties.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{t('settings.select_property')}</p>
                    {properties.map(p => (
                      <button key={p.id} onClick={() => { setSelectedPropertyForCriteria(p.id); setCriteriaStep(0); }}
                        className="flex items-center gap-2 w-full p-2.5 rounded-lg text-left text-sm hover:bg-accent transition-colors border border-border">
                        <Building2 className="w-4 h-4 text-primary" />
                        <span className="text-foreground">{p.address}</span>
                        <span className="text-muted-foreground text-xs ml-auto">{p.city}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-muted-foreground">{t('settings.criteria_desc')}</p>
              <Button onClick={() => setCriteriaStep(0)} className="h-9 text-sm">{t('settings.start_questionnaire')} <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
          )
        ) : (
          <div>
            <div className="flex gap-1 mb-4">
              {CRITERIA_QUESTIONS.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= criteriaStep ? 'bg-primary' : 'bg-border'}`} />
              ))}
            </div>
            {renderCriteriaQuestion()}
          </div>
        )}
      </div>

      {/* Availability */}
      <div className="p-5 bg-card rounded-xl border border-border space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-[18px] h-[18px] text-primary" />
          <h3 className="font-medium text-foreground text-sm">{t('settings.availability')}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{t('settings.availability_desc')}</p>
        <div className="space-y-1.5">
          {DAYS.map(day => (
            <div key={day} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors">
              <Switch checked={availability[day].enabled} onCheckedChange={v => setAvailability({ ...availability, [day]: { ...availability[day], enabled: v } })} />
              <span className="text-sm text-foreground w-24">{day}</span>
              {availability[day].enabled ? (
                <div className="flex items-center gap-2 text-sm">
                  <Input type="time" value={availability[day].from} onChange={e => setAvailability({ ...availability, [day]: { ...availability[day], from: e.target.value } })} className="w-28 h-8 text-xs" />
                  <span className="text-muted-foreground">to</span>
                  <Input type="time" value={availability[day].to} onChange={e => setAvailability({ ...availability, [day]: { ...availability[day], to: e.target.value } })} className="w-28 h-8 text-xs" />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">{t('settings.unavailable')}</span>
              )}
            </div>
          ))}
        </div>
        <Button onClick={() => toast({ title: t('settings.availability_saved') })} className="h-9 text-sm">{t('settings.save_availability')}</Button>
      </div>

      {/* Telegram */}
      <div className="p-5 bg-card rounded-xl border border-border space-y-4">
        <h3 className="font-medium text-foreground text-sm">{t('settings.telegram')}</h3>
        <p className="text-sm text-muted-foreground">{t('settings.telegram_desc')}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border">
            <div className="flex items-center gap-3">
              <Bot className="w-[18px] h-[18px] text-primary" />
              <div><p className="text-sm font-medium text-foreground">{t('settings.screening_bot')}</p><p className="text-xs text-muted-foreground">{t('settings.screening_desc')}</p></div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText('https://t.me/FairKamerBot'); toast({ title: 'Copied!' }); }} className="h-7"><Copy className="w-3.5 h-3.5" /></Button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-[18px] h-[18px] text-primary" />
              <div><p className="text-sm font-medium text-foreground">{t('settings.concierge_bot')}</p><p className="text-xs text-muted-foreground">{t('settings.concierge_desc')}</p></div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText('https://t.me/FairKamerConcierge'); toast({ title: 'Copied!' }); }} className="h-7"><Copy className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
