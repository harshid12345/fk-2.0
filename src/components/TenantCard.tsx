import { User, X, Check, Copy, MessageCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/hooks/useLanguage';

export interface Applicant {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  age: number | null;
  employment_type: string | null;
  monthly_income_range: string | null;
  num_occupants: string | null;
  desired_move_in: string | null;
  smoking: string | null;
  pets: string | null;
  bkr_status: string | null;
  match_score: number | null;
  match_label: string | null;
  match_flags: string[] | null;
  hard_disqualified: boolean | null;
  hard_disqualify_reason: string | null;
  social_scrape_data: any;
  stage: string | null;
  property_id: string;
  lifestyle_answers: any;
}

export function scoreColor(score: number, disqualified: boolean): string {
  if (disqualified) return '#888888';
  if (score >= 8.5) return 'hsl(142, 52%, 40%)';
  if (score >= 6.5) return '#C84B2F';
  if (score >= 4.5) return 'hsl(38, 92%, 46%)';
  return '#888888';
}

export function locValue(val: string | null | undefined, t: (key: string) => string): string {
  if (!val) return '—';
  const key = 'v.' + val;
  const translated = t(key);
  return translated !== key ? translated : val;
}

function waLink(phone: string): string {
  const digits = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  return `https://wa.me/${digits}`;
}

export function TenantCard({ applicant, onOpen, onStageChange }: {
  applicant: Applicant;
  onOpen: () => void;
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

  async function handleAccept(e: React.MouseEvent) {
    e.stopPropagation();
    const { error } = await supabase.from('applicants').update({ stage: 'accepted' }).eq('id', applicant.id);
    if (!error) { onStageChange(applicant.id, 'accepted'); toast.success(t('tenants.accepted_toast')); }
  }

  async function handleReject(e: React.MouseEvent) {
    e.stopPropagation();
    const { error } = await supabase.from('applicants').update({ stage: 'rejected' }).eq('id', applicant.id);
    if (!error) { onStageChange(applicant.id, 'rejected'); toast.success(t('tenants.rejected_toast')); }
  }

  function copyPhone(e: React.MouseEvent) {
    e.stopPropagation();
    if (applicant.phone) {
      navigator.clipboard.writeText(applicant.phone).catch(() => {});
      toast.success(t('tenants.phone_copied'));
    }
  }

  function openWhatsApp(e: React.MouseEvent) {
    e.stopPropagation();
    if (applicant.phone) window.open(waLink(applicant.phone), '_blank', 'noopener');
  }

  return (
    <div className="rounded-[14px] p-[14px]" style={{ background: 'hsl(27 100% 97%)', border: '1px solid hsl(27 30% 90%)', boxShadow: '0 1px 3px rgba(26,20,16,0.04)' }}>
      {/* Body */}
      <button onClick={onOpen} className="w-full text-left flex items-center gap-3 font-[inherit]" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'hsl(20 90% 56% / 0.10)' }}>
          <User className="w-[18px] h-[18px] text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className="text-[13.5px] font-semibold text-foreground truncate">{applicant.full_name ?? '—'}</p>
            {isAccepted && <span className="text-[9px] font-bold px-[7px] py-[2px] rounded-full uppercase tracking-wide shrink-0" style={{ background: 'hsl(142 52% 38% / 0.12)', color: 'hsl(142, 52%, 32%)' }}>{t('tenants.accepted_badge')}</span>}
            {isRejected && <span className="text-[9px] font-bold px-[7px] py-[2px] rounded-full uppercase tracking-wide shrink-0" style={{ background: 'hsl(0 60% 55% / 0.10)', color: 'hsl(0 60% 55%)' }}>{t('tenants.f_rejected')}</span>}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{locValue(applicant.employment_type, t)} · {applicant.monthly_income_range ?? '—'}</p>
          <p className="text-[11px] text-muted-foreground truncate">{locValue(applicant.num_occupants, t)} · {locValue(applicant.desired_move_in, t)}</p>
          {disq && applicant.hard_disqualify_reason && (
            <p className="text-[10.5px] text-destructive truncate mt-0.5">⚠ {applicant.hard_disqualify_reason}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[24px] font-bold leading-none" style={{ color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{disq ? '—' : score.toFixed(1)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{matchLabel}</p>
        </div>
      </button>

      {/* Footer */}
      <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid hsl(27 30% 90%)' }}>
        {isAccepted ? (
          <div className="w-full flex items-center gap-2 px-3 py-2 rounded-[10px]" style={{ background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.28)' }}>
            <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0" style={{ background: '#25D366' }}>
              <MessageCircle className="w-[13px] h-[13px] text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9.5px] font-bold uppercase" style={{ color: '#1b6b3b', letterSpacing: '0.08em' }}>{t('tenants.phone')}</p>
              <p className="text-[13px] font-semibold text-foreground truncate">{applicant.phone}</p>
            </div>
            <button onClick={copyPhone} className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.7)', border: 'none', cursor: 'pointer' }}>
              <Copy className="w-[13px] h-[13px]" style={{ color: '#1b6b3b' }} />
            </button>
            <button onClick={openWhatsApp} className="h-[30px] px-[10px] rounded-[8px] flex items-center gap-1 shrink-0 text-[11px] font-semibold" style={{ background: '#25D366', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <MessageCircle className="w-[12px] h-[12px]" />{t('tenants.open_whatsapp')}
            </button>
          </div>
        ) : isRejected ? (
          <button onClick={handleAccept} className="w-full h-9 rounded-[10px] text-[12px] font-medium text-muted-foreground" style={{ background: 'transparent', border: '1px solid hsl(27 30% 90%)', cursor: 'pointer' }}>
            {t('tenants.accept')}
          </button>
        ) : (
          <>
            <button onClick={handleReject} className="flex-1 h-9 rounded-[10px] flex items-center justify-center gap-1 text-[12px] font-semibold" style={{ background: 'hsl(0 60% 55% / 0.05)', color: 'hsl(0 60% 55%)', border: '1px solid hsl(0 60% 55% / 0.25)', cursor: 'pointer' }}>
              <X className="w-3 h-3" strokeWidth={2.5} />{t('tenants.reject')}
            </button>
            <button onClick={handleAccept} className="flex-1 h-9 rounded-[10px] flex items-center justify-center gap-1 text-[12px] font-semibold text-white" style={{ background: '#C84B2F', border: 'none', boxShadow: '0 2px 6px rgba(200,75,47,0.25)', cursor: 'pointer' }}>
              <Check className="w-3 h-3" strokeWidth={2.5} />{t('tenants.accept')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
