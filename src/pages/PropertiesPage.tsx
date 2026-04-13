import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, MapPin, Home, Users } from 'lucide-react';
import AddPropertyDialog from '@/components/AddPropertyDialog';
import { getComplianceStatus } from '@/lib/wws';

interface Property {
  id: string;
  address: string;
  city: string;
  rent_amount: number | null;
  surface_m2: number | null;
  wws_compliant: boolean | null;
  wws_max_rent: number | null;
  wws_points: number | null;
  tenant_name: string | null;
  accommodation_type: string | null;
  status: string;
}

export default function PropertiesPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchProperties = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('landlord_properties')
      .select('*')
      .order('created_at', { ascending: false });
    setProperties((data as Property[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchProperties(); }, [user]);

  const getStatusBadge = (p: Property) => {
    if (!p.rent_amount || !p.wws_max_rent) return null;
    const status = getComplianceStatus(p.rent_amount, p.wws_max_rent);
    if (status === 'compliant') return <Badge className="bg-[hsl(142,71%,45%)]/10 text-[hsl(142,71%,45%)] border-[hsl(142,71%,45%)]/20 text-xs font-medium">{t('properties.compliant')}</Badge>;
    if (status === 'at_risk') return <Badge className="bg-[hsl(38,92%,50%)]/10 text-[hsl(38,92%,50%)] border-[hsl(38,92%,50%)]/20 text-xs font-medium">{t('properties.at_risk')}</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs font-medium">{t('properties.over_limit')}</Badge>;
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('properties.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{properties.length} {t('properties.count')}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="h-9 px-4 text-sm font-medium">
          <Plus className="w-4 h-4 mr-1.5" /> {t('properties.add')}
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-48 animate-pulse bg-card rounded-xl border border-border" />)}
        </div>
      ) : properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-border">
          <Building2 className="w-10 h-10 text-muted-foreground mb-3" />
          <h3 className="text-base font-medium text-foreground mb-1">{t('properties.empty_title')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t('properties.empty_desc')}</p>
          <Button onClick={() => setDialogOpen(true)} className="h-9 px-4 text-sm font-medium">
            <Plus className="w-4 h-4 mr-1.5" /> {t('properties.add')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map(p => (
            <Link key={p.id} to={`/properties/${p.id}`}>
              <div className="p-5 bg-card rounded-xl border border-border hover:border-primary/30 transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-[18px] h-[18px] text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{p.address}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {p.city || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                    {getStatusBadge(p)}
                    <Badge variant="outline" className="text-xs gap-1 font-normal">
                      {p.status === 'rented' ? <><Home className="w-3 h-3" /> {t('properties.rented')}</> : <><Users className="w-3 h-3" /> {t('properties.seeking')}</>}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">{t('properties.rent')}</p>
                    <p className="font-medium text-foreground mt-0.5">€{p.rent_amount?.toFixed(0) || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t('properties.surface')}</p>
                    <p className="font-medium text-foreground mt-0.5">{p.surface_m2 || '—'} m²</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{t('properties.wws_points')}</p>
                    <p className="font-medium text-foreground mt-0.5">{p.wws_points || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{p.status === 'rented' ? t('properties.tenant') : t('properties.status')}</p>
                    <p className="font-medium text-foreground truncate mt-0.5">{p.status === 'rented' ? (p.tenant_name || '—') : t('properties.accepting')}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <AddPropertyDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchProperties} />
    </div>
  );
}
