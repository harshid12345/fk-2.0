import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Phone, Bot, Clock, Building2 } from 'lucide-react';
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
  const { t } = useLanguage();
  const { toast } = useToast();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

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
    toast({ title: 'Issue resolved' });
  };

  const trivial = issues.filter(i => i.category === 'trivial' && !i.landlord_resolved);
  const attention = issues.filter(i => i.category === 'needs_attention' && !i.landlord_resolved);
  const urgent = issues.filter(i => i.category === 'urgent' && !i.landlord_resolved);

  const IssueCard = ({ issue, variant }: { issue: Issue; variant: 'trivial' | 'attention' | 'urgent' }) => (
    <div className={`p-4 rounded-xl border bg-card ${variant === 'urgent' ? 'border-l-[3px] border-l-destructive border-t-border border-r-border border-b-border' : 'border-border'}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-foreground">{issue.tenant_name || 'Unknown tenant'}</p>
          <Badge variant="outline" className="text-[10px] gap-1 mt-1 font-normal">
            <Building2 className="w-3 h-3" /> {issue.property_address || 'Unknown'}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(issue.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <p className="text-sm text-foreground mt-2">{issue.message}</p>
      {issue.photo_url && (
        <img src={issue.photo_url} alt="Issue photo" className="mt-2 rounded-lg max-h-32 object-cover" />
      )}
      {issue.ai_response && (
        <div className="mt-3 p-3 rounded-lg bg-accent/50 border border-border">
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Bot className="w-3 h-3" /> {t('issues.ai_response')}</p>
          <p className="text-sm text-foreground">{issue.ai_response}</p>
        </div>
      )}
      {variant !== 'trivial' && (
        <div className="flex items-center gap-2 mt-3">
          <Button size="sm" variant="outline" onClick={() => markResolved(issue.id)} className="h-7 text-xs">
            <CheckCircle className="w-3.5 h-3.5 mr-1" /> {t('issues.mark_resolved')}
          </Button>
          {variant === 'urgent' && (
            <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10">
              <Phone className="w-3.5 h-3.5 mr-1" /> {t('issues.call_tenant')}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;

  const isEmpty = trivial.length === 0 && attention.length === 0 && urgent.length === 0;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-xl font-semibold text-foreground mb-6">{t('issues.title')}</h1>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-border">
          <AlertCircle className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground max-w-md text-center">{t('issues.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Trivial */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              <h2 className="text-sm font-medium text-muted-foreground">{t('issues.handled_by_ai')}</h2>
              <span className="text-xs text-muted-foreground ml-auto">{trivial.length}</span>
            </div>
            <div className="space-y-3">
              {trivial.map(i => <IssueCard key={i.id} issue={i} variant="trivial" />)}
            </div>
          </div>

          {/* Needs attention */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[hsl(38,92%,50%)]" />
              <h2 className="text-sm font-medium text-[hsl(38,92%,50%)]">{t('issues.needs_attention')}</h2>
              <span className="text-xs text-muted-foreground ml-auto">{attention.length}</span>
            </div>
            <div className="space-y-3">
              {attention.map(i => <IssueCard key={i.id} issue={i} variant="attention" />)}
            </div>
          </div>

          {/* Urgent */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <h2 className="text-sm font-medium text-destructive">{t('issues.urgent')}</h2>
              <span className="text-xs text-muted-foreground ml-auto">{urgent.length}</span>
            </div>
            <div className="space-y-3">
              {urgent.map(i => <IssueCard key={i.id} issue={i} variant="urgent" />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
