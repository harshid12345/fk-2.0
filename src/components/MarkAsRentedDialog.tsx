import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyAddress: string;
  conciergeToken?: string | null;
  defaultName?: string;
  onMarked?: () => void;
}

function buildWelcomeMessage(name: string, address: string, supportLink: string | null) {
  const first = (name || 'there').split(' ')[0];
  const linkPart = supportLink
    ? `\n\nIf you ever have a question about the property, you can reach our support here:\n${supportLink}`
    : '';
  return `Hey ${first}! Welcome to your new home at ${address}.${linkPart}\n\nHope you enjoy your stay!`;
}

export default function MarkAsRentedDialog({ open, onOpenChange, propertyId, propertyAddress, conciergeToken, defaultName = '', onMarked }: Props) {
  const { toast } = useToast();
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setName(defaultName); setPhone(''); setEmail(''); setContractStart('');
    setMonthlyRent(''); setDeposit(''); setCopied(false);
  };

  const supportLink = conciergeToken
    ? `${window.location.origin}/support/${conciergeToken}`
    : null;

  const msgPreview = buildWelcomeMessage(name || 'Tenant', propertyAddress, supportLink);

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
      tenant_whatsapp_phone: null, // clear old WA binding
    }).eq('id', propertyId);
    setSaving(false);

    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
      return;
    }

    try { await navigator.clipboard.writeText(msgPreview); } catch { /* ignore */ }
    toast({ title: 'Tenant saved', description: 'Welcome message copied to clipboard.' });

    onMarked?.();
    onOpenChange(false);
    reset();
  };

  const copyMsg = async () => {
    try { await navigator.clipboard.writeText(msgPreview); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark as rented</DialogTitle>
          <DialogDescription>
            Add the tenant's details. We'll prepare a welcome message with the support link for this property.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tenant full name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Anna de Vries" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Phone</Label>
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

          {supportLink && (
            <div className="rounded-xl border border-border bg-accent/40 p-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Support link</p>
              <p className="text-xs text-muted-foreground font-mono break-all">{supportLink}</p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-accent/40 p-3 space-y-2">
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Welcome message preview</p>
            <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{msgPreview}</p>
            <button
              type="button"
              onClick={copyMsg}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy message'}
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save tenant'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
