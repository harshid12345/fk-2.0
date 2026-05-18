import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Phone, Bot, Clock, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Issue {
  id: string;
  property_id: string;
  tenant_name: string | null;
  message: string;
  photo_url: string | null;
  category: string;
  ai_response: string | null;
  ai_resolved: boolean;
  landlord_resolved: boolean;
  created_at: string;
  property_address?: string;
}

export default function IssuesPage() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'trivial' | 'needs_attention' | 'urgent'>('all');

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: props } = await supabase.from('landlord_properties').select('id, address');
      const propMap: Record<string, string> = {};
      (props || []).forEach((p: any) => { propMap[p.id] = p.address; });
      setProperties(propMap);
      const { data } = await supabase.from('tenant_issues').select('*').order('created_at', { ascending: false });
      setIssues((data || []).map((i: any) => ({ ...i, property_address: propMap[i.property_id] })));
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const markResolved = async (id: string) => {
    await supabase.from('tenant_issues').update({ landlord_resolved: true }).eq('id', id);
    setIssues(prev => prev.map(i => i.id === id ? { ...i, landlord_resolved: true } : i));
    toast({ title: t('issues.resolved_toast') });
  };

  const filteredIssues = issues.filter(i => !i.landlord_resolved && (activeFilter === 'all' || i.category === activeFilter));

  const counts = {
    all: issues.filter(i => !i.landlord_resolved).length,
    trivial: issues.filter(i => !i.landlord_resolved && i.category === 'trivial').length,
    needs_attention: issues.filter(i => !i.landlord_resolved && i.category === 'needs_attention').length,
    urgent: issues.filter(i => !i.landlord_resolved && i.category === 'urgent').length,
  };

  const filters = [
    { key: 'all' as const, label: t('issues.filter_all'), count: counts.all },
    { key: 'urgent' as const, label: t('issues.category_urgent'), count: counts.urgent, color: 'text-destructive' },
    { key: 'needs_attention' as const, label: t('issues.filter_action'), count: counts.needs_attention, color: 'text-[hsl(38,92%,50%)]' },
    { key: 'trivial' as const, label: t('issues.filter_ai'), count: counts.trivial, color: 'text-muted-foreground' },
  ];

  if (loading) return (
    <div className="px-5 pt-4 space-y-3">
      {[...Array(3)].map((_, i) => <div key={i} className="shimmer rounded-2xl h-28" />)}
    </div>
  );

  return (
    <div className="pb-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 pt-4 pb-2"
      >
        <h1 className="text-2xl font-semibold text-foreground mb-3">{t('issues.title')}</h1>
      </motion.div>

      {/* Filter pills */}
      <div className="px-5 pb-4 flex gap-2 overflow-x-auto no-scrollbar">
        {filters.map(f => (
          <motion.button
            key={f.key}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveFilter(f.key)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              activeFilter === f.key
                ? 'bg-primary/15 text-primary'
                : 'glass-card text-muted-foreground'
            }`}
          >
            {f.key === 'urgent' && <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />}
            {f.key === 'needs_attention' && <div className="w-1.5 h-1.5 rounded-full bg-[hsl(38,92%,50%)]" />}
            {f.label}
            {f.count > 0 && <span className="opacity-60">{f.count}</span>}
          </motion.button>
        ))}
      </div>

      {/* Issues list */}
      <div className="px-5 space-y-3">
        {filteredIssues.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-16 glass-card rounded-2xl"
          >
            <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground max-w-xs text-center">{t('issues.empty')}</p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {filteredIssues.map((issue, index) => (
              <motion.div
                key={issue.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, type: 'spring', damping: 25 }}
                className={`glass-card rounded-2xl overflow-hidden ${
                  issue.category === 'urgent' ? 'border-l-[3px] border-l-destructive' : ''
                } ${issue.category === 'urgent' ? 'animate-[pulse_3s_ease-in-out_infinite]' : ''}`}
              >
                <motion.button
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">{issue.tenant_name || t('issues.unknown_tenant')}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                          issue.category === 'urgent' ? 'bg-destructive/15 text-destructive' :
                          issue.category === 'needs_attention' ? 'bg-[hsl(38,92%,50%)]/15 text-[hsl(38,92%,50%)]' :
                          'bg-primary/10 text-primary'
                        }`}>
                          {issue.category === 'trivial' ? t('issues.category_ai') : issue.category === 'urgent' ? t('issues.category_urgent') : t('issues.category_action')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate pr-4">{issue.message}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {issue.property_address || t('issues.unknown_property')}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(issue.created_at).toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                    {expandedId === issue.id ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </div>
                </motion.button>

                <AnimatePresence>
                  {expandedId === issue.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                        <p className="text-sm text-foreground">{issue.message}</p>
                        {issue.photo_url && (
                          <img src={issue.photo_url} alt="" className="rounded-xl max-h-40 object-cover" />
                        )}
                        {issue.ai_response && (
                          <div className="p-3 rounded-xl bg-accent/50">
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1"><Bot className="w-3 h-3" /> {t('issues.ai_response')}</p>
                            <p className="text-sm text-foreground">{issue.ai_response}</p>
                          </div>
                        )}
                        {issue.category !== 'trivial' && (
                          <div className="flex gap-2">
                            <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
                              <Button size="sm" onClick={() => markResolved(issue.id)} className="w-full h-9 rounded-xl text-xs">
                                <CheckCircle className="w-3.5 h-3.5 mr-1" /> {t('issues.mark_resolved')}
                              </Button>
                            </motion.div>
                            {issue.category === 'urgent' && (
                              <motion.div whileTap={{ scale: 0.97 }}>
                                <Button size="sm" variant="outline" className="h-9 rounded-xl text-xs text-destructive border-destructive/30">
                                  <Phone className="w-3.5 h-3.5 mr-1" /> {t('issues.call_tenant')}
                                </Button>
                              </motion.div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
