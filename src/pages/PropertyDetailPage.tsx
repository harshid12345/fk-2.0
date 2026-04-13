import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import TopNav from '@/components/TopNav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, ShieldCheck, Copy, Trash2, Home, Users, Calendar } from 'lucide-react';
import { getComplianceStatus } from '@/lib/wws';

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Tenant form
  const [tenantName, setTenantName] = useState('');
  const [tenantContractStart, setTenantContractStart] = useState('');
  const [tenantMonthlyRent, setTenantMonthlyRent] = useState('');
  const [tenantDeposit, setTenantDeposit] = useState('');

  // Applicants
  const [applicants, setApplicants] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, [id, user]);

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
    const { data: apps } = await supabase.from('applicants').select('*').eq('property_id', id).order('created_at', { ascending: false });
    setApplicants(apps || []);
    setLoading(false);
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

  const isRented = property.status === 'rented';

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
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-muted-foreground">{property.city}</p>
                <Badge variant="outline" className="text-[10px] gap-1">
                  {isRented ? <><Home className="w-3 h-3" /> Rented</> : <><Users className="w-3 h-3" /> Seeking</>}
                </Badge>
              </div>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={deleteProperty}>
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </Button>
        </div>

        <div className="space-y-4">
          {/* Property Details + WWS */}
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

          {/* Conditional section based on status */}
          {isRented ? (
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
          ) : (
            <Card className="p-5 bg-card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">Applicants</h3>
                <Button variant="outline" size="sm" onClick={() => {
                  navigator.clipboard.writeText('https://t.me/FairKamerBot?start=' + id);
                  toast({ title: 'Link copied!' });
                }}>
                  <Copy className="w-4 h-4 mr-2" /> Copy Bot Link
                </Button>
              </div>

              {applicants.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No applicants yet. Share the screening bot link to start receiving applicants.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {applicants.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground">{a.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.occupation || '—'} · €{a.monthly_income || '—'}/mo
                          {a.match_score != null && ` · Score: ${a.match_score}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.viewing_booked_at && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(a.viewing_booked_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] capitalize">{a.stage}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
