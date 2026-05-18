import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ShieldCheck, Trash2, Home, Users, Share2, FileText, KeyRound, MessageCircle, MapPin } from 'lucide-react';
import PropertyKnowledgeBaseManager from '@/components/PropertyKnowledgeBaseManager';
import MarkAsRentedDialog from '@/components/MarkAsRentedDialog';
import { toast as sonnerToast } from 'sonner';

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const locale = lang === 'nl' ? 'nl-NL' : 'en-GB';
  const navigate = useNavigate();
  const { toast } = useToast();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [markRentedOpen, setMarkRentedOpen] = useState(false);

  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
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
      setTenantPhone(prop.tenant_phone || '');
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
    const phoneChanged = (tenantPhone || null) !== (property?.tenant_phone || null);
    await supabase.from('landlord_properties').update({
      tenant_name: tenantName || null,
      tenant_phone: tenantPhone || null,
      tenant_contract_start: tenantContractStart || null,
      tenant_monthly_rent: parseFloat(tenantMonthlyRent) || null,
      tenant_deposit: parseFloat(tenantDeposit) || null,
    }).eq('id', id);
    toast({ title: t('detail.tenant_saved') });
    await fetchData();
    if (phoneChanged && tenantPhone.trim() && property?.address) {
      sendWhatsAppIntro(tenantPhone, tenantName, property.address, id);
    }
  };

  const waNum = import.meta.env.VITE_WHATSAPP_BUSINESS_NUMBER || '3197010227583';

  const sendWhatsAppIntro = (phone: string, name: string, address: string, propId: string) => {
    const link = `https://wa.me/${waNum}?text=start%20${propId}`;
    const first = (name || 'huurder').split(' ')[0];
    const msg = `Hey ${first}! Je verhuurder heeft FairKamer ingesteld voor ${address}. Ik ben je AI-assistent — ik kan helpen met wifi, verwarming, huisregels, contractvragen, onderhoudsmonteurs en alles over de woning.\n\nStart hier op WhatsApp:\n${link}`;
    const cleaned = phone.replace(/[^\d]/g, '');
    navigator.clipboard.writeText(msg).catch(() => {});
    if (cleaned) {
      window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
      sonnerToast.success('WhatsApp geopend met intro voor huurder');
    } else {
      sonnerToast.success('Introbericht gekopieerd');
    }
  };

  const simulateScreenerMessage = async () => {
    try {
      const fakePhone = '31600000000';
      const payload = {
        entry: [{
          changes: [{
            value: {
              messages: [{ from: fakePhone, type: 'text', text: { body: `start ${id}` } }],
              contacts: [{ profile: { name: 'Dev Tester' } }],
            },
          }],
        }],
      };
      const { data, error } = await supabase.functions.invoke('whatsapp-screener', { body: payload });
      if (error) {
        sonnerToast.error(`Screener error: ${error.message}`);
      } else {
        sonnerToast.success('Gesimuleerd startbericht verstuurd');
        console.log('[dev] whatsapp-screener response:', data);
      }
    } catch (err) {
      sonnerToast.error(`Mislukt: ${String(err)}`);
    }
  };

  const deleteProperty = async () => {
    if (!id) return;
    await supabase.from('landlord_properties').delete().eq('id', id);
    toast({ title: t('detail.deleted') });
    navigate('/properties');
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!property) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
      {t('detail.not_found')}
    </div>
  );

  const isRented = property.status === 'rented';
  const tabs = isRented
    ? [{ label: t('detail.overview_tab') }, { label: t('detail.tenant_tab') }, { label: t('detail.documents_tab') }]
    : [{ label: t('detail.overview_tab') }, { label: t('detail.applicants_tab_label') }, { label: t('detail.documents_tab') }];

  return (
    <div className="pb-10">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 glass-surface border-b border-border">
        <div className="flex items-center justify-between px-4 h-12">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/properties')}
            className="p-1.5 -ml-1.5 rounded-lg text-foreground/70 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <span className="font-semibold text-foreground text-sm truncate max-w-[200px]">
            {property.address}
          </span>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={deleteProperty}
            className="p-1.5 -mr-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Hero section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 pt-5 pb-4"
      >
        {/* Address + status */}
        <div className={`property-card rounded-xl p-5 mb-4 ${isRented ? 'property-card--rented' : 'property-card--seeking'}`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h1 className="text-xl font-serif text-foreground leading-snug">
                {property.address}
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />
                {property.city}{property.postcode ? ` · ${property.postcode}` : ''}
              </p>
            </div>
            <span className={`status-pill shrink-0 mt-0.5 ${isRented ? 'status-pill--rented' : 'status-pill--seeking'}`}>
              {isRented ? <Home className="w-3 h-3" /> : <Users className="w-3 h-3" />}
              {isRented ? t('properties.rented') : t('properties.seeking')}
            </span>
          </div>

          {/* Key stats */}
          <div className="grid grid-cols-3 gap-0 divide-x divide-border">
            <div className="pr-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{t('detail.rent_stat')}</p>
              <p className="text-lg font-semibold text-foreground leading-none">
                €{property.rent_amount ? Math.round(property.rent_amount).toLocaleString(locale) : '—'}
              </p>
            </div>
            <div className="px-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{t('detail.surface_stat')}</p>
              <p className="text-base font-semibold text-foreground leading-none">
                {property.surface_m2 || '—'} m²
              </p>
            </div>
            <div className="pl-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{t('detail.year_stat')}</p>
              <p className="text-base font-semibold text-foreground leading-none">
                {property.building_year || '—'}
              </p>
            </div>
          </div>

          {/* BAG verified */}
          {property.bag_verified && (
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
              <ShieldCheck className="w-3.5 h-3.5 text-success" />
              <span className="text-[11px] text-success font-medium">{t('detail.verified')}</span>
            </div>
          )}
        </div>

        {/* Primary CTA */}
        {isRented ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              const link = `https://wa.me/${waNum}?text=start%20${property.id}`;
              const tenantFirst = (property.tenant_name || 'huurder').split(' ')[0];
              const msg = `Hey ${tenantFirst}! Je AI-assistent voor ${property.address} staat klaar voor al je vragen.\n\nStart hier:\n${link}`;
              if (property.tenant_phone) {
                const cleaned = String(property.tenant_phone).replace(/[^\d]/g, '');
                navigator.clipboard.writeText(msg).catch(() => {});
                window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
                sonnerToast.success('WhatsApp geopend');
              } else {
                navigator.clipboard.writeText(msg);
                sonnerToast.success('Concierge bericht gekopieerd');
              }
            }}
            className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
          >
            <MessageCircle className="w-4 h-4" /> Stuur concierge link
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setMarkRentedOpen(true)}
            className="w-full h-10 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold border-2"
            style={{ borderColor: 'hsl(var(--success))', color: 'hsl(var(--success))' }}
          >
            <KeyRound className="w-4 h-4" /> Markeer als verhuurd
          </motion.button>
        )}
      </motion.div>

      {/* Tab switcher */}
      <div className="px-5 mb-4">
        <div className="flex gap-1 p-1 glass-card rounded-xl">
          {tabs.map((tab, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab(i)}
              className={`relative flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === i ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {activeTab === i && (
                <motion.div
                  layoutId="detail-tab"
                  className="absolute inset-0 bg-accent rounded-lg"
                  transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-5 space-y-3">

        {/* Overview tab */}
        {activeTab === 0 && (
          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
            <div className="glass-card rounded-xl p-4 space-y-4">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                {t('detail.property_details')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  [t('detail.surface'), `${property.surface_m2 || '—'} m²`],
                  [t('detail.building_year'), property.building_year || '—'],
                  [t('detail.energy_label'), property.energy_label || '—'],
                  [t('detail.type'), property.accommodation_type || '—'],
                ].map(([label, value]) => (
                  <div key={label as string} className="bg-accent rounded-lg px-3 py-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-foreground capitalize">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Tenant tab (rented) */}
        {activeTab === 1 && isRented && (
          <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="glass-card rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
              {t('detail.current_tenant')}
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('detail.tenant_name')}</Label>
                <Input value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="Volledige naam" className="rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">WhatsApp nummer huurder</Label>
                <Input value={tenantPhone} onChange={e => setTenantPhone(e.target.value)} placeholder="+31 6 1234 5678" inputMode="tel" className="rounded-lg" />
                <p className="text-[11px] text-muted-foreground">We sturen de WhatsApp bot link zodat ze met hun AI-assistent kunnen chatten.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('detail.contract_start')}</Label>
                <Input type="date" value={tenantContractStart} onChange={e => setTenantContractStart(e.target.value)} className="rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('detail.monthly_rent')} (€)</Label>
                  <Input type="number" value={tenantMonthlyRent} onChange={e => setTenantMonthlyRent(e.target.value)} className="rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('detail.deposit')} (€)</Label>
                  <Input type="number" value={tenantDeposit} onChange={e => setTenantDeposit(e.target.value)} className="rounded-lg" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Button onClick={saveTenant} className="w-full h-10 rounded-lg text-sm font-semibold">
                {t('detail.save_tenant')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!tenantPhone.trim()) {
                    toast({ title: 'Voeg eerst een telefoonnummer toe', variant: 'destructive' });
                    return;
                  }
                  sendWhatsAppIntro(tenantPhone, tenantName, property.address, property.id);
                }}
                className="w-full h-10 rounded-lg text-sm font-semibold gap-2"
              >
                <MessageCircle className="w-4 h-4" /> Stuur WhatsApp intro naar huurder
              </Button>
            </div>
          </motion.div>
        )}

        {/* Applicants tab (seeking) */}
        {activeTab === 1 && !isRented && (
          <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                {t('detail.applicants')}
              </p>
              <div className="flex items-center gap-2">
                {import.meta.env.DEV && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={simulateScreenerMessage}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-warning/12 text-warning border border-warning/25"
                  >
                    Test bot
                  </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    const link = `https://wa.me/${waNum}?text=start%20${id}`;
                    const msg = `Hoi! Ik gebruik FairKamer om kandidaten te screenen voor ${property.address}.\n\nHet duurt ongeveer 5 minuten. Klik op de link:\n\n${link}`;
                    navigator.clipboard.writeText(msg);
                    sonnerToast.success('Bericht gekopieerd! Plak het naar je kandidaten.');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground"
                >
                  <Share2 className="w-3.5 h-3.5" /> Delen
                </motion.button>
              </div>
            </div>

            {applicants.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center">
                <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
                  {t('detail.no_applicants')}
                </p>
              </div>
            ) : (
              applicants.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="glass-card rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{a.full_name || t('applicants.unknown')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.employment_type || '—'} · €{a.monthly_income ? a.monthly_income.toLocaleString(locale) : '—'}/mnd
                    </p>
                    <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-accent text-muted-foreground capitalize">
                      {a.stage || 'nieuw'}
                    </span>
                  </div>
                  {a.match_score != null && (
                    <div className="text-right shrink-0">
                      <p className="text-xl font-semibold text-primary leading-none">
                        {a.match_score <= 10 ? a.match_score.toFixed(1) : (a.match_score / 10).toFixed(1)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{a.match_label || ''}</p>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* Documents tab */}
        {activeTab === 2 && (
          <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="glass-card rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Documenten</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload handleidingen, wifi-informatie, apparaatgidsen of contracten. De AI-assistent gebruikt deze om vragen van huurders te beantwoorden.
            </p>
            <PropertyKnowledgeBaseManager propertyId={property.id} compact onChange={() => fetchData()} />
          </motion.div>
        )}
      </div>

      <MarkAsRentedDialog
        open={markRentedOpen}
        onOpenChange={setMarkRentedOpen}
        propertyId={property.id}
        propertyAddress={property.address}
        defaultName={property.tenant_name || ''}
        onMarked={fetchData}
      />
    </div>
  );
}
