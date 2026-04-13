import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import TopNav from '@/components/TopNav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, MapPin, Users } from 'lucide-react';
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
}

export default function PropertiesPage() {
  const { user } = useAuth();
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
    if (status === 'compliant') return <Badge className="bg-success/10 text-success border-success/20">Compliant</Badge>;
    if (status === 'at_risk') return <Badge className="bg-warning/10 text-warning border-warning/20">At Risk</Badge>;
    return <Badge className="bg-danger/10 text-danger border-danger/20">Over Limit</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Properties</h1>
            <p className="text-sm text-muted-foreground mt-1">{properties.length} properties</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Property
          </Button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <Card key={i} className="h-48 animate-pulse bg-card" />)}
          </div>
        ) : properties.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 bg-card border-dashed">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">No properties yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your first property to get started</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Property
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map(p => (
              <Link key={p.id} to={`/properties/${p.id}`}>
                <Card className="p-5 bg-card hover:bg-card/80 transition-colors cursor-pointer border border-border hover:border-primary/30">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm truncate max-w-[180px]">{p.address}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {p.city || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(p)}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Rent</p>
                      <p className="font-medium text-foreground">€{p.rent_amount?.toFixed(0) || '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Surface</p>
                      <p className="font-medium text-foreground">{p.surface_m2 || '—'} m²</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">WWS Points</p>
                      <p className="font-medium text-foreground">{p.wws_points || '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Tenant</p>
                      <p className="font-medium text-foreground truncate">{p.tenant_name || 'Vacant'}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
      <AddPropertyDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchProperties} />
    </div>
  );
}
