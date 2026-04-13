import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import TopNav from '@/components/TopNav';
import { Card } from '@/components/ui/card';
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

const CRITERIA_QUESTIONS = [
  { key: 'preferred_gender', question: 'Do you have a gender preference for tenants?', type: 'select', options: [{ value: 'any', label: 'No preference' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }] },
  { key: 'min_age', question: 'What is the minimum age you accept?', type: 'number', placeholder: '18' },
  { key: 'max_age', question: 'What is the maximum age you accept?', type: 'number', placeholder: '65' },
  { key: 'smoking_allowed', question: 'Is smoking allowed in the property?', type: 'toggle' },
  { key: 'pets_allowed', question: 'Are pets allowed?', type: 'toggle' },
  { key: 'students_ok', question: 'Do you accept students?', type: 'toggle' },
  { key: 'professionals_ok', question: 'Do you accept working professionals?', type: 'toggle' },
  { key: 'min_income_multiplier', question: 'Minimum income multiplier (e.g. 3x rent)?', type: 'number', placeholder: '3.0' },
  { key: 'notes', question: 'Any additional preferences or requirements?', type: 'textarea', placeholder: 'E.g. no loud music after 22:00, must have references...' },
];

// Availability
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Criteria
  const [criteriaStep, setCriteriaStep] = useState(-1); // -1 = not started/completed
  const [criteria, setCriteria] = useState<CriteriaState>({ ...defaultCriteria });
  const [sameCriteriaForAll, setSameCriteriaForAll] = useState(true);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyForCriteria, setSelectedPropertyForCriteria] = useState<string | null>(null);
  const [criteriaCompleted, setCriteriaCompleted] = useState(false);

  // Availability
  const [availability, setAvailability] = useState<Record<string, { enabled: boolean; from: string; to: string }>>(() => {
    const init: Record<string, { enabled: boolean; from: string; to: string }> = {};
    DAYS.forEach(d => { init[d] = { enabled: d !== 'Sunday', from: '10:00', to: '18:00' }; });
    return init;
  });

  useEffect(() => {
    if (!user) return;
    // Load profile
    supabase.from('landlords').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setFullName(data.full_name || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
      }
    });
    // Load properties for per-property criteria
    supabase.from('landlord_properties').select('id, address, city').then(({ data }) => {
      setProperties(data || []);
    });
    // Load existing criteria (check if any exist)
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
    toast({ title: 'Profile updated' });
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
      // Delete existing and insert for all properties
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
    toast({ title: 'Criteria saved for ' + (sameCriteriaForAll ? 'all properties' : '1 property') });
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copied!' });
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
            <SelectContent>
              {q.options!.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {q.type === 'number' && (
          <Input type="number" value={criteria[key] as string} onChange={e => setCriteria({ ...criteria, [key]: e.target.value })} placeholder={q.placeholder} />
        )}
        {q.type === 'toggle' && (
          <div className="flex items-center gap-3">
            <Switch checked={criteria[key] as boolean} onCheckedChange={v => setCriteria({ ...criteria, [key]: v })} />
            <span className="text-sm text-muted-foreground">{(criteria[key] as boolean) ? 'Yes' : 'No'}</span>
          </div>
        )}
        {q.type === 'textarea' && (
          <Textarea value={criteria[key] as string} onChange={e => setCriteria({ ...criteria, [key]: e.target.value })} placeholder={q.placeholder} rows={3} />
        )}
        <div className="flex gap-2">
          {criteriaStep > 0 && (
            <Button variant="outline" onClick={() => setCriteriaStep(criteriaStep - 1)} className="flex-1">Back</Button>
          )}
          {criteriaStep < CRITERIA_QUESTIONS.length - 1 ? (
            <Button onClick={() => setCriteriaStep(criteriaStep + 1)} className="flex-1">
              Next <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={saveCriteria} disabled={loading} className="flex-1">
              <Check className="w-4 h-4 mr-1" /> {loading ? 'Saving...' : 'Save Criteria'}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>

        {/* Profile */}
        <Card className="p-5 bg-card space-y-4">
          <h3 className="font-medium text-foreground">Profile</h3>
          <div className="space-y-3">
            <div className="space-y-2"><Label>Full Name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveProfile} disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Button>
            <Button variant="outline" onClick={signOut}>Sign Out</Button>
          </div>
        </Card>

        {/* Tenant Criteria Questionnaire */}
        <Card className="p-5 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">Tenant Criteria</h3>
            {criteriaCompleted && (
              <Button variant="ghost" size="sm" onClick={() => setCriteriaStep(0)}>
                <RotateCcw className="w-4 h-4 mr-1" /> Retake
              </Button>
            )}
          </div>

          {criteriaStep === -1 ? (
            criteriaCompleted ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">Gender Pref</p><p className="text-foreground capitalize">{criteria.preferred_gender || 'Any'}</p></div>
                  <div><p className="text-muted-foreground text-xs">Age Range</p><p className="text-foreground">{criteria.min_age}–{criteria.max_age}</p></div>
                  <div><p className="text-muted-foreground text-xs">Smoking</p><p className="text-foreground">{criteria.smoking_allowed ? 'Allowed' : 'Not allowed'}</p></div>
                  <div><p className="text-muted-foreground text-xs">Pets</p><p className="text-foreground">{criteria.pets_allowed ? 'Allowed' : 'Not allowed'}</p></div>
                  <div><p className="text-muted-foreground text-xs">Students</p><p className="text-foreground">{criteria.students_ok ? 'OK' : 'No'}</p></div>
                  <div><p className="text-muted-foreground text-xs">Income Multiplier</p><p className="text-foreground">{criteria.min_income_multiplier}x</p></div>
                </div>
                {criteria.notes && <p className="text-sm text-muted-foreground italic">"{criteria.notes}"</p>}

                <div className="border-t border-border pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Same criteria for all properties</Label>
                    <Switch checked={sameCriteriaForAll} onCheckedChange={setSameCriteriaForAll} />
                  </div>
                  {!sameCriteriaForAll && properties.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Select a property to customize:</p>
                      {properties.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { setSelectedPropertyForCriteria(p.id); setCriteriaStep(0); }}
                          className="flex items-center gap-2 w-full p-2 rounded-lg text-left text-sm hover:bg-secondary/50 transition-colors border border-border"
                        >
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
              <div className="text-center py-4 space-y-3">
                <p className="text-sm text-muted-foreground">Set your tenant screening criteria. This helps our bot filter applicants for you.</p>
                <Button onClick={() => setCriteriaStep(0)}>
                  Start Questionnaire <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
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
        </Card>

        {/* Viewing Availability */}
        <Card className="p-5 bg-card space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h3 className="font-medium text-foreground">Viewing Availability</h3>
          </div>
          <p className="text-sm text-muted-foreground">Set when you're available for property viewings</p>
          <div className="space-y-2">
            {DAYS.map(day => (
              <div key={day} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                <Switch
                  checked={availability[day].enabled}
                  onCheckedChange={v => setAvailability({ ...availability, [day]: { ...availability[day], enabled: v } })}
                />
                <span className="text-sm text-foreground w-24">{day}</span>
                {availability[day].enabled ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Input
                      type="time"
                      value={availability[day].from}
                      onChange={e => setAvailability({ ...availability, [day]: { ...availability[day], from: e.target.value } })}
                      className="w-28 h-8 text-xs"
                    />
                    <span className="text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={availability[day].to}
                      onChange={e => setAvailability({ ...availability, [day]: { ...availability[day], to: e.target.value } })}
                      className="w-28 h-8 text-xs"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Unavailable</span>
                )}
              </div>
            ))}
          </div>
          <Button onClick={() => toast({ title: 'Availability saved' })}>Save Availability</Button>
        </Card>

        {/* Telegram Bots */}
        <Card className="p-5 bg-card space-y-4">
          <h3 className="font-medium text-foreground">Telegram Bots</h3>
          <p className="text-sm text-muted-foreground">Share these links with applicants and tenants</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Screening Bot</p>
                  <p className="text-xs text-muted-foreground">Share with new applicants</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => copyLink('https://t.me/FairKamerBot')}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
              <div className="flex items-center gap-3">
                <MessageCircle className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Concierge Bot</p>
                  <p className="text-xs text-muted-foreground">Share with current tenants</p>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => copyLink('https://t.me/FairKamerConcierge')}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
