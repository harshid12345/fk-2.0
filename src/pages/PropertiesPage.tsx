import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Plus, MapPin, Home, Users, TrendingUp, Paperclip, AlertTriangle, BookOpen, Link2, ShieldCheck, User, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AddPropertyDialog from '@/components/AddPropertyDialog';
import PropertyKnowledgeBaseDialog from '@/components/PropertyKnowledgeBaseDialog';
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
  knowledge_base_urls: string[] | null;
  bag_verified: boolean | null;
}

const MOCK_PROPERTIES: Property[] = [
  {
    id: 'demo-hague-studio-01',
    address: 'Laan van Meerdervoort 57A',
    city: 'Den Haag',
    rent_amount: 895,
    surface_m2: 32,
    tenant_name: null,
    accommodation_type: 'independent',
    status: 'seeking',
    knowledge_base_urls: [],
    bag_verified: true,
  },
];

const MOCK_APPLICANTS = [
  { id: 'demo-app-01', property_id: 'demo-hague-studio-01', full_name: 'Sophie Vermeer', stage: 'screening_complete', match_score: 8.8, match_label: 'Strong match', hard_disqualified: false },
  { id: 'demo-app-02', property_id: 'demo-hague-studio-01', full_name: 'Julien Bakker', stage: 'screening_complete', match_score: 6.2, match_label: 'Good match', hard_disqualified: false },
  { id: 'demo-app-03', property_id: 'demo-hague-studio-01', full_name: 'Karim el-Amrani', stage: 'screening_complete', match_score: 2.9, match_label: 'Weak match', hard_disqualified: false },
];

function scoreColor(score: number, disqualified: boolean): string {
  if (disqualified) return 'hsl(var(--destructive))';
  if (score >= 8.5) return 'hsl(142, 52%, 40%)';
  if (score >= 6.5) return 'hsl(11, 62%, 48%)';
  if (score >= 4.5) return 'hsl(38, 92%, 46%)';
  return 'hsl(var(--muted-foreground))';
}

// Simple Dutch house outline for the empty state
function DutchHouseIllustration() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Roof */}
      <path
        d="M36 10L10 32H62L36 10Z"
        stroke="hsl(11, 62%, 48%)"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="hsl(11, 62%, 48%, 0.06)"
      />
      {/* Chimney */}
      <rect x="46" y="16" width="5" height="10" stroke="hsl(11, 62%, 48%)" strokeWidth="2" fill="none" />
      {/* Main body */}
      <rect x="12" y="32" width="48" height="30" stroke="hsl(11, 62%, 48%)" strokeWidth="2" fill="none" />
      {/* Door */}
      <rect x="30" y="44" width="12" height="18" rx="6" stroke="hsl(11, 62%, 48%)" strokeWidth="2" fill="none" />
      {/* Windows */}
      <rect x="16" y="37" width="10" height="9" rx="1" stroke="hsl(11, 62%, 48%)" strokeWidth="1.5" fill="none" />
      <rect x="46" y="37" width="10" height="9" rx="1" stroke="hsl(11, 62%, 48%)" strokeWidth="1.5" fill="none" />
      {/* Window cross */}
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
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [kbDialog, setKbDialog] = useState<{ id: string; address: string } | null>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(true);
  const [applicantActionLoading, setApplicantActionLoading] = useState<string | null>(null);

  const fetchProperties = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('landlord_properties')
      .select('*')
      .order('created_at', { ascending: false });
    const fetched = (data as Property[]) || [];
    setProperties(fetched.length === 0 ? MOCK_PROPERTIES : fetched);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const fetchApplicants = useCallback(async () => {
    if (!user) return;
    const { data: props } = await supabase.from('landlord_properties').select('id, address, rent_amount').eq('landlord_id', user.id);
    const realProps = props || [];
    const useMocks = realProps.length === 0;
    const propList = useMocks ? MOCK_PROPERTIES : realProps;

    let apps: any[] = [];
    if (!useMocks && propList.length > 0) {
      const ids = propList.map((p: any) => p.id);
      const { data: fetchedApps } = await supabase.from('applicants').select('*').in('property_id', ids).neq('stage', 'rejected').order('created_at', { ascending: false });
      apps = fetchedApps || [];
    } else {
      apps = MOCK_APPLICANTS;
    }

    const enriched = apps.map(a => {
      const prop = propList.find((p: any) => p.id === a.property_id);
      const raw = a.match_score ?? 0;
      const score = raw <= 10 ? raw : raw / 10;
      return { ...a, propertyAddress: prop?.address || '—', score };
    });

    setApplicants(enriched);
    setApplicantsLoading(false);
  }, [user]);

  useEffect(() => { fetchApplicants(); }, [fetchApplicants]);

  const handleApproveApplicant = async (applicant: any) => {
    setApplicantActionLoading(applicant.id);
    try {
      await supabase.functions.invoke('whatsapp-notify-tenant', { body: { applicantId: applicant.id, action: 'approve' } });
      sonnerToast.success(t('applicants.approved_name', { name: applicant.full_name || t('applicants.unknown') }));
    } catch {
      sonnerToast.error(t('applicants.error_approve'));
    }
    setApplicantActionLoading(null);
    fetchApplicants();
  };

  const handleRejectApplicant = async (applicant: any) => {
    setApplicantActionLoading(applicant.id);
    try {
      await supabase.functions.invoke('whatsapp-notify-tenant', { body: { applicantId: applicant.id, action: 'reject' } });
      sonnerToast.success(t('applicants.rejected_name', { name: applicant.full_name || t('applicants.unknown') }));
    } catch {
      sonnerToast.error(t('applicants.error_reject'));
    }
    setApplicantActionLoading(null);
    fetchApplicants();
  };

  const totalRent = properties.reduce((sum, p) => sum + (p.rent_amount || 0), 0);
  const rentedCount = properties.filter(p => p.status === 'rented').length;
  const pendingKb = properties.filter(p => !p.knowledge_base_urls || p.knowledge_base_urls.length === 0);

  return (
    <div className="pb-24">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 pt-5 pb-3"
      >
        <h1 className="text-3xl font-serif text-foreground leading-tight">
          {t('properties.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {properties.length} {t('properties.count')}
        </p>
      </motion.div>

      {/* Summary stats */}
      {!loading && properties.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="px-5 pb-4 grid grid-cols-2 gap-3"
        >
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
                {t('properties.rent')}
              </span>
            </div>
            <p className="text-xl font-semibold text-foreground leading-none">
              €{totalRent.toLocaleString(locale)}
            </p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
                {t('properties.stat_tenants')}
              </span>
            </div>
            <p className="text-xl font-semibold text-foreground leading-none">
              {rentedCount}
              <span className="text-sm font-normal text-muted-foreground"> / {properties.length}</span>
            </p>
          </div>
        </motion.div>
      )}

      {/* Pending tasks — missing house manuals */}
      {!loading && pendingKb.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="px-5 pb-4"
        >
          <div className="rounded-xl border border-warning/25 bg-warning/5 p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-warning" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                {t('properties.pending_tasks')}
              </p>
            </div>
            {pendingKb.map(p => (
              <button
                key={p.id}
                onClick={() => setKbDialog({ id: p.id, address: p.address })}
                className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg bg-background/60 hover:bg-background transition-colors border border-border"
              >
                <BookOpen className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {p.address} {t('properties.kb_missing_text')}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t('properties.kb_upload_hint')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Property list — 1 col on mobile, 2 col on desktop */}
      <div className="px-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="shimmer rounded-xl h-[130px]" />
          ))
        ) : properties.length === 0 ? (
          /* Dutch empty state — spans both columns */
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-xl py-14 px-6 empty-state md:col-span-2"
          >
            <DutchHouseIllustration />
            <h3 className="text-base font-semibold text-foreground mt-5 mb-1">
              {t('properties.empty_heading')}
            </h3>
            <p className="text-sm text-muted-foreground max-w-[220px]">
              {t('properties.empty_hint')}
            </p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {properties.map((p, index) => {
              const kbCount = p.knowledge_base_urls?.length || 0;
              const kbMissing = kbCount === 0;
              const bagOk = !!p.bag_verified;
              const isRented = p.status === 'rented';

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, type: 'spring', damping: 28, stiffness: 260 }}
                  whileTap={{ scale: 0.985 }}
                  className={`property-card rounded-xl overflow-hidden relative ${
                    isRented ? 'property-card--rented' : 'property-card--seeking'
                  }`}
                >
                  {/* Clickable card body */}
                  <div
                    onClick={() => navigate(`/properties/${p.id}`)}
                    className="cursor-pointer p-5"
                  >
                    {/* Address + city */}
                    <div className="mb-3 pr-16">
                      <h2 className="text-base font-semibold text-foreground leading-snug">
                        {p.address}
                      </h2>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {p.city || t('issues.unknown_property')}
                      </p>
                    </div>

                    {/* Badges row */}
                    <div className="flex items-center flex-wrap gap-1.5 mb-4">
                      <span className={`status-pill ${isRented ? 'status-pill--rented' : 'status-pill--seeking'}`}>
                        {isRented ? <Home className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                        {isRented ? t('properties.rented') : t('properties.seeking')}
                      </span>
                      {bagOk && (
                        <span className="status-pill" style={{ background: 'hsl(142 52% 38% / 0.10)', color: 'hsl(142, 52%, 38%)' }}>
                          <ShieldCheck className="w-3 h-3" />
                          BAG
                        </span>
                      )}
                      {kbMissing && (
                        <span className="status-pill status-pill--warning">
                          <AlertTriangle className="w-3 h-3" />
                          {t('properties.no_manual_badge')}
                        </span>
                      )}
                      {kbCount > 0 && (
                        <span className="status-pill" style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                          <BookOpen className="w-3 h-3" />
                          {kbCount} doc{kbCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>

                    {/* Key metrics */}
                    <div className="grid grid-cols-3 gap-0 divide-x divide-border">
                      <div className="pr-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                          {t('properties.rent')}
                        </p>
                        <p className="text-lg font-semibold text-foreground leading-none">
                          €{p.rent_amount ? Math.round(p.rent_amount).toLocaleString(locale) : '—'}
                        </p>
                      </div>
                      <div className="px-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                          {t('properties.surface')}
                        </p>
                        <p className="text-base font-semibold text-foreground leading-none">
                          {p.surface_m2 || '—'} m²
                        </p>
                      </div>
                      <div className="pl-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                          {isRented ? t('properties.tenant') : 'Type'}
                        </p>
                        <p className="text-base font-semibold text-foreground truncate leading-none">
                          {isRented ? (p.tenant_name || '—') : (p.accommodation_type || '—')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Top-right action icons */}
                  <div className="absolute top-4 right-4 flex items-center gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const waNum = import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER || '3197010227583';
                        const link = `https://wa.me/${waNum}?text=start%20${p.id}`;
                        if (isRented) {
                          const tenantFirst = (p.tenant_name || 'there').split(' ')[0];
                          const msg = `Hey ${tenantFirst}! Je AI-assistent voor ${p.address} staat klaar voor al je vragen over wifi, verwarming, huisregels en het contract.\n\nStart hier:\n${link}`;
                          navigator.clipboard.writeText(msg);
                          sonnerToast.success(t('properties.copied_concierge'));
                        } else {
                          const msg = `Hoi! Ik gebruik FairKamer om kandidaten te screenen voor ${p.address}.\n\nHet duurt ongeveer 5 minuten. Klik op de link om te beginnen:\n\n${link}`;
                          navigator.clipboard.writeText(msg);
                          sonnerToast.success(t('properties.copied_screening'));
                        }
                      }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors"
                      aria-label={isRented ? 'Kopieer concierge link' : 'Kopieer screening link'}
                      title={isRented ? 'Concierge link kopiëren' : 'Screening link kopiëren'}
                    >
                      <Link2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setKbDialog({ id: p.id, address: p.address }); }}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors"
                      aria-label="Documenten uploaden"
                      title="Documenten uploaden"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Applicants section */}
      <div className="px-5 mt-6 mb-4">
        <h2 className="text-base font-semibold text-foreground mb-3">{t('properties.applicants_section')}</h2>
        {applicantsLoading ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="shimmer rounded-xl h-[100px]" />
            ))}
          </div>
        ) : applicants.length === 0 ? (
          <div className="glass-card rounded-xl py-10 px-6 text-center">
            <Users className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t('properties.no_applicants_short')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {applicants.map((a, i) => {
              const score = a.score || 0;
              const isFlagged = a.hard_disqualified || false;
              const color = scoreColor(score, isFlagged);
              const isPendingStage = !a.stage || a.stage === 'new' || a.stage === 'screening_complete' || a.stage === 'done';
              const isLoading = applicantActionLoading === a.id;

              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, type: 'spring', damping: 28 }}
                  className="glass-card rounded-xl p-4"
                >
                  {/* Name + address row */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0 border border-border">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{a.full_name || t('applicants.unknown')}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{a.propertyAddress}</p>
                    </div>
                    {a.match_label && (
                      <span className="shrink-0 text-[10px] font-semibold" style={{ color }}>{a.match_label}</span>
                    )}
                  </div>

                  {/* Match score bar */}
                  {score > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 score-track">
                        <motion.div
                          className="score-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${(score / 10) * 100}%` }}
                          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
                          style={{ backgroundColor: color }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold shrink-0" style={{ color }}>{score.toFixed(1)}</span>
                    </div>
                  )}

                  {/* Approve / Reject buttons */}
                  {isPendingStage && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApproveApplicant(a)}
                        disabled={isLoading}
                        className="flex-1 h-8 rounded-lg text-xs"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                        Goedkeuren
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectApplicant(a)}
                        disabled={isLoading}
                        className="flex-1 h-8 rounded-lg text-xs border-destructive/30 text-destructive hover:bg-destructive/8"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <X className="w-3.5 h-3.5 mr-1" />}
                        Afwijzen
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.25, type: 'spring', damping: 16, stiffness: 220 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setDialogOpen(true)}
        className="fixed bottom-6 right-6 w-13 h-13 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center z-20"
        style={{ width: 52, height: 52 }}
      >
        <Plus className="w-5 h-5" />
      </motion.button>

      <AddPropertyDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchProperties} />
      {kbDialog && (
        <PropertyKnowledgeBaseDialog
          open={!!kbDialog}
          onOpenChange={(v) => { if (!v) { setKbDialog(null); fetchProperties(); } }}
          propertyId={kbDialog.id}
          propertyAddress={kbDialog.address}
        />
      )}
    </div>
  );
}
