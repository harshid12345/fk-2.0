import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Building2, ShieldCheck, Copy, Trash2, Home, Users, Calendar } from 'lucide-react';
import { getComplianceStatus } from '@/lib/wws';

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [tenantName, setTenantName] = useState('');
  const [tenantContractStart, setTenantContractStart] = useState('');
  const [tenantMonthlyRent, setTenantMonthlyRent] = useState('');
  const [tenantDeposit, setTenantDeposit] = useState('');
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
    toast({ title: t('detail.tenant_saved') });
    fetchData();
  };

  const deleteProperty = async () => {
    if (!id) return;
    await supabase.from('landlord_properties').delete().eq('id', id);
    toast({ title: t('detail.deleted') });
    navigate('/properties');
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  if (!property) return <div className="flex items-center justify-center py-20 text-muted-foreground">Property not found</div>;

  const complianceStatus = property.rent_amount && property.wws_max_rent
    ? getComplianceStatus(property.rent_amount, property.wws_max_rent) : null;
  const isRented = property.status === 'rented';

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <button onClick={() => navigate('/properties')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t('detail.back')}
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{property.address}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm text-muted-foreground">{property.city}</p>
              <Badge variant="outline" className="text-xs gap-1 font-normal">
                {isRented ? <><Home className="w-3 h-3" /> {t('properties.rented')}</> : <><Users className="w-3 h-3" /> {t('properties.seeking')}</>}
              </Badge>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={deleteProperty} className="text-destructive hover:text-destructive hover:bg-destructive/10 border-border">
          <Trash2 className="w-4 h-4 mr-1.5" /> {t('detail.delete')}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-card rounded-xl border border-border space-y-4">
            <h3 className="font-medium text-foreground text-sm">{t('detail.property_details')}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">{t('detail.address')}</p><p className="text-foreground mt-0.5">{property.address}</p></div>
              <div><p className="text-muted-foreground text-xs">{t('detail.postcode')}</p><p className="text-foreground mt-0.5">{property.postcode || '—'}</p></div>
              <div><p className="text-muted-foreground text-xs">{t('detail.city')}</p><p className="text-foreground mt-0.5">{property.city || '—'}</p></div>
              <div><p className="text-muted-foreground text-xs">{t('detail.surface')}</p><p className="text-foreground mt-0.5">{property.surface_m2 || '—'} m²</p></div>
              <div><p className="text-muted-foreground text-xs">{t('detail.building_year')}</p><p className="text-foreground mt-0.5">{property.building_year || '—'}</p></div>
              <div><p className="text-muted-foreground text-xs">{t('detail.energy_label')}</p><p className="text-foreground mt-0.5">{property.energy_label || '—'}</p></div>
              <div><p className="text-muted-foreground text-xs">{t('detail.type')}</p><p className="text-foreground capitalize mt-0.5">{property.accommodation_type || '—'}</p></div>
              <div><p className="text-muted-foreground text-xs">{t('detail.bag_verified')}</p>
                {property.bag_verified ? <Badge className="bg-[hsl(142,71%,45%)]/10 text-[hsl(142,71%,45%)] border-[hsl(142,71%,45%)]/20 mt-0.5"><ShieldCheck className="w-3 h-3 mr-1" />{t('detail.verified')}</Badge> : <span className="text-muted-foreground mt-0.5 block">No</span>}
              </div>
            </div>
          </div>
          <div className="p-5 bg-card rounded-xl border border-border space-y-4">
            <h3 className="font-medium text-foreground text-sm">{t('detail.wws_assessment')}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">{t('detail.current_rent')}</p><p className="text-foreground text-lg font-semibold mt-0.5">€{property.rent_amount?.toFixed(2) || '—'}</p></div>
              <div><p className="text-muted-foreground text-xs">{t('detail.max_rent')}</p><p className="text-foreground text-lg font-semibold mt-0.5">€{property.wws_max_rent?.toFixed(2) || '—'}</p></div>
              <div><p className="text-muted-foreground text-xs">{t('properties.wws_points')}</p><p className="text-foreground mt-0.5">{property.wws_points || '—'}</p></div>
              <div>
                <p className="text-muted-foreground text-xs">{t('detail.compliance')}</p>
                <div className="mt-0.5">
                  {complianceStatus === 'compliant' && <Badge className="bg-[hsl(142,71%,45%)]/10 text-[hsl(142,71%,45%)] border-[hsl(142,71%,45%)]/20">{t('properties.compliant')}</Badge>}
                  {complianceStatus === 'at_risk' && <Badge className="bg-[hsl(38,92%,50%)]/10 text-[hsl(38,92%,50%)] border-[hsl(38,92%,50%)]/20">{t('properties.at_risk')}</Badge>}
                  {complianceStatus === 'over_limit' && <Badge className="bg-destructive/10 text-destructive border-destructive/20">{t('properties.over_limit')}</Badge>}
                  {!complianceStatus && <span className="text-muted-foreground">—</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {isRented ? (
          <div className="p-5 bg-card rounded-xl border border-border space-y-4">
            <h3 className="font-medium text-foreground text-sm">{t('detail.current_tenant')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('detail.tenant_name')}</Label>
                <Input value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('detail.contract_start')}</Label>
                <Input type="date" value={tenantContractStart} onChange={e => setTenantContractStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('detail.monthly_rent')} (€)</Label>
                <Input type="number" value={tenantMonthlyRent} onChange={e => setTenantMonthlyRent(e.target.value)} placeholder="850" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('detail.deposit')} (€)</Label>
                <Input type="number" value={tenantDeposit} onChange={e => setTenantDeposit(e.target.value)} placeholder="1700" />
              </div>
            </div>
            <Button onClick={saveTenant} className="h-9 px-4 text-sm font-medium">{t('detail.save_tenant')}</Button>
          </div>
        ) : (
          <div className="p-5 bg-card rounded-xl border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-foreground text-sm">{t('detail.applicants')}</h3>
              <Button variant="outline" size="sm" onClick={() => {
                navigator.clipboard.writeText('https://t.me/FairKamerBot?start=' + id);
                toast({ title: t('detail.link_copied') });
              }} className="h-8 text-xs">
                <Copy className="w-3.5 h-3.5 mr-1.5" /> {t('detail.copy_bot_link')}
              </Button>
            </div>

            {applicants.length === 0 ? (
              <div className="text-center py-10">
                <Users className="w-9 h-9 text-muted-foreground mx-auto mb-2.5" />
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">{t('detail.no_applicants')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {applicants.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">{a.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.occupation || '—'} · €{a.monthly_income || '—'}/mo
                        {a.match_score != null && ` · Score: ${a.match_score}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.viewing_booked_at && (
                        <Badge variant="outline" className="text-xs gap-1 font-normal">
                          <Calendar className="w-3 h-3" />
                          {new Date(a.viewing_booked_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs capitalize font-normal">{a.stage}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
