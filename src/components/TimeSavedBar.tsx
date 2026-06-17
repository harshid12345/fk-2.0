import { motion } from 'framer-motion';
import { Clock, Zap } from 'lucide-react';

interface Props {
  propertyCount: number;
  applicantCount: number;
  lang?: string;
}

// Minutes saved per action — based on typical Dutch rental market manual workload
const MIN_PER_PROPERTY = 30;  // writing & posting listing, sharing link, setup
const MIN_PER_APPLICANT = 20; // reading application, scoring, WhatsApp reply, scheduling

// Milestones at which we celebrate progress
const MILESTONES = [30, 60, 180, 300, 600, 1200, 3000];

function formatTime(minutes: number, nl: boolean): string {
  if (minutes < 60) return nl ? `${minutes} min` : `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return nl ? `${h} uur` : `${h}h`;
  return nl ? `${h}u ${m}m` : `${h}h ${m}m`;
}

function getMilestoneLabel(minutes: number, nl: boolean): string {
  if (minutes >= 3000) return nl ? 'Meer dan 50 uur bespaard 🎉' : 'Over 50 hours saved 🎉';
  if (minutes >= 1200) return nl ? 'Meer dan 20 uur bespaard!' : 'Over 20 hours saved!';
  if (minutes >= 600) return nl ? '10 uur bespaard!' : '10 hours saved!';
  if (minutes >= 300) return nl ? '5 uur bespaard!' : '5 hours saved!';
  return nl ? 'Zo werkt FairKamer voor jou' : 'FairKamer working for you';
}

export default function TimeSavedBar({ propertyCount, applicantCount, lang = 'en' }: Props) {
  const nl = lang === 'nl';
  const totalMinutes = propertyCount * MIN_PER_PROPERTY + applicantCount * MIN_PER_APPLICANT;

  if (totalMinutes === 0) return null;

  const nextMilestone = MILESTONES.find(m => m > totalMinutes) ?? MILESTONES[MILESTONES.length - 1];
  const milestoneIndex = MILESTONES.indexOf(nextMilestone);
  const prevMilestone = milestoneIndex > 0 ? MILESTONES[milestoneIndex - 1] : 0;

  const progress = Math.min(
    100,
    ((totalMinutes - prevMilestone) / (nextMilestone - prevMilestone)) * 100,
  );
  const atMax = totalMinutes >= MILESTONES[MILESTONES.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.4 }}
      className="mx-5 mb-4 rounded-2xl overflow-hidden"
      style={{ background: 'hsl(11 62% 48% / 0.07)', border: '1px solid hsl(11 62% 48% / 0.15)' }}
    >
      <div className="px-4 pt-4 pb-3">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'hsl(11 62% 48% / 0.15)' }}
            >
              <Clock className="w-3.5 h-3.5" style={{ color: 'hsl(11, 62%, 48%)' }} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground leading-tight">
                {nl ? 'Tijd bespaard' : 'Time saved'}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {getMilestoneLabel(totalMinutes, nl)}
              </p>
            </div>
          </div>
          <motion.div
            key={totalMinutes}
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="text-right"
          >
            <p
              className="text-xl font-bold leading-none"
              style={{ color: 'hsl(11, 62%, 48%)' }}
            >
              {formatTime(totalMinutes, nl)}
            </p>
            {atMax && <Zap className="w-3 h-3 ml-auto mt-0.5" style={{ color: 'hsl(11, 62%, 48%)' }} />}
          </motion.div>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full" style={{ background: 'hsl(11 62% 48% / 0.15)' }}>
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: atMax ? '100%' : `${progress}%` }}
            transition={{ duration: 1.1, ease: [0.34, 1.56, 0.64, 1], delay: 0.25 }}
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, hsl(11, 62%, 55%), hsl(11, 62%, 42%))' }}
          />
        </div>

        {/* Sub-labels */}
        {!atMax && (
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-muted-foreground">
              {formatTime(prevMilestone, nl)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {nl ? `Volgende: ${formatTime(nextMilestone, nl)}` : `Next: ${formatTime(nextMilestone, nl)}`}
            </span>
          </div>
        )}

        {/* Breakdown chips */}
        <div className="flex gap-2 mt-3">
          {propertyCount > 0 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'hsl(11 62% 48% / 0.12)', color: 'hsl(11, 62%, 42%)' }}
            >
              {propertyCount} {nl ? (propertyCount === 1 ? 'woning' : 'woningen') : (propertyCount === 1 ? 'property' : 'properties')}
            </span>
          )}
          {applicantCount > 0 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'hsl(11 62% 48% / 0.12)', color: 'hsl(11, 62%, 42%)' }}
            >
              {applicantCount} {nl ? (applicantCount === 1 ? 'aanmelding' : 'aanmeldingen') : (applicantCount === 1 ? 'application' : 'applications')} {nl ? 'gescreend' : 'screened'}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
