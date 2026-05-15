import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Copy } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyAddress: string;
  defaultName?: string;
  onMarked?: () => void;
}

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER || '3197010227583';

function buildBotLink(propertyId: string) {
  return `https://wa.me/${WA_NUMBER}?text=start%20${propertyId}`;
}

function buildWelcomeMessage(name: string, address: string, link: string) {
  const first = (name || 'there').split(' ')[0];
  return `Hey ${first}! Welcome to your new home at ${address}.

I'm your AI assistant for this property — I can help with the wifi, heating, waste schedule, house rules, contract questions, maintenance contacts, and anything else about the place.

Just tap the link below to get started, then send me a message any time:
${link}

Hope you enjoy your stay!`;
}

export default function MarkAsRentedDialog({ open, onOpenChange, propertyId, propertyAddress, defaultName = '', onMarked }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(defaultName); setPhone(''); setEmail(''); setContractStart('');
    setMonthlyRent(''); setDeposit('');
  };

  const save = async () => {
    if (!name.trim()) {
      toast({ title: 'Tenant name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('landlord_properties').update({
      status: 'rented',
      tenant_name: name.trim(),
      tenant_phone: phone.trim() || null,
      tenant_email: email.trim() || null,
      tenant_contract_start: contractStart || null,
      tenant_monthly_rent: monthlyRent ? parseFloat(monthlyRent) : null,
      tenant_deposit: deposit ? parseFloat(deposit) : null,
      // Reset bot identity so the new tenant can claim it via start
      tenant_whatsapp_phone: null,
    }).eq('id', propertyId);
    setSaving(false);

    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }

    const link = buildBotLink(propertyId);
    const msg = buildWelcomeMessage(name, propertyAddress, link);

    // Try WhatsApp deep link if a phone was provided.
    if (phone.trim()) {
      const cleaned = phone.replace(/[^\d]/g, '');
      const wa = `https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`;
      try { await navigator.clipboard.writeText(msg); } catch { /* ignore */ }
      window.open(wa, '_blank', 'noopener');
      toast({ title: 'Welcome message ready', description: 'WhatsApp opened with the welcome message. The text is also copied to your clipboard.' });
    } else {
      try { await navigator.clipboard.writeText(msg); } catch { /* ignore */ }
      toast({ title: 'Welcome message copied', description: 'Paste it to your tenant on WhatsApp, iMessage, or anywhere.' });
    }

    onMarked?.();
    onOpenChange(false);
    reset();
  };

  const link = buildBotLink(propertyId);
  const msgPreview = buildWelcomeMessage(name || 'Tenant', propertyAddress, link);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark as rented</DialogTitle>
          <DialogDescription>
            Add the tenant's details. We'll prepare a WhatsApp welcome message that links them to their personal AI assistant for this home.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tenant full name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Anna de Vries" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">WhatsApp phone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+31 6 1234 5678" inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="anna@example.com" inputMode="email" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Contract start</Label>
            <Input type="date" value={contractStart} onChange={e => setContractStart(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Monthly rent (€)</Label>
              <Input type="number" value={monthlyRent} onChange={e => setMonthlyRent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Deposit (€)</Label>
              <Input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-accent/40 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Welcome message preview</p>
            <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{msgPreview}</p>
            <button
              type="button"
              onClick={async () => { await navigator.clipboard.writeText(msgPreview); toast({ title: 'Copied' }); }}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary"
            >
              <Copy className="w-3 h-3" /> Copy message only
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            <MessageCircle className="w-4 h-4" />
            {saving ? 'Saving…' : (phone.trim() ? 'Save & open WhatsApp' : 'Save & copy message')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
