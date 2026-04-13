import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Users, Building2 } from 'lucide-react';

export default function ApplicantsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [applicants, setApplicants] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new' | 'done'>('all');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: props } = await supabase.from('landlord_properties').select('id, address').eq('landlord_id', user.id);
      setProperties(props || []);
      if (props && props.length > 0) {
        const ids = props.map(p => p.id);
        const { data: apps } = await supabase.from('applicants').select('*').in('property_id', ids).order('created_at', { ascending: false });
        setApplicants(apps || []);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const filtered = applicants.filter(a => {
    if (filter === 'new') return !a.stage || a.stage === 'new' || a.stage === 'welcome';
    if (filter === 'done') return a.stage === 'done';
    return true;
  });

  const getPropertyAddress = (propertyId: string) => {
    return properties.find(p => p.id === propertyId)?.address || '—';
  };

  const filters = [
    { key: 'all' as const, label: t('applicants.filter_all') },
    { key: 'new' as const, label: t('applicants.filter_new') },
    { key: 'done' as const, label: t('applicants.filter_done') },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="px-5 py-5 pb-8 space-y-4">
      <h1 className="text-lg font-semibold text-foreground">{t('applicants.title')}</h1>

      {/* Filters */}
      <div className="flex gap-2">
        {filters.map(f => (
          <motion.button
            key={f.key}
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-accent text-muted-foreground'
            }`}
          >
            {f.label} {f.key === 'all' ? `(${applicants.length})` : ''}
          </motion.button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Users className="w-9 h-9 text-muted-foreground mx-auto mb-2.5" />
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">{t('applicants.empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-card rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{a.full_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.occupation || '—'} · €{a.monthly_income || '—'}/mo
                    {a.age ? ` · Age ${a.age}` : ''}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {getPropertyAddress(a.property_id)}
                  </p>
                </div>
                {a.match_score != null && (
                  <div className="relative w-11 h-11 flex-shrink-0">
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
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-[hsl(152,60%,52%)]/10 text-[hsl(152,60%,52%)]">
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
                    <p key={fi} className="text-[11px] text-[hsl(38,92%,50%)] flex items-center gap-1">
                      ⚠️ {flag}
                    </p>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
