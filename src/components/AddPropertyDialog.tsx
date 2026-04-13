import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { calculateWWS, getComplianceStatus } from '@/lib/wws';
import { useToast } from '@/hooks/use-toast';
import { Home, Users, ArrowLeft, ArrowRight } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function AddPropertyDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'status' | 'property' | 'preferences'>('status');
  const [status, setStatus] = useState<'rented' | 'seeking'>('seeking');

  // Block 1: Property fields
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [surfaceM2, setSurfaceM2] = useState('');
  const [buildingYear, setBuildingYear] = useState('');
  const [energyLabel, setEnergyLabel] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [accommodationType, setAccommodationType] = useState<'independent' | 'shared'>('independent');
  const [furnishedStatus, setFurnishedStatus] = useState('');
  const [numRooms, setNumRooms] = useState('');
  const [availableDate, setAvailableDate] = useState('');
  const [minLeaseLength, setMinLeaseLength] = useState('');
  const [sector, setSector] = useState('');

  // Block 2: Tenant Preferences
  const [maxOccupants, setMaxOccupants] = useState('1');
  const [smokingAllowed, setSmokingAllowed] = useState('No');
  const [petsAllowed, setPetsAllowed] = useState('No');
  const [acceptedTypes, setAcceptedTypes] = useState<string[]>(['Working professional']);
  const [minIncome, setMinIncome] = useState('');
  const [referencesRequired, setReferencesRequired] = useState(false);

  // Tenant fields (only for rented)
  const [tenantName, setTenantName] = useState('');
  const [tenantContractStart, setTenantContractStart] = useState('');
  const [tenantDeposit, setTenantDeposit] = useState('');

  // Auto-calc min income when rent changes
  const autoMinIncome = () => {
    const rent = parseFloat(rentAmount) || 0;
    if (rent > 0 && !minIncome) {
      setMinIncome((rent * 3).toString());
    }
  };

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
      address, postcode, city,
      surface_m2: surface || null,
      building_year: year || null,
      energy_label: label,
      rent_amount: rent || null,
      accommodation_type: accommodationType,
      wws_points: wws.total_points,
      wws_max_rent: wws.max_rent,
      wws_compliant: compliance === 'compliant',
      status,
      furnished_status: furnishedStatus || null,
      num_rooms: parseInt(numRooms) || null,
      available_date: availableDate || null,
      min_lease_length: minLeaseLength || null,
      sector: sector || null,
    };

    if (status === 'rented') {
      insertData.tenant_name = tenantName || null;
      insertData.tenant_contract_start = tenantContractStart || null;
      insertData.tenant_monthly_rent = rent || null;
      insertData.tenant_deposit = parseFloat(tenantDeposit) || null;
    }

    const { data: propData, error } = await supabase.from('landlord_properties').insert(insertData).select('id').single();

    if (error) {
      setLoading(false);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    // Save criteria for this property
    if (propData?.id) {
      await supabase.from('landlord_criteria').insert([{
        property_id: propData.id,
        max_occupants: parseInt(maxOccupants) || 1,
        smoking_allowed: smokingAllowed,
        pets_allowed: petsAllowed,
        accepted_tenant_types: acceptedTypes,
        min_income: parseFloat(minIncome) || (rent * 3),
        references_required: referencesRequired,
      }] as any);
    }

    setLoading(false);
    toast({ title: 'Property added' });
    onCreated();
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setAddress(''); setPostcode(''); setCity(''); setSurfaceM2('');
    setBuildingYear(''); setEnergyLabel(''); setRentAmount('');
    setAccommodationType('independent'); setStatus('seeking');
    setTenantName(''); setTenantContractStart(''); setTenantDeposit('');
    setFurnishedStatus(''); setNumRooms(''); setAvailableDate('');
    setMinLeaseLength(''); setSector('');
    setMaxOccupants('1'); setSmokingAllowed('No'); setPetsAllowed('No');
    setAcceptedTypes(['Working professional']); setMinIncome('');
    setReferencesRequired(false);
    setStep('status');
  };

  const toggleType = (type: string) => {
    setAcceptedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Property</DialogTitle>
        </DialogHeader>

        {step === 'status' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">What's the current status of this property?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setStatus('rented'); setStep('property'); }}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/50 bg-card transition-all hover:bg-primary/5"
              >
                <Home className="w-8 h-8 text-primary" />
                <div className="text-center">
                  <p className="font-medium text-foreground text-sm">Already Rented</p>
                  <p className="text-xs text-muted-foreground mt-1">Has a current tenant</p>
                </div>
              </button>
              <button
                onClick={() => { setStatus('seeking'); setStep('property'); }}
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
        ) : step === 'property' ? (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep('status')} className="text-muted-foreground -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Step 1 of 2 — Property Details</p>

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
                <Label>Number of rooms</Label>
                <Input type="number" value={numRooms} onChange={e => setNumRooms(e.target.value)} placeholder="3" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Building Year</Label>
                <Input type="number" value={buildingYear} onChange={e => setBuildingYear(e.target.value)} placeholder="1990" />
              </div>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-2">
                <Label>Furnished</Label>
                <Select value={furnishedStatus} onValueChange={setFurnishedStatus}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Furnished">Furnished</SelectItem>
                    <SelectItem value="Gestoffeerd (semi)">Gestoffeerd (semi)</SelectItem>
                    <SelectItem value="Unfurnished">Unfurnished</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Monthly Rent (€)</Label>
              <Input type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} onBlur={autoMinIncome} placeholder="850" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Available date</Label>
                <Input type="date" value={availableDate} onChange={e => setAvailableDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Min. lease length</Label>
                <Select value={minLeaseLength} onValueChange={setMinLeaseLength}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6 months">6 months</SelectItem>
                    <SelectItem value="12 months">12 months</SelectItem>
                    <SelectItem value="24 months">24 months</SelectItem>
                    <SelectItem value="Indefinite">Indefinite</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sector</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vrije sector">Vrije sector</SelectItem>
                  <SelectItem value="Sociale huur">Sociale huur</SelectItem>
                  <SelectItem value="Middenhuur">Middenhuur</SelectItem>
                </SelectContent>
              </Select>
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

            <Button className="w-full" onClick={() => setStep('preferences')} disabled={!address}>
              Next: Tenant Preferences <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep('property')} className="text-muted-foreground -ml-2">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Step 2 of 2 — Tenant Preferences</p>

            <div className="space-y-2">
              <Label>Maximum number of occupants</Label>
              <Input type="number" value={maxOccupants} onChange={e => setMaxOccupants(e.target.value)} placeholder="1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Smoking allowed</Label>
                <Select value={smokingAllowed} onValueChange={setSmokingAllowed}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="Outside only">Outside only</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pets allowed</Label>
                <Select value={petsAllowed} onValueChange={setPetsAllowed}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Negotiable">Negotiable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Acceptable tenant types</Label>
              <div className="flex flex-wrap gap-2">
                {['Working professional', 'Student', 'Family', 'ZZP', 'Uitkering'].map(type => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      acceptedTypes.includes(type)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-accent text-muted-foreground'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Minimum income requirement (€/month)</Label>
              <Input type="number" value={minIncome} onChange={e => setMinIncome(e.target.value)} placeholder={`${(parseFloat(rentAmount) || 850) * 3}`} />
              <p className="text-[10px] text-muted-foreground">Auto-filled as 3× rent. Adjust as needed.</p>
            </div>

            <div className="flex items-center justify-between">
              <Label>References required</Label>
              <Switch checked={referencesRequired} onCheckedChange={setReferencesRequired} />
            </div>

            <Button className="w-full" onClick={handleSave} disabled={loading || !address}>
              {loading ? 'Saving...' : 'Add Property'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
