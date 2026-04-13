import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import TopNav from '@/components/TopNav';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Copy, Bot, MessageCircle } from 'lucide-react';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('landlords').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setFullName(data.full_name || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
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

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copied!' });
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>

        <Card className="p-5 bg-card space-y-4">
          <h3 className="font-medium text-foreground">Profile</h3>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveProfile} disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Button>
            <Button variant="outline" onClick={signOut}>Sign Out</Button>
          </div>
        </Card>

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
