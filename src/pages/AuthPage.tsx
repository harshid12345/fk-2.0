import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, ArrowRight, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(true);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { signUp, signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [portfolioSize, setPortfolioSize] = useState('');

  const handleSignIn = async () => {
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      navigate('/properties');
    }
  };

  const handleNextStep = async () => {
    if (step === 1) {
      if (!fullName || !email || !password) {
        toast({ title: 'Missing fields', description: 'Please fill in all fields', variant: 'destructive' });
        return;
      }
      if (password.length < 6) {
        toast({ title: 'Weak password', description: 'Password must be at least 6 characters', variant: 'destructive' });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setLoading(true);
      const { error } = await signUp(email, password, fullName);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Wait for auth state to update, then create landlord record
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('landlords').insert({
          id: user.id,
          full_name: fullName,
          email,
          phone,
          portfolio_size: portfolioSize,
        });
      }
      setLoading(false);
      navigate('/properties');
    }
  };

  if (!isSignUp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to FairKamer Landlord</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button className="w-full" onClick={handleSignIn} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <button onClick={() => setIsSignUp(true)} className="text-primary hover:underline">Sign up</button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Create your account</h1>
          <p className="text-sm text-muted-foreground">Step {step} of 3</p>
          <div className="flex gap-1.5 justify-center">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1 w-8 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+31 6 1234 5678" />
              </div>
              <div className="space-y-2">
                <Label>How many properties do you rent out?</Label>
                <Select value={portfolioSize} onValueChange={setPortfolioSize}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
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
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Almost there!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Click below to create your account. You can add properties from your dashboard.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            )}
            <Button onClick={handleNextStep} disabled={loading} className="flex-1">
              {step === 3 ? (loading ? 'Creating...' : 'Create Account') : 'Continue'}
              {step < 3 && <ArrowRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <button onClick={() => setIsSignUp(false)} className="text-primary hover:underline">Sign in</button>
        </p>
      </div>
    </div>
  );
}
