import { useState, useEffect, useCallback } from 'react';
import { X, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import { toast } from 'sonner';
import { TenantCard, Applicant } from './TenantCard';
import TenantSheet from './TenantSheet';

interface Property {
  id: string;
  address: string;
  city?: string;
  rent_amount?: number | null;
}

export default function PropertyApplicantsSheet({ property, onClose }: {
  property: Property;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Applicant | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('applicants')
      .select('id, full_name, phone, email, age, employment_type, monthly_income_range, num_occupants, desired_move_in, smoking, pets, bkr_status, match_score, match_label, match_flags, hard_disqualified, hard_disqualify_reason, social_scrape_data, stage, property_id, lifestyle_answers')
      .eq('property_id', property.id)
      .order('match_score', { ascending: false, nullsFirst: false });
    setApplicants((data as Applicant[]) || []);
    setLoading(false);
  }, [property.id]);

  useEffect(() => { load(); }, [load]);

  function handleStageChange(id: string, stage: string) {
    setApplicants(prev => prev.map(a => a.id === id ? { ...a, stage } : a));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, stage } : null);
    if (stage === 'accepted') toast.success(t('tenants.accepted_toast'));
    if (stage === 'rejected') toast.success(t('tenants.rejected_toast'));
  }

  const sorted = [...applicants].sort((a, b) => {
    if (a.hard_disqualified && !b.hard_disqualified) return 1;
    if (!a.hard_disqualified && b.hard_disqualified) return -1;
    return (b.match_score ?? 0) - (a.match_score ?? 0);
  });

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(20,17,13,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed z-50 flex flex-col"
        style={{
          left: 16, right: 16,
          top: '50%',
          transform: 'translateY(-50%)',
          maxHeight: 'calc(100vh - 120px)',
          background: 'hsl(0 0% 100%)',
          borderRadius: 22,
          boxShadow: '0 24px 64px rgba(20,17,13,0.28), 0 8px 20px rgba(20,17,13,0.10)',
          overflow: 'hidden',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-[30px] h-[30px] rounded-full flex items-center justify-center z-10"
          style={{ background: 'hsl(27 30% 96%)', border: 'none', cursor: 'pointer' }}
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {/* Header */}
        <div className="px-[22px] pt-[22px] pb-[14px]" style={{ paddingRight: 56 }}>
          <p
            className="text-[10.5px] font-bold uppercase mb-1.5"
            style={{ color: '#C84B2F', letterSpacing: '0.12em' }}
          >
            {t('properties.applicants_for')}
          </p>
          <h2
            className="font-serif font-normal text-foreground leading-tight mb-1"
            style={{ fontSize: 24, letterSpacing: '-0.015em' }}
          >
            {property.address}
          </h2>
          <p className="text-[12px] text-muted-foreground">
            {property.city && `${property.city} · `}
            {sorted.length} {sorted.length === 1 ? t('tenants.candidate') : t('tenants.candidates')}
          </p>
        </div>

        {/* Applicants list */}
        <div className="overflow-y-auto px-5 pb-6 flex flex-col gap-2.5">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="shimmer rounded-[14px] h-[88px]" />
            ))
          ) : sorted.length === 0 ? (
            <div
              className="rounded-[14px] p-10 text-center"
              style={{ background: 'hsl(27 100% 97%)', border: '1px solid hsl(27 30% 90%)' }}
            >
              <div className="flex justify-center mb-2.5 opacity-40">
                <Users className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-[13px] text-muted-foreground">{t('properties.no_applicants_yet')}</p>
              <p className="text-[11.5px] text-muted-foreground mt-1">{t('properties.share_link_to_start')}</p>
            </div>
          ) : (
            sorted.map(a => (
              <TenantCard
                key={a.id}
                applicant={a}
                onOpen={() => setSelected(a)}
                onStageChange={handleStageChange}
              />
            ))
          )}
        </div>

        {/* Nested TenantSheet */}
        <AnimatePresence>
          {selected && (
            <TenantSheet
              key={selected.id}
              applicant={selected}
              property={property}
              onClose={() => setSelected(null)}
              onStageChange={handleStageChange}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
