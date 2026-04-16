import { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Building2, Users, Calendar as CalIcon, Settings, Bell, ChevronLeft, ChevronRight, X, Hand, Send } from 'lucide-react';

const STORAGE_KEY = 'fk_onboarding_completed_v1';

interface Slide {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: Hand,
    title: 'Welcome to FairKamer',
    body: 'A quick tour. Swipe left or right to move between steps, or use the arrows.',
  },
  {
    icon: Building2,
    title: 'Properties',
    body: 'Add and manage every listing here. Open a property to edit details, upload documents, and track applicants.',
  },
  {
    icon: Users,
    title: 'Applicants',
    body: 'See everyone who applied through your screening bot. Sorted by match score so the best fit is on top.',
  },
  {
    icon: CalIcon,
    title: 'Calendar',
    body: 'Set your weekly viewing availability and review confirmed bookings. The bot uses these slots to schedule tenants.',
  },
  {
    icon: Bell,
    title: 'Notifications',
    body: 'Tap the bell on the top right for new applicants, viewing confirmations, and tenant issues that need a reply.',
  },
  {
    icon: Settings,
    title: 'Settings',
    body: 'Update your profile, language, and connection preferences. Manage Telegram and integrations from here.',
  },
  {
    icon: Send,
    title: 'Share your screening bot',
    body: 'Open any property, tap Copy bot link, and share it on Funda, Marktplaats, or directly with prospects. Applicants chat with the bot, get screened, and book viewings automatically.',
  },
];

export default function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  };

  const next = () => {
    if (index < SLIDES.length - 1) setIndex(index + 1);
    else close();
  };
  const prev = () => index > 0 && setIndex(index - 1);

  const handleSwipe = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 60 && Math.abs(info.velocity.x) > 100) {
      if (info.offset.x < 0) next();
      else prev();
    }
  };

  if (!open) return null;
  const slide = SLIDES[index];
  const Icon = slide.icon;
  const isLast = index === SLIDES.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-foreground/40 backdrop-blur-md flex items-center justify-center p-5"
      >
        <motion.div
          initial={{ scale: 0.92, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleSwipe}
          className="relative w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-2xl"
        >
          <button
            onClick={close}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Skip tour"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center justify-between mb-5 pr-8">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Step {index + 1} of {SLIDES.length}
            </span>
            <button
              onClick={close}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="min-h-[180px]"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2 leading-tight">
                {slide.title}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {slide.body}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 my-5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/30'
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={prev}
              disabled={index === 0}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-0 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={next}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {isLast ? 'Get started' : 'Next'}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
