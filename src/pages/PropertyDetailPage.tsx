import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import TopNav from '@/components/TopNav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, ShieldCheck, Copy, Trash2 } from 'lucide-react';
import { getComplianceStatus } from '@/lib/wws';

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [property, setProperty] = useState<any>(null);
  const [criteria, setCriteria] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Criteria form state
  const [prefGender, setPrefGender] = useState('');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [smokingAllowed, setSmokingAllowed] = useState(false);
  const [petsAllowed, setPetsAllowed] = useState(false);
  const [studentsOk, setStudentsOk] = useState(true);
  const [professionalsOk, setProfessionalsOk] = useState(true);
  const [minIncomeMultiplier, setMinIncomeMultiplier] = useState('3.0');
  const [notes, setNotes] = useState('');

  // Tenant form state
  const [tenantName, setTenantName] = useState('');
  const [tenantContractStart, setTenantContractStart] = useState('');
  const [tenantMonthlyRent, setTenantMonthlyRent] = useState('');
  const [tenantDeposit, setTenantDeposit] = useState('');

  useEffect(() => {
    fetchData();
  }, [id, user]);

  const fetchData = async () => {
    if (!id || !user) return;
    const { data: prop } = await supabase.from('landlord_properties').select('*').eq('id', id).single();
    if (prop) {
      setProperty(prop);
      setTenantName(prop.tenant_name || '');
      setTenantContractStart(prop.tenant_contract_start || '');
      setTenantMonthlyRent(prop.tenant_monthly_rent?.toString() || '');
      setTenantDeposit(prop.tenant_deposit?.toString() || '');
    }
    const { data: crit } = await supabase.from('landlord_criteria').select('*').eq('property_id', id).single();
    if (crit) {
      setCriteria(crit);
      setPrefGender(crit.preferred_gender || '');
      setMinAge(crit.min_age?.toString() || '');
      setMaxAge(crit.max_age?.toString() || '');
      setSmokingAllowed(crit.smoking_allowed || false);
      setPetsAllowed(crit.pets_allowed || false);
      setStudentsOk(crit.students_ok ?? true);
      setProfessionalsOk(crit.professionals_ok ?? true);
      setMinIncomeMultiplier(crit.min_income_multiplier?.toString() || '3.0');
      setNotes(crit.notes || '');
    }
    setLoading(false);
  };

  const saveCriteria = async () => {
    if (!id) return;
    const data = {
      property_id: id,
      preferred_gender: prefGender || null,
      min_age: parseInt(minAge) || null,
      max_age: parseInt(maxAge) || null,
      smoking_allowed: smokingAllowed,
      pets_allowed: petsAllowed,
      students_ok: studentsOk,
      professionals_ok: professionalsOk,
      min_income_multiplier: parseFloat(minIncomeMultiplier) || 3.0,
      notes: notes || null,
    };
    if (criteria) {
      await supabase.from('landlord_criteria').update(data).eq('id', criteria.id);
    } else {
      await supabase.from('landlord_criteria').insert(data);
    }
    toast({ title: 'Criteria saved' });
    fetchData();
  };

  const saveTenant = async () => {
    if (!id) return;
    await supabase.from('landlord_properties').update({
      tenant_name: tenantName || null,
      tenant_contract_start: tenantContractStart || null,
      tenant_monthly_rent: parseFloat(tenantMonthlyRent) || null,
      tenant_deposit: parseFloat(tenantDeposit) || null,
    }).eq('id', id);
    toast({ title: 'Tenant info saved' });
    fetchData();
  };

  const deleteProperty = async () => {
    if (!id) return;
    await supabase.from('landlord_properties').delete().eq('id', id);
    toast({ title: 'Property deleted' });
    navigate('/properties');
  };

  if (loading) return <div className="min-h-screen bg-background"><TopNav /><div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div></div>;
  if (!property) return <div className="min-h-screen bg-background"><TopNav /><div className="flex items-center justify-center py-20 text-muted-foreground">Property not found</div></div>;

  const complianceStatus = property.rent_amount && property.wws_max_rent
    ? getComplianceStatus(property.rent_amount, property.wws_max_rent) : null;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => navigate('/properties')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Properties
        </button>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">{property.address}</h1>
              <p className="text-sm text-muted-foreground">{property.city}</p>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={deleteProperty}>
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="criteria">Criteria</TabsTrigger>
            <TabsTrigger value="applicants">Applicants</TabsTrigger>
            <TabsTrigger value="tenant">Current Tenant</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5 bg-card space-y-4">
                <h3 className="font-medium text-foreground">Property Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">Address</p><p className="text-foreground">{property.address}</p></div>
                  <div><p className="text-muted-foreground text-xs">Postcode</p><p className="text-foreground">{property.postcode || '—'}</p></div>
                  <div><p className="text-muted-foreground text-xs">City</p><p className="text-foreground">{property.city || '—'}</p></div>
                  <div><p className="text-muted-foreground text-xs">Surface</p><p className="text-foreground">{property.surface_m2 || '—'} m²</p></div>
                  <div><p className="text-muted-foreground text-xs">Building Year</p><p className="text-foreground">{property.building_year || '—'}</p></div>
                  <div><p className="text-muted-foreground text-xs">Energy Label</p><p className="text-foreground">{property.energy_label || '—'}</p></div>
                  <div><p className="text-muted-foreground text-xs">Type</p><p className="text-foreground capitalize">{property.accommodation_type || '—'}</p></div>
                  <div><p className="text-muted-foreground text-xs">BAG Verified</p>
                    {property.bag_verified ? <Badge className="bg-success/10 text-success border-success/20"><ShieldCheck className="w-3 h-3 mr-1" />Verified</Badge> : <span className="text-muted-foreground">No</span>}
                  </div>
                </div>
              </Card>
              <Card className="p-5 bg-card space-y-4">
                <h3 className="font-medium text-foreground">WWS Assessment</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">Current Rent</p><p className="text-foreground text-lg font-semibold">€{property.rent_amount?.toFixed(2) || '—'}</p></div>
                  <div><p className="text-muted-foreground text-xs">Max Allowed Rent</p><p className="text-foreground text-lg font-semibold">€{property.wws_max_rent?.toFixed(2) || '—'}</p></div>
                  <div><p className="text-muted-foreground text-xs">WWS Points</p><p className="text-foreground">{property.wws_points || '—'}</p></div>
                  <div>
                    <p className="text-muted-foreground text-xs">Compliance</p>
                    {complianceStatus === 'compliant' && <Badge className="bg-success/10 text-success border-success/20">Compliant</Badge>}
                    {complianceStatus === 'at_risk' && <Badge className="bg-warning/10 text-warning border-warning/20">At Risk</Badge>}
                    {complianceStatus === 'over_limit' && <Badge className="bg-danger/10 text-danger border-danger/20">Over Limit</Badge>}
                    {!complianceStatus && <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="criteria">
            <Card className="p-5 bg-card space-y-4">
              <h3 className="font-medium text-foreground">Tenant Criteria</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preferred Gender</Label>
                  <Select value={prefGender} onValueChange={setPrefGender}>
                    <SelectTrigger><SelectValue placeholder="No preference" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">No preference</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Min Income Multiplier</Label>
                  <Input type="number" step="0.5" value={minIncomeMultiplier} onChange={e => setMinIncomeMultiplier(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Min Age</Label>
                  <Input type="number" value={minAge} onChange={e => setMinAge(e.target.value)} placeholder="18" />
                </div>
                <div className="space-y-2">
                  <Label>Max Age</Label>
                  <Input type="number" value={maxAge} onChange={e => setMaxAge(e.target.value)} placeholder="65" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between"><Label>Smoking Allowed</Label><Switch checked={smokingAllowed} onCheckedChange={setSmokingAllowed} /></div>
                <div className="flex items-center justify-between"><Label>Pets Allowed</Label><Switch checked={petsAllowed} onCheckedChange={setPetsAllowed} /></div>
                <div className="flex items-center justify-between"><Label>Students OK</Label><Switch checked={studentsOk} onCheckedChange={setStudentsOk} /></div>
                <div className="flex items-center justify-between"><Label>Professionals OK</Label><Switch checked={professionalsOk} onCheckedChange={setProfessionalsOk} /></div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional preferences..." rows={3} />
              </div>
              <Button onClick={saveCriteria}>Save Criteria</Button>
            </Card>
          </TabsContent>

          <TabsContent value="applicants">
            <Card className="p-8 bg-card flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Copy className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-medium text-foreground mb-1">No applicants yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Share your screening bot link to start receiving applicants
              </p>
              <Button variant="outline" onClick={() => {
                navigator.clipboard.writeText('https://t.me/FairKamerBot?start=' + id);
                toast({ title: 'Link copied!' });
              }}>
                <Copy className="w-4 h-4 mr-2" /> Copy Telegram Bot Link
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="tenant">
            <Card className="p-5 bg-card space-y-4">
              <h3 className="font-medium text-foreground">Current Tenant</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tenant Name</Label>
                  <Input value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="Full name" />
                </div>
                <div className="space-y-2">
                  <Label>Contract Start</Label>
                  <Input type="date" value={tenantContractStart} onChange={e => setTenantContractStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Rent (€)</Label>
                  <Input type="number" value={tenantMonthlyRent} onChange={e => setTenantMonthlyRent(e.target.value)} placeholder="850" />
                </div>
                <div className="space-y-2">
                  <Label>Deposit (€)</Label>
                  <Input type="number" value={tenantDeposit} onChange={e => setTenantDeposit(e.target.value)} placeholder="1700" />
                </div>
              </div>
              <Button onClick={saveTenant}>Save Tenant Info</Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
