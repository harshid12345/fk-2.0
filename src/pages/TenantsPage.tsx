import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { ChevronDown } from 'lucide-react';
import { TenantCard, Applicant } from '@/components/TenantCard';
import TenantSheet from '@/components/TenantSheet';

interface Property {
  id: string;
  address: string;
  rent_amount: number | null;
}

type StatusFilter = 'active' | 'accepted' | 'rejected' | 'all';

export default function TenantsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [selected, setSelected] = useState<Applicant | null>(null);

  const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'active',   label: t('tenants.f_active') },
    { key: 'accepted', label: t('tenants.f_accepted') },
    { key: 'rejected', label: t('tenants.f_rejected') },
    { key: 'all',      label: t('tenants.f_all') },
  ];

  const load = useCallback(async () => {
    if (!user) return;
    const { data: props } = await supabase
      .from('landlord_properties')
      .select('id, address, rent_amount')
      .eq('landlord_id', user.id);
    const propList = (props as Property[]) || [];
    setProperties(propList);
    if (propList.length > 0) {
      const ids = propList.map(p => p.id);
      const { data: apps } = await supabase
        .from('applicants')
        .select('id, full_name, phone, email, age, employment_type, monthly_income_range, num_occupants, desired_move_in, smoking, pets, bkr_status, match_score, match_label, match_flags, hard_disqualified, hard_disqualify_reason, social_scrape_data, stage, property_id, lifestyle_answers')
        .in('property_id', ids)
        .order('match_score', { ascending: false, nullsFirst: false });
      setApplicants((apps as Applicant[]) || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function handleStageChange(id: string, stage: string) {
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, stage } : a));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, stage } : null);
  }

  const propertyMap = Object.fromEntries(properties.map(p => [p.id, p]));

  const filtered = applicants.filter(a => {
    if (selectedProperty !== 'all' && a.property_id !== selectedProperty) return false;
    if (statusFilter === 'active')   return a.stage !== 'rejected' && a.stage !== 'accepted' && a.stage !== 'contacted';
    if (statusFilter === 'accepted') return a.stage === 'accepted' || a.stage === 'contacted';
    if (statusFilter === 'rejected') return a.stage === 'rejected';
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.hard_disqualified && !b.hard_disqualified) return 1;
    if (!a.hard_disqualified && b.hard_disqualified) return -1;
    return (b.match_score ?? 0) - (a.match_score ?? 0);
  });

  if (loading) return (
    <div className="pb-36">
      <div className="px-5 pt-5 pb-3">
        <div className="shimmer h-8 w-40 rounded-lg mb-1" />
        <div className="shimmer h-4 w-24 rounded" />
      </div>
      <div className="px-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="shimmer h-24 rounded-[14px]" />)}</div>
    </div>
  );

  return (
    <div className="pb-36" style={{ minHeight: '100%', color: 'hsl(0 0% 10%)' }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h1
          className="font-serif font-normal text-foreground leading-tight"
          style={{ fontSize: 32, letterSpacing: '-0.02em' }}
        >
          {t('tenants.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {sorted.length} {sorted.length === 1 ? t('tenants.candidate') : t('tenants.candidates')}
        </p>
      </div>

      {/* Filter chips */}
      <div className="px-5 pb-4 flex gap-2 overflow-x-auto items-center" style={{ scrollbarWidth: 'none' }}>
        {properties.length > 1 && (
          <div className="relative shrink-0">
            <select
              value={selectedProperty}
              onChange={e => setSelectedProperty(e.target.value)}
              className="appearance-none pl-3 pr-7 h-[30px] text-[11.5px] font-medium rounded-full border border-border bg-card text-foreground cursor-pointer"
              style={{ fontFamily: 'inherit' }}
            >
              <option value="all">{t('tenants.all_properties')}</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.address}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
          </div>
        )}
        {STATUS_FILTERS.map(({ key, label }) => {
          const active = key === statusFilter;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className="shrink-0 h-[30px] px-3.5 rounded-full text-[11.5px] font-medium transition-all"
              style={{
                border: `1px solid ${active ? '#C84B2F' : 'hsl(27 30% 90%)'}`,
                background: active ? '#C84B2F' : 'hsl(27 100% 97%)',
                color: active ? '#fff' : 'hsl(24 10% 45%)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Applicant list */}
      <div className="px-5 flex flex-col gap-2.5">
        {sorted.length === 0 ? (
          <div
            className="rounded-[14px] py-12 px-6 text-center"
            style={{ background: 'hsl(27 100% 97%)', border: '1px solid hsl(27 30% 90%)' }}
          >
            <p className="text-[13px] text-muted-foreground">{t('tenants.empty_heading')}</p>
            <p className="text-[11.5px] text-muted-foreground mt-1">{t('tenants.empty_hint')}</p>
          </div>
        ) : (
          <AnimatePresence>
            {sorted.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, type: 'spring', damping: 26, stiffness: 260 }}
              >
                <TenantCard
                  applicant={a}
                  onOpen={() => setSelected(a)}
                  onStageChange={handleStageChange}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Detail sheet */}
      <AnimatePresence>
        {selected && (
          <TenantSheet
            key={selected.id}
            applicant={selected}
            property={propertyMap[selected.property_id]}
            onClose={() => setSelected(null)}
            onStageChange={handleStageChange}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
