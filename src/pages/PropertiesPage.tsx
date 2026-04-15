import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Plus, Building2, MapPin, Home, Users, TrendingUp, ArrowUpRight } from 'lucide-react';
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
  const navigate = useNavigate();
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

  const totalRent = properties.reduce((sum, p) => sum + (p.rent_amount || 0), 0);
  const rentedCount = properties.filter(p => p.status === 'rented').length;

  const getComplianceBadge = (p: Property) => {
    if (!p.rent_amount || !p.wws_max_rent) return null;
    const status = getComplianceStatus(p.rent_amount, p.wws_max_rent);
    if (status === 'compliant') return <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium bg-success/15 text-success">{t('properties.compliant')}</span>;
    if (status === 'at_risk') return <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium bg-warning/15 text-warning">{t('properties.at_risk')}</span>;
    return <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-medium bg-destructive/15 text-destructive">{t('properties.over_limit')}</span>;
  };

  return (
    <div className="pb-24">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="px-5 pt-4 pb-2">
        <h1 className="text-2xl font-semibold text-foreground mb-1">{t('properties.title')}</h1>
        <p className="text-sm text-muted-foreground">{properties.length} {t('properties.count')}</p>
      </motion.div>

      {!loading && properties.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="px-5 pb-4 flex gap-3">
          <div className="flex-1 glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">{t('properties.rent')}</span>
            </div>
            <p className="text-lg font-semibold text-foreground">€{totalRent.toLocaleString()}</p>
          </div>
          <div className="flex-1 glass-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Active tenants</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{rentedCount} / {properties.length}</p>
          </div>
        </motion.div>
      )}

      <div className="px-5 space-y-3">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="shimmer rounded-2xl h-36" />))
        : properties.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-20 glass-card rounded-2xl">
            <Building2 className="w-10 h-10 text-muted-foreground mb-3" />
            <h3 className="text-base font-medium text-foreground mb-1">{t('properties.empty_title')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('properties.empty_desc')}</p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {properties.map((p, index) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, type: 'spring', damping: 25, stiffness: 250 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/properties/${p.id}`)}
                className="glass-card rounded-2xl p-5 cursor-pointer active:ring-1 active:ring-primary/30 transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm truncate">{p.address}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {p.city || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                </div>

                <div className="flex items-center gap-2 mb-3">
                  {getComplianceBadge(p)}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium ${
                    p.status === 'rented' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                  }`}>
                    {p.status === 'rented' ? <Home className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                    {p.status === 'rented' ? t('properties.rented') : t('properties.seeking')}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground">{t('properties.rent')}</p>
                    <p className="font-semibold text-foreground text-sm mt-0.5">€{p.rent_amount?.toFixed(0) || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">{t('properties.surface')}</p>
                    <p className="font-semibold text-foreground text-sm mt-0.5">{p.surface_m2 || '—'} m²</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">{p.status === 'rented' ? t('properties.tenant') : t('properties.wws_points')}</p>
                    <p className="font-semibold text-foreground text-sm truncate mt-0.5">
                      {p.status === 'rented' ? (p.tenant_name || '—') : (p.wws_points || '—')}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, type: 'spring', damping: 15, stiffness: 200 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setDialogOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center z-20"
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      <AddPropertyDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchProperties} />
    </div>
  );
}
