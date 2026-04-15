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
import { ArrowLeft, Building2, ShieldCheck, Copy, Trash2, Home, Users, Calendar, Plus, X, Share2 } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import { getComplianceStatus } from '@/lib/wws';

interface ViewingSlot {
  label: string;
  datetime: string;
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  const [tenantName, setTenantName] = useState('');
  const [tenantContractStart, setTenantContractStart] = useState('');
  const [tenantMonthlyRent, setTenantMonthlyRent] = useState('');
  const [tenantDeposit, setTenantDeposit] = useState('');
  const [applicants, setApplicants] = useState<any[]>([]);

  // Viewing slots
  const [newSlotLabel, setNewSlotLabel] = useState('');
  const [newSlotDatetime, setNewSlotDatetime] = useState('');

  useEffect(() => { fetchData(); }, [id, user]);

  const fetchData = async () => {
    if (!id || !user) return;
    const { data: prop } = await supabase.from('landlord_properties').select('*').eq('id', id).single();
    if (prop) {
      setProperty(prop);
      setTenantName(prop.tenant_name || '');
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
    await supabase.from('landlord_properties').update({
      tenant_name: tenantName || null,
      tenant_contract_start: tenantContractStart || null,
      tenant_monthly_rent: parseFloat(tenantMonthlyRent) || null,
      tenant_deposit: parseFloat(tenantDeposit) || null,
    }).eq('id', id);
    toast({ title: t('detail.tenant_saved') });
    fetchData();
  };

  const deleteProperty = async () => {
    if (!id) return;
    await supabase.from('landlord_properties').delete().eq('id', id);
    toast({ title: t('detail.deleted') });
    navigate('/properties');
  };

  const addViewingSlot = async () => {
    if (!id || !newSlotLabel || !newSlotDatetime) return;
    const slots: ViewingSlot[] = (property?.viewing_slots as ViewingSlot[]) || [];
    const updated = [...slots, { label: newSlotLabel, datetime: newSlotDatetime }];
    await supabase.from('landlord_properties').update({ viewing_slots: updated as any }).eq('id', id);
    setNewSlotLabel('');
    setNewSlotDatetime('');
    toast({ title: t('detail.slot_added') });
    fetchData();
  };

  const removeViewingSlot = async (index: number) => {
    if (!id) return;
    const slots: ViewingSlot[] = (property?.viewing_slots as ViewingSlot[]) || [];
    const updated = slots.filter((_, i) => i !== index);
    await supabase.from('landlord_properties').update({ viewing_slots: updated as any }).eq('id', id);
    toast({ title: t('detail.slot_removed') });
    fetchData();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!property) return <div className="flex items-center justify-center py-20 text-muted-foreground">Property not found</div>;

  const complianceStatus = property.rent_amount && property.wws_max_rent
    ? getComplianceStatus(property.rent_amount, property.wws_max_rent) : null;
  const isRented = property.status === 'rented';
  const viewingSlots: ViewingSlot[] = (property.viewing_slots as ViewingSlot[]) || [];

  const tabs = isRented
    ? [{ label: 'Overview' }, { label: 'Tenant' }]
    : [{ label: 'Overview' }, { label: 'Applicants' }, { label: t('detail.viewing_slots') }];

  return (
    <div className="pb-8">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 glass-surface border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/properties')} className="p-2 -ml-2 rounded-xl">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </motion.button>
          <span className="font-medium text-foreground text-sm truncate max-w-[200px]">{property.address}</span>
          <motion.button whileTap={{ scale: 0.9 }} onClick={deleteProperty} className="p-2 -mr-2 rounded-xl text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Property hero */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{property.address}</h1>
            <p className="text-sm text-muted-foreground">{property.city} · {property.postcode}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium ${
            isRented ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
          }`}>
            {isRented ? <Home className="w-3 h-3" /> : <Users className="w-3 h-3" />}
            {isRented ? t('properties.rented') : t('properties.seeking')}
          </span>
          {complianceStatus && (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-medium ${
              complianceStatus === 'compliant' ? 'bg-success/10 text-success' :
              complianceStatus === 'at_risk' ? 'bg-warning/10 text-warning' :
              'bg-destructive/10 text-destructive'
            }`}>
              {complianceStatus === 'compliant' ? t('properties.compliant') :
               complianceStatus === 'at_risk' ? t('properties.at_risk') : t('properties.over_limit')}
            </span>
          )}
        </div>
      </motion.div>

      {/* Tab switcher */}
      <div className="px-5 mb-4">
        <div className="flex gap-1 p-1 glass-card rounded-xl">
          {tabs.map((tab, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab(i)}
              className={`relative flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === i ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {activeTab === i && (
                <motion.div
                  layoutId="detail-tab"
                  className="absolute inset-0 bg-accent rounded-lg"
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-5 space-y-3">
        {activeTab === 0 && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <h3 className="font-medium text-foreground text-sm">{t('detail.property_details')}</h3>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                {[
                  [t('detail.surface'), `${property.surface_m2 || '—'} m²`],
                  [t('detail.building_year'), property.building_year || '—'],
                  [t('detail.energy_label'), property.energy_label || '—'],
                  [t('detail.type'), property.accommodation_type || '—'],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p className="text-foreground mt-0.5 capitalize">{value}</p>
                  </div>
                ))}
              </div>
              {property.bag_verified && (
                <div className="flex items-center gap-1.5 text-xs text-success">
                  <ShieldCheck className="w-3.5 h-3.5" /> {t('detail.verified')}
                </div>
              )}
            </div>

            <div className="glass-card rounded-2xl p-5 space-y-4">
              <h3 className="font-medium text-foreground text-sm">{t('detail.wws_assessment')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-muted-foreground">{t('detail.current_rent')}</p>
                  <p className="text-xl font-semibold text-foreground mt-0.5">€{property.rent_amount?.toFixed(0) || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">{t('detail.max_rent')}</p>
                  <p className="text-xl font-semibold text-foreground mt-0.5">€{property.wws_max_rent?.toFixed(0) || '—'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('properties.wws_points')}</span>
                <span className="text-foreground font-medium">{property.wws_points || '—'}</span>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 1 && isRented && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="glass-card rounded-2xl p-5 space-y-4">
            <h3 className="font-medium text-foreground text-sm">{t('detail.current_tenant')}</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('detail.tenant_name')}</Label>
                <Input value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="Full name" className="bg-accent/50 border-border/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('detail.contract_start')}</Label>
                <Input type="date" value={tenantContractStart} onChange={e => setTenantContractStart(e.target.value)} className="bg-accent/50 border-border/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('detail.monthly_rent')} (€)</Label>
                  <Input type="number" value={tenantMonthlyRent} onChange={e => setTenantMonthlyRent(e.target.value)} className="bg-accent/50 border-border/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('detail.deposit')} (€)</Label>
                  <Input type="number" value={tenantDeposit} onChange={e => setTenantDeposit(e.target.value)} className="bg-accent/50 border-border/50" />
                </div>
              </div>
            </div>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button onClick={saveTenant} className="w-full h-10 rounded-xl text-sm font-medium">{t('detail.save_tenant')}</Button>
            </motion.div>
          </motion.div>
        )}

        {activeTab === 1 && !isRented && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-foreground text-sm">{t('detail.applicants')}</h3>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const link = `https://t.me/fairkamer_screen_bot?start=${id}`;
                  const msg = `Hi! I use FairKamer to screen tenants for my property at ${property.address}.\n\nIt takes about 5 minutes and helps you stand out from other applicants. Click the link below to get started:\n\n👉 ${link}`;
                  navigator.clipboard.writeText(msg);
                  sonnerToast.success('Message copied! Paste it to your applicants.');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-primary text-primary-foreground"
              >
                <Share2 className="w-3.5 h-3.5" /> Share with applicants
              </motion.button>
            </div>

            {applicants.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center">
                <Users className="w-9 h-9 text-muted-foreground mx-auto mb-2.5" />
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">{t('detail.no_applicants')}</p>
              </div>
            ) : (
              applicants.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{a.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.occupation || '—'} · €{a.monthly_income || '—'}/mo
                        {a.age ? ` · Age ${a.age}` : ''}
                      </p>
                    </div>
                    {a.match_score != null && (
                      <div className="relative w-11 h-11">
                        <svg className="w-11 h-11 -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-accent" />
                          <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3"
                            stroke={a.match_score > 70 ? 'hsl(152, 60%, 52%)' : a.match_score > 40 ? 'hsl(38, 92%, 50%)' : 'hsl(0, 60%, 55%)'}
                            strokeDasharray={`${(a.match_score / 100) * 94.2} 94.2`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">{a.match_score}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {a.id_verified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-success/10 text-success">
                        ✅ ID Verified
                      </span>
                    )}
                    {a.viewing_booked_at && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-primary/10 text-primary">
                        📅 {new Date(a.viewing_booked_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    {a.social_handle && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium bg-accent text-muted-foreground">
                        📸 @{a.social_handle}
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-medium bg-accent text-muted-foreground capitalize">
                      {a.stage || 'new'}
                    </span>
                  </div>

                  {a.match_flags && Array.isArray(a.match_flags) && a.match_flags.length > 0 && (
                    <div className="space-y-1">
                      {(a.match_flags as string[]).map((flag, fi) => (
                         <p key={fi} className="text-[11px] text-warning flex items-center gap-1">
                           ⚠️ {flag}
                         </p>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </motion.div>
        )}

        {/* Viewing Slots Tab */}
        {activeTab === 2 && (
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <h3 className="font-medium text-foreground text-sm">{t('detail.viewing_slots')}</h3>

              {viewingSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('detail.no_slots')}</p>
              ) : (
                <div className="space-y-2">
                  {viewingSlots.map((slot, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-accent">
                      <div>
                        <p className="text-sm font-medium text-foreground">{slot.label}</p>
                        <p className="text-xs text-muted-foreground">{new Date(slot.datetime).toLocaleString('nl-NL')}</p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeViewingSlot(i)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-border/50 pt-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('detail.label')}</Label>
                  <Input
                    value={newSlotLabel}
                    onChange={e => setNewSlotLabel(e.target.value)}
                    placeholder="e.g. Tue 15 Apr, 14:00"
                    className="bg-accent/50 border-border/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t('detail.date_time')}</Label>
                  <Input
                    type="datetime-local"
                    value={newSlotDatetime}
                    onChange={e => setNewSlotDatetime(e.target.value)}
                    className="bg-accent/50 border-border/50"
                  />
                </div>
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button
                    onClick={addViewingSlot}
                    disabled={!newSlotLabel || !newSlotDatetime}
                    className="w-full h-10 rounded-xl text-sm font-medium"
                  >
                    <Plus className="w-4 h-4 mr-1.5" /> {t('detail.add_slot')}
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
