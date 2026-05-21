import { motion } from 'framer-motion';
import { X, Check, Copy, MessageCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';
import { Applicant, scoreColor, locValue, resolveField } from './TenantCard';

interface Property {
  id: string;
  address: string;
  rent_amount?: number | null;
}

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  return (
    <div style={{ height: 5, borderRadius: 999, background: 'hsl(27 30% 96%)', overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ height: '100%', borderRadius: 999, background: color }}
      />
    </div>
  );
}

function DetailCard({ label, rows }: { label: string; rows: [string, string | null | undefined][] }) {
  return (
    <div className="rounded-[14px] p-[14px] mb-3" style={{ background: 'hsl(27 100% 97%)', border: '1px solid hsl(27 30% 90%)', boxShadow: '0 1px 3px rgba(26,20,16,0.04)' }}>
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-[10px]">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        {rows.map(([k, v]) => (
          <div key={k}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{k}</p>
            <p className="text-[13px] font-semibold text-foreground mt-0.5">{v || '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function waLink(phone: string): string {
  const digits = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  return `https://wa.me/${digits}`;
}

export default function TenantSheet({ applicant, property, onClose, onStageChange }: {
  applicant: Applicant;
  property: Property | undefined;
  onClose: () => void;
  onStageChange: (id: string, stage: string) => void;
}) {
  const { t } = useLanguage();
  const score = applicant.match_score ?? 0;
  const disq = !!applicant.hard_disqualified;
  const color = scoreColor(score, disq);
  const isAccepted = applicant.stage === 'accepted' || applicant.stage === 'contacted';
  const isRejected = applicant.stage === 'rejected';

  const matchLabel = disq ? t('tenants.disqualified')
    : score >= 8.5 ? t('tenants.strong_match')
    : score >= 6.5 ? t('tenants.good_match')
    : score >= 4.5 ? t('tenants.moderate_match')
    : t('tenants.weak_match');

  const prefScore = !disq ? Math.min(4, (score / 10) * 5) : 0;
  const finScore = !disq ? Math.min(4, (score / 10) * 4.5) : 0;
  const bgScore = !disq ? Math.min(2, (score / 10) * 2.5) : 0;

  const scrape = applicant.social_scrape_data;
  const hasScrape = scrape && typeof scrape === 'object' && Object.keys(scrape).length > 0;

  async function handleAccept() {
    const { error } = await supabase.from('applicants').update({ stage: 'accepted' }).eq('id', applicant.id);
    if (!error) { onStageChange(applicant.id, 'accepted'); toast.success(t('tenants.accepted_toast')); }
  }

  async function handleReject() {
    const { error } = await supabase.from('applicants').update({ stage: 'rejected' }).eq('id', applicant.id);
    if (!error) { onStageChange(applicant.id, 'rejected'); onClose(); toast.success(t('tenants.rejected_toast')); }
  }

  function copyPhone() {
    if (applicant.phone) {
      navigator.clipboard.writeText(applicant.phone).catch(() => {});
      toast.success(t('tenants.phone_copied'));
    }
  }

  function openWhatsApp() {
    if (applicant.phone) window.open(waLink(applicant.phone), '_blank', 'noopener');
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-background flex flex-col"
        style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' }}
      >
        {/* Grab handle */}
        <div className="flex justify-center pt-2.5 pb-1.5">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>
        <button
          onClick={onClose}
          className="absolute top-3 right-3.5 w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: 'calc(92vh - 40px)' }}>
          {/* Header */}
          <div className="flex items-start justify-between mb-[18px] mt-1">
            <div className="min-w-0 pr-3">
              <h2
                className="font-serif font-normal text-foreground leading-tight"
                style={{ fontSize: 22, letterSpacing: '-0.015em' }}
              >
                {applicant.full_name ?? '—'}
              </h2>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">{property?.address}</p>
            </div>
            <div className="text-right shrink-0">
              <p
                className="font-bold leading-none"
                style={{ fontSize: 32, color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}
              >
                {disq ? '—' : score.toFixed(1)}
              </p>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">{matchLabel}</p>
            </div>
          </div>

          {/* WhatsApp card — only shown after Accept */}
          {isAccepted && applicant.phone && (
            <div
              className="rounded-[16px] p-[14px] mb-[14px]"
              style={{ background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.28)' }}
            >
              <div className="flex items-center gap-3 mb-2.5">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: '#25D366', boxShadow: '0 4px 12px rgba(37,211,102,0.35)' }}
                >
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase" style={{ color: '#1b6b3b', letterSpacing: '0.12em' }}>
                    {t('tenants.phone')}
                  </p>
                  <p className="text-[17px] font-semibold text-foreground mt-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {applicant.phone}
                  </p>
                </div>
              </div>
              <p className="text-[11.5px] mb-2.5" style={{ color: '#1b6b3b', opacity: 0.85, lineHeight: 1.4 }}>
                {t('tenants.whatsapp_hint')}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={copyPhone}
                  className="flex-1 h-[38px] rounded-[10px] flex items-center justify-center gap-1.5 text-[12.5px] font-semibold"
                  style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(37,211,102,0.35)', color: '#1b6b3b', cursor: 'pointer' }}
                >
                  <Copy className="w-3.5 h-3.5" />{t('tenants.copy_phone')}
                </button>
                <button
                  onClick={openWhatsApp}
                  className="flex-1 h-[38px] rounded-[10px] flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-white"
                  style={{ background: '#25D366', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,211,102,0.30)' }}
                >
                  <MessageCircle className="w-3.5 h-3.5" />{t('tenants.open_whatsapp')}
                </button>
              </div>
            </div>
          )}

          {/* Disqualify banner */}
          {disq && applicant.hard_disqualify_reason && (
            <div
              className="rounded-[12px] p-3 mb-[14px] flex items-start gap-2"
              style={{ background: 'hsl(0 60% 55% / 0.10)', border: '1px solid hsl(0 60% 55% / 0.22)' }}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-destructive">{applicant.hard_disqualify_reason}</p>
            </div>
          )}

          {/* Score breakdown bars */}
          {!disq && (
            <div className="rounded-[14px] p-[14px] mb-3" style={{ background: 'hsl(27 100% 97%)', border: '1px solid hsl(27 30% 90%)', boxShadow: '0 1px 3px rgba(26,20,16,0.04)' }}>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-2.5">{t('tenants.score')}</p>
              {[
                { label: t('tenants.cat_pref'), value: prefScore, max: 4 },
                { label: t('tenants.cat_fin'),  value: finScore,  max: 4 },
                { label: t('tenants.cat_bg'),   value: bgScore,   max: 2 },
              ].map(({ label, value, max }) => (
                <div key={label} className="mb-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-[11.5px] text-muted-foreground">{label}</span>
                    <span className="text-[11.5px] font-medium text-foreground">{value.toFixed(1)} / {max}</span>
                  </div>
                  <ScoreBar value={value} max={max} color={color} />
                </div>
              ))}
            </div>
          )}

          {/* Financial */}
          <DetailCard label={t('tenants.financial')} rows={[
            [t('tenants.income'),    resolveField(applicant, 'monthly_income_range')],
            [t('tenants.work'),      locValue(applicant.employment_type, t)],
            [t('tenants.bkr'),       locValue(applicant.bkr_status, t)],
            [t('tenants.age'),       applicant.age != null ? `${applicant.age} ${t('tenants.age_years')}` : null],
          ]} />

          {/* Living */}
          <DetailCard label={t('tenants.living')} rows={[
            [t('tenants.occupants'), locValue(applicant.num_occupants, t)],
            [t('tenants.movein'),    locValue(applicant.desired_move_in, t)],
            [t('tenants.smoking'),   locValue(resolveField(applicant, 'smoking'), t)],
            [t('tenants.pets'),      locValue(resolveField(applicant, 'pets'), t)],
          ]} />

          {/* Background check */}
          <div className="rounded-[14px] p-[14px] mb-6" style={{ background: 'hsl(27 100% 97%)', border: '1px solid hsl(27 30% 90%)', boxShadow: '0 1px 3px rgba(26,20,16,0.04)' }}>
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-2">{t('tenants.background')}</p>
            {hasScrape && typeof scrape.summary === 'string' ? (
              <p className="text-[12.5px] text-foreground">{scrape.summary}</p>
            ) : (
              <p className="text-[12.5px] text-muted-foreground italic">{t('tenants.background_pending')}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2.5">
            {!isAccepted && (
              <button
                onClick={handleAccept}
                className="w-full h-12 rounded-[14px] flex items-center justify-center gap-2 text-[14.5px] font-semibold text-white"
                style={{ background: '#C84B2F', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(200,75,47,0.28)' }}
              >
                <Check className="w-[18px] h-[18px]" strokeWidth={2.5} />{t('tenants.accept')}
              </button>
            )}
            {!isRejected && (
              <button
                onClick={handleReject}
                className="w-full h-11 rounded-[14px] text-[13px] font-medium text-destructive"
                style={{ background: 'hsl(0 60% 55% / 0.05)', border: '1px solid hsl(0 60% 55% / 0.30)', cursor: 'pointer' }}
              >
                {t('tenants.reject')}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
