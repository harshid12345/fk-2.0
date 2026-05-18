import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Star, Phone, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface Property {
  id: string;
  address: string;
  city: string;
}

interface Specialist {
  id: number;
  name: string;
  specialty: string;
  rating: number;
  address: string;
  phone: string;
}


const MOCK_PROPERTIES: Property[] = [
  { id: 'demo-hague-studio-01', address: 'Laan van Meerdervoort 57A', city: 'Den Haag' },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className="w-3 h-3"
          style={{
            fill: i <= Math.round(rating) ? 'hsl(38, 92%, 46%)' : 'transparent',
            color: 'hsl(38, 92%, 46%)',
          }}
        />
      ))}
      <span className="text-[11px] text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="shimmer h-4 w-2/3 rounded" />
      <div className="shimmer h-3 w-1/3 rounded" />
      <div className="shimmer h-3 w-1/2 rounded" />
      <div className="shimmer h-8 w-24 rounded-lg" />
    </div>
  );
}

export default function MaintenancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Specialist[] | null>(null);
  const [searching, setSearching] = useState(false);

  const fetchProperties = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('landlord_properties').select('id, address, city').eq('landlord_id', user.id);
    const props = (data as Property[]) || [];
    const list = props.length === 0 ? MOCK_PROPERTIES : props;
    setProperties(list);
    if (list.length > 0) setSelectedProperty(list[0].address + (list[0].city ? `, ${list[0].city}` : ''));
  }, [user]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: { query: searchTerm, location: selectedProperty },
      });

      if (error || data?.error) {
        toast({ title: 'Zoekopdracht mislukt', description: 'Kon geen vakmensen ophalen. Probeer het opnieuw.', variant: 'destructive' as any });
        setResults([]);
      } else {
        setResults((data?.specialists ?? []) as Specialist[]);
      }
    } catch {
      toast({ title: 'Zoekopdracht mislukt', description: 'Networkfout. Probeer het opnieuw.', variant: 'destructive' as any });
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const selectedProp = properties.find(p => {
    const label = p.address + (p.city ? `, ${p.city}` : '');
    return label === selectedProperty;
  });

  return (
    <div className="px-5 pt-5 pb-10">
      {/* Page title */}
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-serif text-foreground leading-tight mb-6"
      >
        Onderhoud
      </motion.h1>

      {/* Property selector */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="mb-4"
      >
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          Voor welk pand?
        </label>
        <div className="relative">
          <button
            onClick={() => setSelectorOpen(v => !v)}
            className="w-full glass-card rounded-xl px-4 py-3 flex items-center justify-between text-sm text-foreground"
          >
            <span className="truncate">{selectedProperty || 'Kies een pand…'}</span>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground shrink-0 ml-2 transition-transform duration-150 ${selectorOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {selectorOpen && (
            <div
              className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl overflow-hidden border border-border"
              style={{ background: 'hsl(var(--card))' }}
            >
              {properties.map(p => {
                const label = p.address + (p.city ? `, ${p.city}` : '');
                return (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProperty(label); setSelectorOpen(false); }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                      label === selectedProperty
                        ? 'text-primary bg-primary/8'
                        : 'text-foreground hover:bg-accent'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* Search bar */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2 mb-6"
      >
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Beschrijf uw probleem..."
          className="flex-1 glass-card rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground bg-transparent outline-none border border-border focus:border-primary/50 transition-colors"
        />
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleSearch}
          className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center shrink-0 self-center"
        >
          <Search className="w-4 h-4 text-primary-foreground" />
        </motion.button>
      </motion.div>

      {/* Results */}
      {searching ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : results === null ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card rounded-xl py-14 px-6 text-center"
        >
          <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Typ een probleem om vakmensen te vinden</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Geen vakmensen gevonden in de buurt.
            </p>
          )}
          {results.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: 'spring', damping: 28, stiffness: 260 }}
              className="glass-card rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <p className="text-sm font-semibold text-foreground leading-snug">{s.name}</p>
                <span
                  className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md"
                  style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--muted-foreground))' }}
                >
                  {s.specialty}
                </span>
              </div>
              <StarRating rating={s.rating} />
              <p className="text-[11px] text-muted-foreground mt-1.5">{s.address}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {s.phone}
                </span>
                <motion.a
                  href={`tel:${s.phone.replace(/\s/g, '')}`}
                  whileTap={{ scale: 0.92 }}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
                >
                  Bellen
                </motion.a>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
