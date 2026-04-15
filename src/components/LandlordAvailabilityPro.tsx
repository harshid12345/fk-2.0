import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Copy, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type SlotState = 'neutral' | 'available' | 'unavailable';

const TIME_BLOCKS = [
  { label: 'Morning', range: '09:00 – 12:00', from: '09:00', to: '12:00' },
  { label: 'Afternoon', range: '12:00 – 17:00', from: '12:00', to: '17:00' },
  { label: 'Evening', range: '17:00 – 20:00', from: '17:00', to: '20:00' },
  { label: 'Late', range: '20:00 – 22:00', from: '20:00', to: '22:00' },
];

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${weekStart.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

function getSlotKey(dayIdx: number, blockIdx: number): string {
  return `${dayIdx}-${blockIdx}`;
}

const ONBOARDING_STEPS = [
  {
    title: 'Welcome to Availability',
    desc: 'Define when you are available for property viewings. This schedule syncs with your Telegram bot.',
    icon: '📅',
  },
  {
    title: 'Tap to Toggle',
    desc: 'Each block cycles through three states:\n🟢 Available — you can receive viewings\n🔴 Unavailable — blocked off\n⚫ Neutral — no preference set',
    icon: '👆',
  },
  {
    title: 'Smart Sync',
    desc: 'Set up Monday, then tap "Apply Monday → Weekdays" to copy it across Tuesday–Friday instantly.',
    icon: '⚡',
  },
  {
    title: 'Navigate Weeks',
    desc: 'Use the arrows to move between weeks. Your availability is saved per-week so you can plan ahead.',
    icon: '📆',
  },
];

export default function LandlordAvailabilityPro() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [slots, setSlots] = useState<Record<string, SlotState>>({});
  const [saving, setSaving] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // Check if first time
  useEffect(() => {
    const seen = localStorage.getItem('fk_avail_onboarded');
    if (!seen) setShowOnboarding(true);
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem('fk_avail_onboarded', '1');
  };

  // Load from DB
  useEffect(() => {
    if (!user) return;
    const loadWeek = async () => {
      const weekKey = weekStart.toISOString().slice(0, 10);
      const { data } = await supabase
        .from('viewing_schedule')
        .select('*')
        .eq('landlord_id', user.id);

      if (!data || data.length === 0) return;

      const newSlots: Record<string, SlotState> = {};
      data.forEach((row: any) => {
        const dayIdx = row.day_of_week;
        if (!row.enabled) {
          // Mark all blocks for this day as unavailable
          TIME_BLOCKS.forEach((_, bi) => {
            newSlots[getSlotKey(dayIdx, bi)] = 'unavailable';
          });
        } else {
          const startH = parseInt(row.start_time?.slice(0, 2) || '10');
          const endH = parseInt(row.end_time?.slice(0, 2) || '18');
          TIME_BLOCKS.forEach((block, bi) => {
            const bStart = parseInt(block.from.slice(0, 2));
            const bEnd = parseInt(block.to.slice(0, 2));
            if (bStart >= startH && bEnd <= endH) {
              newSlots[getSlotKey(dayIdx, bi)] = 'available';
            }
          });
        }
      });
      setSlots(newSlots);
    };
    loadWeek();
  }, [user, weekStart]);

  const cycleSlot = useCallback((dayIdx: number, blockIdx: number) => {
    const key = getSlotKey(dayIdx, blockIdx);
    setSlots(prev => {
      const current = prev[key] || 'neutral';
      const next: SlotState = current === 'neutral' ? 'available' : current === 'available' ? 'unavailable' : 'neutral';
      return { ...prev, [key]: next };
    });
  }, []);

  const applyMondayToWeekdays = () => {
    setSlots(prev => {
      const next = { ...prev };
      TIME_BLOCKS.forEach((_, bi) => {
        const mondayState = prev[getSlotKey(0, bi)] || 'neutral';
        for (let d = 1; d <= 4; d++) {
          next[getSlotKey(d, bi)] = mondayState;
        }
      });
      return next;
    });
    toast({ title: 'Monday applied to weekdays' });
  };

  const saveAvailability = async () => {
    if (!user) return;
    setSaving(true);

    await supabase.from('viewing_schedule').delete().eq('landlord_id', user.id);

    const rows = DAY_LABELS.map((_, dayIdx) => {
      const daySlots = TIME_BLOCKS.map((_, bi) => slots[getSlotKey(dayIdx, bi)] || 'neutral');
      const hasAvailable = daySlots.some(s => s === 'available');
      const allUnavailable = daySlots.every(s => s === 'unavailable');

      // Find earliest available and latest available for start/end time
      let startTime = '09:00:00';
      let endTime = '22:00:00';

      if (hasAvailable) {
        const firstAvail = daySlots.findIndex(s => s === 'available');
        const lastAvail = daySlots.length - 1 - [...daySlots].reverse().findIndex(s => s === 'available');
        startTime = TIME_BLOCKS[firstAvail].from + ':00';
        endTime = TIME_BLOCKS[lastAvail].to + ':00';
      }

      return {
        landlord_id: user.id,
        day_of_week: dayIdx,
        start_time: startTime,
        end_time: endTime,
        enabled: hasAvailable && !allUnavailable,
      };
    });

    await supabase.from('viewing_schedule').insert(rows as any);
    setSaving(false);
    toast({ title: 'Availability saved' });
  };

  const getSlotColor = (state: SlotState) => {
    switch (state) {
      case 'available': return 'bg-emerald-500 text-white';
      case 'unavailable': return 'bg-rose-500 text-white';
      default: return 'bg-[#262626] text-muted-foreground';
    }
  };

  const getDayDate = (dayIdx: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + dayIdx);
    return d.getDate();
  };

  return (
    <div className="space-y-4">
      {/* Onboarding Modal */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1a1a1a] rounded-2xl p-6 max-w-sm w-full border border-border/30"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-1.5">
                  {ONBOARDING_STEPS.map((_, i) => (
                    <div key={i} className={`h-1 w-8 rounded-full transition-colors duration-200 ${i <= onboardingStep ? 'bg-primary' : 'bg-border'}`} />
                  ))}
                </div>
                <button onClick={dismissOnboarding} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center space-y-3">
                <span className="text-4xl">{ONBOARDING_STEPS[onboardingStep].icon}</span>
                <h3 className="text-lg font-semibold text-foreground">{ONBOARDING_STEPS[onboardingStep].title}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {ONBOARDING_STEPS[onboardingStep].desc}
                </p>
              </div>

              <div className="flex gap-2 mt-6">
                {onboardingStep > 0 && (
                  <Button variant="outline" onClick={() => setOnboardingStep(s => s - 1)} className="flex-1 rounded-xl">
                    Back
                  </Button>
                )}
                {onboardingStep < ONBOARDING_STEPS.length - 1 ? (
                  <Button onClick={() => setOnboardingStep(s => s + 1)} className="flex-1 rounded-xl">
                    Next
                  </Button>
                ) : (
                  <Button onClick={dismissOnboarding} className="flex-1 rounded-xl">
                    Got it
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Weekly Availability</h2>
        <p className="text-xs text-muted-foreground">
          Tap a time block to cycle: <span className="text-emerald-400">Available</span> → <span className="text-rose-400">Unavailable</span> → Neutral
        </p>
      </div>

      {/* Week Navigator + Smart Sync */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; })}
          className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-medium text-foreground">{formatDateRange(weekStart)}</span>
        <button
          onClick={() => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; })}
          className="p-2 rounded-lg hover:bg-accent/50 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={applyMondayToWeekdays}
        className="w-full h-8 rounded-xl text-xs border-border/50"
      >
        <Copy className="w-3.5 h-3.5 mr-1.5" />
        Apply Monday → Weekdays
      </Button>

      {/* Time Block Headers */}
      <div className="grid grid-cols-[56px_1fr_1fr_1fr_1fr] gap-1.5 text-center">
        <div />
        {TIME_BLOCKS.map(block => (
          <div key={block.label} className="space-y-0.5">
            <p className="text-[10px] font-medium text-muted-foreground">{block.label}</p>
            <p className="text-[9px] text-muted-foreground/60">{block.range}</p>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="space-y-1.5">
        {DAY_LABELS.map((day, dayIdx) => (
          <div key={day} className="grid grid-cols-[56px_1fr_1fr_1fr_1fr] gap-1.5 items-center border-b border-border/20 pb-1.5">
            <div className="text-center">
              <p className="text-[11px] font-medium text-muted-foreground">{day}</p>
              <p className="text-base font-bold text-foreground">{getDayDate(dayIdx)}</p>
            </div>
            {TIME_BLOCKS.map((_, blockIdx) => {
              const state = slots[getSlotKey(dayIdx, blockIdx)] || 'neutral';
              return (
                <motion.button
                  key={blockIdx}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => cycleSlot(dayIdx, blockIdx)}
                  className={`h-10 rounded-full text-xs font-medium transition-colors duration-200 ${getSlotColor(state)}`}
                >
                  {TIME_BLOCKS[blockIdx].label}
                </motion.button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Save */}
      <motion.div whileTap={{ scale: 0.97 }}>
        <Button onClick={saveAvailability} disabled={saving} className="w-full h-11 rounded-xl">
          {saving ? 'Saving...' : 'Save Availability'}
        </Button>
      </motion.div>

      {/* Help button */}
      <button
        onClick={() => { setOnboardingStep(0); setShowOnboarding(true); }}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
      >
        <Info className="w-3.5 h-3.5" />
        How does this work?
      </button>
    </div>
  );
}
