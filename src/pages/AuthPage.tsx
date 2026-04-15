import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, ArrowRight, ArrowLeft, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DEV_EMAIL = 'dev@fairkamer.test';
const DEV_PASSWORD = 'devpass123';

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(true);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const { signUp, signIn } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [portfolioSize, setPortfolioSize] = useState('');

  const handleSignIn = async () => {
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else { navigate('/properties'); }
  };

  const handleDevLogin = async () => {
    setDevLoading(true);
    let { error } = await signIn(DEV_EMAIL, DEV_PASSWORD);
    if (error) {
      const { error: signUpErr } = await signUp(DEV_EMAIL, DEV_PASSWORD, 'Jan de Vries');
      if (signUpErr) { toast({ title: 'Dev login failed', description: signUpErr.message, variant: 'destructive' }); setDevLoading(false); return; }
      const { error: signInErr } = await signIn(DEV_EMAIL, DEV_PASSWORD);
      if (signInErr) { toast({ title: 'Dev login failed', description: signInErr.message, variant: 'destructive' }); setDevLoading(false); return; }
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: existing } = await supabase.from('landlords').select('id').eq('id', user.id).single();
      if (!existing) {
        await supabase.from('landlords').insert({ id: user.id, full_name: 'Jan de Vries', email: DEV_EMAIL, phone: '+31 6 1234 5678', portfolio_size: '2-5' });
        const properties = [
          { address: 'Keizersgracht 274', postcode: '1016 EV', city: 'Amsterdam', surface_m2: 85, building_year: 1890, energy_label: 'C', rent_amount: 1450, accommodation_type: 'independent', wws_points: 168, wws_max_rent: 1100, wws_compliant: false, status: 'rented', tenant_name: 'Sophie Bakker', tenant_contract_start: '2024-03-01', tenant_monthly_rent: 1450, tenant_deposit: 2900 },
          { address: 'Prinsengracht 512', postcode: '1017 KH', city: 'Amsterdam', surface_m2: 62, building_year: 1920, energy_label: 'B', rent_amount: 1200, accommodation_type: 'independent', wws_points: 145, wws_max_rent: 1250, wws_compliant: true, status: 'seeking' },
          { address: 'Witte de Withstraat 45', postcode: '3012 BM', city: 'Rotterdam', surface_m2: 48, building_year: 1965, energy_label: 'A', rent_amount: 950, accommodation_type: 'independent', wws_points: 132, wws_max_rent: 980, wws_compliant: true, status: 'seeking' },
          { address: 'Oudegracht 112', postcode: '3511 AX', city: 'Utrecht', surface_m2: 55, building_year: 1910, energy_label: 'D', rent_amount: 875, accommodation_type: 'shared', wws_points: 98, wws_max_rent: 900, wws_compliant: true, status: 'rented', tenant_name: 'Mark Jansen', tenant_contract_start: '2025-01-15', tenant_monthly_rent: 875, tenant_deposit: 1750 },
        ];
        for (const p of properties) { await supabase.from('landlord_properties').insert({ ...p, landlord_id: user.id }); }
      }
    }
    setDevLoading(false);
    navigate('/properties');
  };

  const handleNextStep = async () => {
    if (step === 1) {
      if (!fullName || !email || !password) { toast({ title: 'Missing fields', description: 'Please fill in all fields', variant: 'destructive' }); return; }
      if (password.length < 6) { toast({ title: 'Weak password', description: 'Password must be at least 6 characters', variant: 'destructive' }); return; }
      setStep(2);
    } else if (step === 2) { setStep(3); }
    else if (step === 3) {
      setLoading(true);
      const { error } = await signUp(email, password, fullName);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); setLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) { await supabase.from('landlords').insert({ id: user.id, full_name: fullName, email, phone, portfolio_size: portfolioSize }); }
      setLoading(false);
      navigate('/properties');
    }
  };

  const FormContainer = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        className="w-full max-w-sm space-y-6"
      >
        {children}
      </motion.div>
    </div>
  );

  if (!isSignUp) {
    return (
      <FormContainer>
        <div className="text-center space-y-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15, delay: 0.1 }}
            className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto"
          >
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </motion.div>
          <h1 className="text-xl font-semibold text-foreground">{t('auth.welcome_back')}</h1>
          <p className="text-sm text-muted-foreground">{t('auth.sign_in_to')}</p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{t('settings.email')}</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="h-11 rounded-xl" /></div>
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="h-11 rounded-xl" /></div>
          <motion.div whileTap={{ scale: 0.97 }}><Button className="w-full h-11 rounded-xl text-sm font-medium" onClick={handleSignIn} disabled={loading}>{loading ? t('auth.signing_in') : t('auth.sign_in')}</Button></motion.div>
        </div>
        <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div><div className="relative flex justify-center text-xs"><span className="bg-background px-3 text-muted-foreground">{t('auth.or')}</span></div></div>
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button variant="outline" className="w-full h-11 rounded-xl text-sm border-dashed border-primary/30 text-primary" onClick={handleDevLogin} disabled={devLoading}>
            <Zap className="w-4 h-4 mr-1.5" /> {devLoading ? t('auth.setting_up') : t('auth.dev_skip')}
          </Button>
        </motion.div>
        <p className="text-center text-sm text-muted-foreground">{t('auth.no_account')} <button onClick={() => setIsSignUp(true)} className="text-primary hover:underline">{t('auth.sign_up')}</button></p>
      </FormContainer>
    );
  }

  return (
    <FormContainer>
      <div className="text-center space-y-3">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 15, delay: 0.1 }}
          className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto"
        >
          <Building2 className="w-6 h-6 text-primary-foreground" />
        </motion.div>
        <h1 className="text-xl font-semibold text-foreground">{t('auth.create_account')}</h1>
        <div className="flex gap-2 justify-center">
          {[1, 2, 3].map(s => (
            <motion.div key={s} animate={{ scale: s === step ? 1.2 : 1 }}
              className={`w-2 h-2 rounded-full ${s <= step ? 'bg-primary' : 'bg-border'}`} transition={{ type: 'spring', damping: 15 }} />
          ))}
        </div>
      </div>
      <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', damping: 25 }} className="space-y-3">
        {step === 1 && (
          <>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{t('settings.full_name')}</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{t('settings.email')}</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="h-11 rounded-xl" /></div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{t('settings.phone')}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+31 6 1234 5678" className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Portfolio size</Label>
              <Select value={portfolioSize} onValueChange={setPortfolioSize}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 property</SelectItem>
                  <SelectItem value="2-5">2-5 properties</SelectItem>
                  <SelectItem value="6-20">6-20 properties</SelectItem>
                  <SelectItem value="20+">20+ properties</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        {step === 3 && (
          <div className="text-center space-y-3 py-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}
              className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
              <Building2 className="w-8 h-8 text-primary" />
            </motion.div>
            <h3 className="font-medium text-foreground">{t('auth.almost_there')}</h3>
            <p className="text-sm text-muted-foreground">{t('auth.almost_desc')}</p>
          </div>
        )}
        <div className="flex gap-2">
          {step > 1 && <motion.div whileTap={{ scale: 0.97 }} className="flex-1"><Button variant="outline" onClick={() => setStep(step - 1)} className="w-full h-11 rounded-xl"><ArrowLeft className="w-4 h-4 mr-1" /> {t('settings.back')}</Button></motion.div>}
          <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
            <Button onClick={handleNextStep} disabled={loading} className="w-full h-11 rounded-xl">
              {step === 3 ? (loading ? t('auth.creating') : t('auth.create')) : t('auth.continue')}
              {step < 3 && <ArrowRight className="w-4 h-4 ml-1" />}
            </Button>
          </motion.div>
        </div>
      </motion.div>
      <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div><div className="relative flex justify-center text-xs"><span className="bg-background px-3 text-muted-foreground">{t('auth.or')}</span></div></div>
      <motion.div whileTap={{ scale: 0.97 }}>
        <Button variant="outline" className="w-full h-11 rounded-xl text-sm border-dashed border-primary/30 text-primary" onClick={handleDevLogin} disabled={devLoading}>
          <Zap className="w-4 h-4 mr-1.5" /> {devLoading ? t('auth.setting_up') : t('auth.dev_skip')}
        </Button>
      </motion.div>
      <p className="text-center text-sm text-muted-foreground">{t('auth.have_account')} <button onClick={() => setIsSignUp(false)} className="text-primary hover:underline">{t('auth.sign_in')}</button></p>
    </FormContainer>
  );
}
