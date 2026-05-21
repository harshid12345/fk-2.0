import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Plus, MapPin, Users, TrendingUp, Link2 } from 'lucide-react';
import AddPropertyDialog from '@/components/AddPropertyDialog';
import PropertyApplicantsSheet from '@/components/PropertyApplicantsSheet';
import { toast as sonnerToast } from 'sonner';

interface Property {
  id: string;
  address: string;
  city: string;
  rent_amount: number | null;
  surface_m2: number | null;
  tenant_name: string | null;
  accommodation_type: string | null;
  status: string;
  bag_verified: boolean | null;
  application_token?: string | null;
}

interface ApplicantCounts {
  newCount: number;
  acceptedCount: number;
  rejectedCount: number;
}

function CountChip({ kind, label, count }: { kind: 'new' | 'accepted' | 'rejected'; label: string; count: number }) {
  const palettes = {
    new:      { bg: 'hsl(20 90% 56% / 0.10)', border: 'hsl(20 90% 56% / 0.22)', fg: '#C84B2F',         dot: '#C84B2F' },
    accepted: { bg: 'rgba(37,211,102,0.08)',   border: 'rgba(37,211,102,0.28)',   fg: '#1b6b3b',         dot: '#25D366' },
    rejected: { bg: 'hsl(0 60% 55% / 0.06)',  border: 'hsl(0 60% 55% / 0.22)',  fg: 'hsl(0 60% 55%)', dot: 'hsl(0 60% 55%)' },
  };
  const p = palettes[kind];
  const isZero = count === 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px 4px 4px', borderRadius: 999,
      fontSize: 11, fontWeight: 600,
      background: isZero ? 'hsl(27 30% 96%)' : p.bg,
      color: isZero ? 'hsl(24 10% 45%)' : p.fg,
      border: `1px solid ${isZero ? 'hsl(27 30% 90%)' : p.border}`,
      whiteSpace: 'nowrap',
      opacity: isZero ? 0.65 : 1,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: 20, height: 20, borderRadius: 999,
        background: isZero ? 'transparent' : p.dot,
        color: isZero ? 'hsl(24 10% 45%)' : '#fff',
        fontSize: 10.5, fontWeight: 700,
        padding: '0 5px',
        border: isZero ? '1px solid hsl(27 30% 90%)' : 'none',
        fontVariantNumeric: 'tabular-nums',
      }}>{count}</span>
      {label}
    </span>
  );
}

// Simple Dutch house outline for the empty state
function DutchHouseIllustration() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M36 10L10 32H62L36 10Z" stroke="hsl(11, 62%, 48%)" strokeWidth="2" strokeLinejoin="round" fill="hsl(11, 62%, 48%, 0.06)" />
      <rect x="46" y="16" width="5" height="10" stroke="hsl(11, 62%, 48%)" strokeWidth="2" fill="none" />
      <rect x="12" y="32" width="48" height="30" stroke="hsl(11, 62%, 48%)" strokeWidth="2" fill="none" />
      <rect x="30" y="44" width="12" height="18" rx="6" stroke="hsl(11, 62%, 48%)" strokeWidth="2" fill="none" />
      <rect x="16" y="37" width="10" height="9" rx="1" stroke="hsl(11, 62%, 48%)" strokeWidth="1.5" fill="none" />
      <rect x="46" y="37" width="10" height="9" rx="1" stroke="hsl(11, 62%, 48%)" strokeWidth="1.5" fill="none" />
      <line x1="21" y1="37" x2="21" y2="46" stroke="hsl(11, 62%, 48%)" strokeWidth="1" />
      <line x1="16" y1="41.5" x2="26" y2="41.5" stroke="hsl(11, 62%, 48%)" strokeWidth="1" />
      <line x1="51" y1="37" x2="51" y2="46" stroke="hsl(11, 62%, 48%)" strokeWidth="1" />
      <line x1="46" y1="41.5" x2="56" y2="41.5" stroke="hsl(11, 62%, 48%)" strokeWidth="1" />
    </svg>
  );
}

export default function PropertiesPage() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const locale = lang === 'nl' ? 'nl-NL' : 'en-GB';
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, ApplicantCounts>>({});
  const [openProperty, setOpenProperty] = useState<Property | null>(null);

  const fetchProperties = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('landlord_properties')
      .select('*')
      .order('created_at', { ascending: false });
    const fetched = (data as Property[]) || [];
    setProperties(fetched);
    setLoading(false);

    // Fetch applicant counts per property
    if (fetched.length > 0) {
      const ids = fetched.map(p => p.id);
      const { data: apps } = await supabase
        .from('applicants')
        .select('property_id, stage')
        .in('property_id', ids);
      const map: Record<string, ApplicantCounts> = {};
      for (const p of fetched) {
        const propApps = (apps || []).filter((a: any) => a.property_id === p.id);
        map[p.id] = {
          newCount:      propApps.filter((a: any) => a.stage !== 'accepted' && a.stage !== 'contacted' && a.stage !== 'rejected').length,
          acceptedCount: propApps.filter((a: any) => a.stage === 'accepted' || a.stage === 'contacted').length,
          rejectedCount: propApps.filter((a: any) => a.stage === 'rejected').length,
        };
      }
      setCounts(map);
    }
  }, [user]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const totalRent = properties.reduce((sum, p) => sum + (p.rent_amount || 0), 0);
  const rentedCount = properties.filter(p => p.status === 'rented').length;

  return (
    <div className="pb-36" style={{ minHeight: '100%', color: 'hsl(0 0% 10%)' }}>
      {/* Warm peach hero gradient */}
      <div style={{
        background: 'linear-gradient(180deg, hsl(20 65% 90%) 0%, hsl(27 75% 94%) 35%, hsl(27 60% 97%) 70%, hsl(0 0% 100%) 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Radial glow */}
        <div aria-hidden style={{
          position: 'absolute', top: -60, right: -40, width: 220, height: 220,
          background: 'radial-gradient(closest-side, hsl(20 90% 60% / 0.18), transparent 70%)',
          pointerEvents: 'none', filter: 'blur(4px)',
        }} />

        {/* Header */}
        <div className="px-5 pt-14 pb-4">
          <h1
            className="font-serif font-normal text-foreground leading-tight"
            style={{ fontSize: 32, letterSpacing: '-0.02em' }}
          >
            {t('properties.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {properties.length} {t('properties.count')}
          </p>
        </div>

        {/* Summary stats */}
        {!loading && properties.length > 0 && (
          <div className="px-5 pb-6 grid grid-cols-2 gap-3" style={{ position: 'relative' }}>
            <div style={{
              background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(8px)',
              border: '1px solid hsl(27 50% 85% / 0.6)', borderRadius: 14, padding: 14,
              boxShadow: '0 1px 2px rgba(26,20,16,0.03), 0 4px 12px rgba(200,75,47,0.04)',
            }}>
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{t('properties.rent')}</span>
              </div>
              <p className="text-[22px] font-semibold text-foreground leading-none m-0" style={{ letterSpacing: '-0.01em' }}>
                €{totalRent.toLocaleString(locale)}
              </p>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(8px)',
              border: '1px solid hsl(27 50% 85% / 0.6)', borderRadius: 14, padding: 14,
              boxShadow: '0 1px 2px rgba(26,20,16,0.03), 0 4px 12px rgba(200,75,47,0.04)',
            }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{t('properties.stat_tenants')}</span>
              </div>
              <p className="text-[22px] font-semibold text-foreground leading-none m-0">
                {rentedCount}<span className="text-sm font-normal text-muted-foreground"> / {properties.length}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Property list */}
      <div className="px-5 pt-5 flex flex-col gap-3">
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="shimmer rounded-[14px] h-[140px]" />)
        ) : properties.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[14px] py-14 px-6 text-center"
            style={{ background: 'hsl(27 100% 97%)', border: '1px solid hsl(27 30% 90%)' }}
          >
            <div className="flex justify-center mb-5"><DutchHouseIllustration /></div>
            <h3 className="text-base font-semibold text-foreground mb-1">{t('properties.empty_heading')}</h3>
            <p className="text-sm text-muted-foreground max-w-[220px] mx-auto">{t('properties.empty_hint')}</p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {properties.map((p, index) => {
              const pc = counts[p.id] ?? { newCount: 0, acceptedCount: 0, rejectedCount: 0 };
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, type: 'spring', damping: 28, stiffness: 260 }}
                >
                  <div
                    onClick={() => setOpenProperty(p)}
                    className="rounded-[14px] p-[18px] relative cursor-pointer"
                    style={{
                      background: 'hsl(27 100% 97%)',
                      border: '1px solid hsl(27 30% 90%)',
                      boxShadow: '0 1px 3px rgba(26,20,16,0.04)',
                      transition: 'transform 180ms cubic-bezier(.2,.8,.2,1), box-shadow 200ms ease, border-color 200ms ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 18px rgba(26,20,16,0.10)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'hsl(20 90% 56% / 0.30)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.transform = '';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(26,20,16,0.04)';
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'hsl(27 30% 90%)';
                    }}
                  >
                    {/* Copy apply link button */}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        const link = p.application_token
                          ? `${window.location.origin}/apply/${p.application_token}`
                          : '';
                        const msg = link
                          ? `Hoi! Ik verhuur ${p.address}. Aanmelden duurt 5 minuten:\n\n${link}`
                          : 'Geen aanmeldlink beschikbaar.';
                        navigator.clipboard.writeText(msg).catch(() => {});
                        sonnerToast.success(t('properties.link_copied'));
                      }}
                      className="absolute top-3.5 right-3.5 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                      aria-label="Copy apply link"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Address */}
                    <div className="mb-3 pr-10">
                      <h2 className="text-[15px] font-semibold text-foreground leading-snug" style={{ letterSpacing: '-0.01em' }}>
                        {p.address}
                      </h2>
                      <p className="text-[11.5px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {p.city || '—'}
                      </p>
                    </div>

                    {/* Count chips */}
                    <div className="flex items-center flex-wrap gap-1.5 mb-4">
                      <CountChip kind="new"      label={t('tenants.f_active')}   count={pc.newCount} />
                      <CountChip kind="accepted" label={t('tenants.f_accepted')} count={pc.acceptedCount} />
                      <CountChip kind="rejected" label={t('tenants.f_rejected')} count={pc.rejectedCount} />
                    </div>

                    {/* Key metrics */}
                    <div className="grid grid-cols-3 gap-0 divide-x divide-border" style={{ borderTop: '1px solid hsl(27 30% 90%)', paddingTop: 12 }}>
                      <div className="pr-3">
                        <p className="text-[9.5px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">{t('properties.rent')}</p>
                        <p className="text-[17px] font-semibold text-foreground leading-none">
                          €{p.rent_amount ? Math.round(p.rent_amount).toLocaleString(locale) : '—'}
                        </p>
                      </div>
                      <div className="px-3">
                        <p className="text-[9.5px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">{t('properties.surface')}</p>
                        <p className="text-[14px] font-semibold text-foreground leading-none">{p.surface_m2 || '—'} m²</p>
                      </div>
                      <div className="pl-3">
                        <p className="text-[9.5px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Type</p>
                        <p className="text-[14px] font-semibold text-foreground truncate leading-none">{p.accommodation_type || '—'}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* FAB */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.25, type: 'spring', damping: 16, stiffness: 220 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setDialogOpen(true)}
        className="fixed bottom-24 right-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center z-20"
        style={{ width: 52, height: 52, boxShadow: '0 4px 16px rgba(200,75,47,0.35)' }}
      >
        <Plus className="w-5 h-5" />
      </motion.button>

      <AddPropertyDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchProperties} />

      {/* Property applicants sheet */}
      <AnimatePresence>
        {openProperty && (
          <PropertyApplicantsSheet
            key={openProperty.id}
            property={openProperty}
            onClose={() => setOpenProperty(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
