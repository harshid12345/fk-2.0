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
import { Search, CheckCircle2, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function AddPropertyDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [bagLoading, setBagLoading] = useState(false);
  const [bagVerified, setBagVerified] = useState(false);

  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [surfaceM2, setSurfaceM2] = useState('');
  const [buildingYear, setBuildingYear] = useState('');
  const [energyLabel, setEnergyLabel] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [accommodationType, setAccommodationType] = useState<'independent' | 'shared'>('independent');

  const lookupBAG = async () => {
    if (!postcode || !address) {
      toast({ title: 'Enter address', description: 'Please enter postcode and house number first', variant: 'destructive' });
      return;
    }
    setBagLoading(true);
    try {
      // Try BAG API directly (public API, no auth needed)
      const houseNumber = address.match(/\d+/)?.[0] || '';
      const pc = postcode.replace(/\s/g, '');
      const res = await fetch(
        `https://api.bag.kadaster.nl/lvbag/individuelebevragingen/v2/adressen?postcode=${pc}&huisnummer=${houseNumber}`,
        { headers: { 'X-Api-Key': 'l7xx1f2e409d607a44baaebe22b2c7e2d0a7', 'Accept': 'application/hal+json' } }
      );
      if (res.ok) {
        const data = await res.json();
        const adres = data?._embedded?.adressen?.[0];
        if (adres) {
          setCity(adres.woonplaatsNaam || '');
          // Try to get verblijfsobject for surface area
          const voUrl = adres._links?.adresseerbaarObject?.href;
          if (voUrl) {
            const voRes = await fetch(voUrl, {
              headers: { 'X-Api-Key': 'l7xx1f2e409d607a44baaebe22b2c7e2d0a7', 'Accept': 'application/hal+json' }
            });
            if (voRes.ok) {
              const voData = await voRes.json();
              if (voData.verblijfsobject) {
                const vo = voData.verblijfsobject;
                if (vo.oppervlakte) setSurfaceM2(vo.oppervlakte.toString());
              }
            }
          }
          setBagVerified(true);
          toast({ title: 'BAG Verified', description: 'Address data fetched from Kadaster' });
        } else {
          toast({ title: 'Not found', description: 'Address not found in BAG registry', variant: 'destructive' });
        }
      }
    } catch (err) {
      console.error('BAG lookup failed:', err);
      toast({ title: 'BAG Lookup Failed', description: 'Could not reach BAG API. You can enter details manually.', variant: 'destructive' });
    }
    setBagLoading(false);
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

    const { error } = await supabase.from('landlord_properties').insert({
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
      bag_verified: bagVerified,
    });

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
    setAccommodationType('independent'); setBagVerified(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Property</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
          <Button variant="outline" className="w-full" onClick={lookupBAG} disabled={bagLoading}>
            {bagLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : bagVerified ? <CheckCircle2 className="w-4 h-4 mr-2 text-success" /> : <Search className="w-4 h-4 mr-2" />}
            {bagVerified ? 'BAG Verified' : 'Lookup from BAG'}
          </Button>
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
          <Button className="w-full" onClick={handleSave} disabled={loading || !address}>
            {loading ? 'Saving...' : 'Add Property'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
