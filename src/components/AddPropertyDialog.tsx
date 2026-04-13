import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { calculateWWS, getComplianceStatus } from '@/lib/wws';
import { useToast } from '@/hooks/use-toast';
import { Home, Users } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function AddPropertyDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'status' | 'details'>('status');
  const [status, setStatus] = useState<'rented' | 'seeking'>('seeking');

  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [surfaceM2, setSurfaceM2] = useState('');
  const [buildingYear, setBuildingYear] = useState('');
  const [energyLabel, setEnergyLabel] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [accommodationType, setAccommodationType] = useState<'independent' | 'shared'>('independent');

  // Tenant fields (only for rented)
  const [tenantName, setTenantName] = useState('');
  const [tenantContractStart, setTenantContractStart] = useState('');
  const [tenantDeposit, setTenantDeposit] = useState('');

  const handleSave = async () => {
    if (!user || !address) return;
    setLoading(true);

    const surface = parseFloat(surfaceM2) || 0;
    const year = parseInt(buildingYear) || 2000;
    const rent = parseFloat(rentAmount) || 0;
    const label = energyLabel || 'C';

    const wws = calculateWWS({
      surface_m2: surface,
      building_year: year,
      energy_label: label,
      accommodation_type: accommodationType,
    });

    const compliance = getComplianceStatus(rent, wws.max_rent);

    const insertData: any = {
      landlord_id: user.id,
      address,
      postcode,
      city,
      surface_m2: surface || null,
      building_year: year || null,
      energy_label: label,
      rent_amount: rent || null,
      accommodation_type: accommodationType,
      wws_points: wws.total_points,
      wws_max_rent: wws.max_rent,
      wws_compliant: compliance === 'compliant',
      status,
    };

    if (status === 'rented') {
      insertData.tenant_name = tenantName || null;
      insertData.tenant_contract_start = tenantContractStart || null;
      insertData.tenant_monthly_rent = rent || null;
      insertData.tenant_deposit = parseFloat(tenantDeposit) || null;
    }

    const { error } = await supabase.from('landlord_properties').insert(insertData);

    setLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Property added' });
      onCreated();
      onOpenChange(false);
      resetForm();
    }
  };

  const resetForm = () => {
    setAddress(''); setPostcode(''); setCity(''); setSurfaceM2('');
    setBuildingYear(''); setEnergyLabel(''); setRentAmount('');
    setAccommodationType('independent'); setStatus('seeking');
    setTenantName(''); setTenantContractStart(''); setTenantDeposit('');
    setStep('status');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Property</DialogTitle>
        </DialogHeader>

        {step === 'status' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">What's the current status of this property?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setStatus('rented'); setStep('details'); }}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/50 bg-card transition-all hover:bg-primary/5"
              >
                <Home className="w-8 h-8 text-primary" />
                <div className="text-center">
                  <p className="font-medium text-foreground text-sm">Already Rented</p>
                  <p className="text-xs text-muted-foreground mt-1">Has a current tenant</p>
                </div>
              </button>
              <button
                onClick={() => { setStatus('seeking'); setStep('details'); }}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/50 bg-card transition-all hover:bg-primary/5"
              >
                <Users className="w-8 h-8 text-primary" />
                <div className="text-center">
                  <p className="font-medium text-foreground text-sm">Looking for Tenant</p>
                  <p className="text-xs text-muted-foreground mt-1">Accepting applicants</p>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep('status')} className="text-muted-foreground -ml-2">
              ← Back
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Postcode</Label>
                <Input value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="1234 AB" />
              </div>
              <div className="space-y-2">
                <Label>Address / House №</Label>
                <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Keizersgracht 123" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Amsterdam" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Surface (m²)</Label>
                <Input type="number" value={surfaceM2} onChange={e => setSurfaceM2(e.target.value)} placeholder="65" />
              </div>
              <div className="space-y-2">
                <Label>Building Year</Label>
                <Input type="number" value={buildingYear} onChange={e => setBuildingYear(e.target.value)} placeholder="1990" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Energy Label</Label>
                <Select value={energyLabel} onValueChange={setEnergyLabel}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {['A+++++','A++++','A+++','A++','A+','A','B','C','D','E','F','G'].map(l => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={accommodationType} onValueChange={v => setAccommodationType(v as 'independent' | 'shared')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="independent">Independent</SelectItem>
                    <SelectItem value="shared">Shared</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Current Rent (€/month)</Label>
              <Input type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} placeholder="850" />
            </div>

            {status === 'rented' && (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Tenant Details</p>
                <div className="space-y-2">
                  <Label>Tenant Name</Label>
                  <Input value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="Full name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Contract Start</Label>
                    <Input type="date" value={tenantContractStart} onChange={e => setTenantContractStart(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Deposit (€)</Label>
                    <Input type="number" value={tenantDeposit} onChange={e => setTenantDeposit(e.target.value)} placeholder="1700" />
                  </div>
                </div>
              </div>
            )}

            <Button className="w-full" onClick={handleSave} disabled={loading || !address}>
              {loading ? 'Saving...' : 'Add Property'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
