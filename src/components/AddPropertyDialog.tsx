import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Home, Users, ArrowLeft, Loader2, ImageIcon } from 'lucide-react';

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

  // Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Fields
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [surfaceM2, setSurfaceM2] = useState('');
  const [numRooms, setNumRooms] = useState('');
  const [availableDate, setAvailableDate] = useState('');
  const [accommodationType, setAccommodationType] = useState('');
  const [furnishedStatus, setFurnishedStatus] = useState('');

  const resetForm = () => {
    setStep('status');
    setStatus('seeking');
    setPhotoFile(null);
    setPhotoPreview(null);
    setAddress(''); setPostcode(''); setCity('');
    setRentAmount(''); setSurfaceM2(''); setNumRooms('');
    setAvailableDate(''); setAccommodationType(''); setFurnishedStatus('');
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!user || !address.trim()) return;
    setLoading(true);

    let photoUrl: string | null = null;
    if (photoFile) {
      setPhotoUploading(true);
      const ext = photoFile.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('property-photos')
        .upload(path, photoFile, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('property-photos').getPublicUrl(path);
        photoUrl = urlData.publicUrl;
      } else {
        toast({ title: 'Photo upload failed', description: uploadError.message, variant: 'destructive' });
      }
      setPhotoUploading(false);
    }

    const { error } = await supabase.from('landlord_properties').insert({
      landlord_id: user.id,
      address: address.trim(),
      postcode: postcode.trim() || null,
      city: city.trim() || null,
      rent_amount: parseFloat(rentAmount) || null,
      surface_m2: parseFloat(surfaceM2) || null,
      num_rooms: parseInt(numRooms) || null,
      available_date: availableDate || null,
      accommodation_type: accommodationType || null,
      furnished_status: furnishedStatus || null,
      status,
      photo_url: photoUrl,
    });

    setLoading(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Property added' });
    onCreated();
    onOpenChange(false);
    resetForm();
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
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>

            {/* Photo */}
            <div className="space-y-2">
              <Label>Property photo (optional)</Label>
              {photoPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border h-36">
                  <img src={photoPreview} alt="Property preview" className="w-full h-full object-cover" />
                  <label className="absolute bottom-2 right-2 bg-black/60 text-white rounded-lg px-2.5 py-1 text-xs cursor-pointer hover:bg-black/80 transition-colors flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Change
                    <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-border bg-accent/30 cursor-pointer hover:bg-accent/50 transition-colors gap-1.5">
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Click to upload a photo</span>
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                </label>
              )}
            </div>

            {/* Address */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Postcode</Label>
                <Input value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="1234 AB" />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Keizersgracht 123" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Amsterdam" />
            </div>

            {/* Key numbers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Monthly Rent (€)</Label>
                <Input type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} placeholder="850" />
              </div>
              <div className="space-y-2">
                <Label>Surface (m²)</Label>
                <Input type="number" value={surfaceM2} onChange={e => setSurfaceM2(e.target.value)} placeholder="65" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Rooms</Label>
                <Input type="number" value={numRooms} onChange={e => setNumRooms(e.target.value)} placeholder="3" />
              </div>
              <div className="space-y-2">
                <Label>Available date</Label>
                <Input type="date" value={availableDate} onChange={e => setAvailableDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={accommodationType} onValueChange={setAccommodationType}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
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
                    <SelectItem value="Gestoffeerd (semi)">Semi-furnished</SelectItem>
                    <SelectItem value="Unfurnished">Unfurnished</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleSave}
              disabled={loading || photoUploading || !address.trim()}
            >
              {loading || photoUploading ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{photoUploading ? 'Uploading photo…' : 'Saving…'}</>
              ) : 'Add Property'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
