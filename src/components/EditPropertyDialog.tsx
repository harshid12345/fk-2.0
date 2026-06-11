import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ImageIcon, Plus, Trash2, MessageSquare } from 'lucide-react';

interface PropertyToEdit {
  id: string;
  address: string;
  city: string | null;
  postcode: string | null;
  rent_amount: number | null;
  surface_m2: number | null;
  num_rooms: number | null;
  building_year: number | null;
  energy_label: string | null;
  accommodation_type: string | null;
  furnished_status: string | null;
  available_date: string | null;
  min_lease_length: string | null;
  sector: string | null;
  status: string;
  photo_url: string | null;
}

interface Props {
  property: PropertyToEdit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface CustomQuestion {
  id: string;
  question_text: string;
  is_required: boolean;
  sort_order: number;
}

export default function EditPropertyDialog({ property, open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Fields
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [surfaceM2, setSurfaceM2] = useState('');
  const [numRooms, setNumRooms] = useState('');
  const [buildingYear, setBuildingYear] = useState('');
  const [energyLabel, setEnergyLabel] = useState('');
  const [accommodationType, setAccommodationType] = useState('');
  const [furnishedStatus, setFurnishedStatus] = useState('');
  const [availableDate, setAvailableDate] = useState('');
  const [minLeaseLength, setMinLeaseLength] = useState('');
  const [sector, setSector] = useState('');
  const [status, setStatus] = useState('seeking');

  // Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);

  // Custom questions
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Populate form when property changes
  useEffect(() => {
    if (!property) return;
    // Fetch custom questions
    supabase
      .from('property_custom_questions')
      .select('id, question_text, is_required, sort_order')
      .eq('property_id', property.id)
      .order('sort_order')
      .then(({ data }) => setCustomQuestions(data || []));
    setAddress(property.address ?? '');
    setCity(property.city ?? '');
    setPostcode(property.postcode ?? '');
    setRentAmount(property.rent_amount != null ? String(property.rent_amount) : '');
    setSurfaceM2(property.surface_m2 != null ? String(property.surface_m2) : '');
    setNumRooms(property.num_rooms != null ? String(property.num_rooms) : '');
    setBuildingYear(property.building_year != null ? String(property.building_year) : '');
    setEnergyLabel(property.energy_label ?? '');
    setAccommodationType(property.accommodation_type ?? '');
    setFurnishedStatus(property.furnished_status ?? '');
    setAvailableDate(property.available_date ?? '');
    setMinLeaseLength(property.min_lease_length ?? '');
    setSector(property.sector ?? '');
    setStatus(property.status ?? 'seeking');
    setExistingPhotoUrl(property.photo_url ?? null);
    setPhotoFile(null);
    setPhotoPreview(null);
  }, [property]);

  const addQuestion = async () => {
    if (!property || !newQuestion.trim()) return;
    setSavingQuestion(true);
    const { data, error } = await supabase
      .from('property_custom_questions')
      .insert({ property_id: property.id, question_text: newQuestion.trim(), is_required: true, sort_order: customQuestions.length })
      .select('id, question_text, is_required, sort_order')
      .single();
    if (data) setCustomQuestions(prev => [...prev, data]);
    if (error) toast({ title: 'Could not save question', variant: 'destructive' });
    setNewQuestion('');
    setSavingQuestion(false);
  };

  const deleteQuestion = async (id: string) => {
    await supabase.from('property_custom_questions').delete().eq('id', id);
    setCustomQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!property) return;
    setLoading(true);

    // Upload new photo if selected
    let photoUrl = existingPhotoUrl;
    if (photoFile) {
      setPhotoUploading(true);
      const ext = photoFile.name.split('.').pop() || 'jpg';
      const path = `${property.id}/${Date.now()}.${ext}`;
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

    const { error } = await supabase
      .from('landlord_properties')
      .update({
        address: address.trim(),
        city: city.trim() || null,
        postcode: postcode.trim() || null,
        rent_amount: parseFloat(rentAmount) || null,
        surface_m2: parseFloat(surfaceM2) || null,
        num_rooms: parseInt(numRooms) || null,
        building_year: parseInt(buildingYear) || null,
        energy_label: energyLabel || null,
        accommodation_type: accommodationType || null,
        furnished_status: furnishedStatus || null,
        available_date: availableDate || null,
        min_lease_length: minLeaseLength || null,
        sector: sector || null,
        status,
        photo_url: photoUrl,
      })
      .eq('id', property.id);

    setLoading(false);

    if (error) {
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Property updated' });
    onSaved();
    onOpenChange(false);
  };

  const currentPhoto = photoPreview ?? existingPhotoUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Property</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photo — ref-based for reliability */}
          <div className="space-y-2">
            <Label>Property photo</Label>
            <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
            {currentPhoto ? (
              <div className="relative rounded-xl overflow-hidden border border-border h-36">
                {photoUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
                <img src={currentPhoto} alt="Property" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="absolute bottom-2 right-2 bg-black/60 text-white rounded-lg px-2.5 py-1 text-xs hover:bg-black/80 transition-colors flex items-center gap-1"
                >
                  <ImageIcon className="w-3 h-3" /> Change photo
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center h-24 rounded-xl border-2 border-dashed border-border bg-accent/30 hover:bg-accent/50 transition-colors gap-1.5"
              >
                <ImageIcon className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Add a property photo</span>
              </button>
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
              <Label>Building Year</Label>
              <Input type="number" value={buildingYear} onChange={e => setBuildingYear(e.target.value)} placeholder="1990" />
            </div>
          </div>

          {/* Selects */}
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
              <Select value={accommodationType} onValueChange={setAccommodationType}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="independent">Independent</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seeking">Looking for tenant</SelectItem>
                  <SelectItem value="rented">Rented</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Available date</Label>
              <Input type="date" value={availableDate} onChange={e => setAvailableDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Min. lease</Label>
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

          {/* Custom Questions */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <Label className="text-sm font-semibold">Custom questions for applicants</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Every applicant — including returning users — must answer these before submitting.
            </p>

            {customQuestions.length > 0 && (
              <div className="space-y-2">
                {customQuestions.map(q => (
                  <div key={q.id} className="flex items-start gap-2 p-3 rounded-xl bg-accent/40 border border-border">
                    <p className="text-sm text-foreground flex-1 leading-snug">{q.question_text}</p>
                    <button
                      type="button"
                      onClick={() => deleteQuestion(q.id)}
                      className="shrink-0 w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={newQuestion}
                onChange={e => setNewQuestion(e.target.value)}
                placeholder='e.g. "No noise after 10 pm — do you agree?"'
                className="text-sm"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQuestion(); } }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addQuestion}
                disabled={savingQuestion || !newQuestion.trim()}
                className="shrink-0"
              >
                {savingQuestion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <Button className="w-full" onClick={handleSave} disabled={loading || photoUploading || !address.trim()}>
            {loading || photoUploading ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{photoUploading ? 'Uploading photo…' : 'Saving…'}</>
            ) : 'Save changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
