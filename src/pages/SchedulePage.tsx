import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlotInfo {
  applicant_id: string;
  property_id: string;
  full_name: string;
  stage: string;
  address: string;
  city: string;
  landlord_id: string;
}

interface TimeSlot {
  start: string; // ISO
  end: string;   // ISO
  label: string;
}

// ─── Slot generation ──────────────────────────────────────────────────────────

function generateSlots(schedule: any[], takenStarts: Set<string>): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const now = new Date();
  const cutoff = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  for (let d = new Date(now); d <= cutoff; d.setDate(d.getDate() + 1)) {
    const dow = (d.getDay() + 6) % 7; // Monday=0, Sunday=6
    const entry = schedule.find((s: any) => s.day_of_week === dow && s.enabled);
    if (!entry) continue;

    const [startH, startM] = (entry.start_time as string).split(":").map(Number);
    const [endH, endM] = (entry.end_time as string).split(":").map(Number);

    let slotTime = new Date(d);
    slotTime.setHours(startH, startM, 0, 0);
    const dayEnd = new Date(d);
    dayEnd.setHours(endH, endM, 0, 0);

    while (slotTime < dayEnd) {
      const slotEnd = new Date(slotTime.getTime() + 30 * 60 * 1000);
      if (slotEnd > dayEnd) break;
      if (slotTime > now) {
        const isoStart = slotTime.toISOString();
        if (!takenStarts.has(isoStart)) {
          slots.push({
            start: isoStart,
            end: slotEnd.toISOString(),
            label: slotTime.toLocaleString("nl-NL", {
              weekday: "short", day: "numeric", month: "short",
              hour: "2-digit", minute: "2-digit",
              timeZone: "Europe/Amsterdam",
            }),
          });
        }
      }
      slotTime = new Date(slotTime.getTime() + 40 * 60 * 1000); // 30min slot + 10min break
    }
  }
  return slots;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { token } = useParams<{ token: string }>();
  const { lang, setLang, t } = useLanguage();

  const [info, setInfo] = useState<SlotInfo | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selected, setSelected] = useState<TimeSlot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);
  const [doneLabel, setDoneLabel] = useState("");
  const [bookingError, setBookingError] = useState("");

  useEffect(() => {
    if (!token) { setLoadError(t("schedule.invalid_link")); return; }

    const load = async () => {
      // 1. Get applicant by schedule_token
      const { data: applicant, error: appErr } = await supabase
        .from("applicants")
        .select("id, full_name, property_id, stage")
        .eq("schedule_token", token)
        .single();

      if (appErr || !applicant) { setLoadError(t("schedule.invalid_link")); return; }
      if (applicant.stage === "viewing_booked") { setLoadError(t("schedule.already_booked")); return; }

      // 2. Get property + landlord
      const { data: property } = await supabase
        .from("landlord_properties")
        .select("address, city, landlord_id")
        .eq("id", applicant.property_id)
        .single();

      if (!property) { setLoadError(t("schedule.invalid_link")); return; }

      setInfo({
        applicant_id: applicant.id,
        property_id: applicant.property_id,
        full_name: applicant.full_name,
        stage: applicant.stage,
        address: property.address,
        city: property.city,
        landlord_id: property.landlord_id,
      });

      // 3. Load availability schedule
      const { data: schedule } = await supabase
        .from("viewing_schedule")
        .select("day_of_week, start_time, end_time, enabled")
        .eq("landlord_id", property.landlord_id);

      // 4. Load existing bookings (to exclude taken slots)
      const { data: existing } = await supabase
        .from("viewing_bookings")
        .select("slot_start")
        .eq("landlord_id", property.landlord_id)
        .not("status", "in", '("cancelled_tenant","cancelled_landlord")')
        .gte("slot_start", new Date().toISOString());

      const takenStarts = new Set<string>((existing || []).map((b: any) => b.slot_start));
      const generated = generateSlots(schedule || [], takenStarts);
      setSlots(generated);
    };

    load();
  }, [token]);

  async function confirmBooking() {
    if (!selected || !info) return;
    setBooking(true);
    setBookingError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/book-viewing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_token: token,
          slot_start: selected.start,
          slot_end: selected.end,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDoneLabel(data.slot_label || selected.label);
        setDone(true);
      } else if (res.status === 409) {
        setBookingError(t("schedule.slot_taken"));
        setSelected(null);
        // Refresh slots
        setSlots((prev) => prev.filter((s) => s.start !== selected.start));
      } else {
        setBookingError(t("schedule.error"));
      }
    } catch {
      setBookingError(t("schedule.error"));
    }
    setBooking(false);
  }

  // ─── Error / Done states ───────────────────────────────────────────────────

  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">📅</div>
          <p className="text-muted-foreground">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground mb-3">
            {t("schedule.success_title")}
          </h1>
          <p className="text-foreground font-medium mb-2">{doneLabel}</p>
          <p className="text-muted-foreground mb-6">{t("schedule.success_body")}</p>
          <p className="text-xs text-muted-foreground">Powered by FairKamer</p>
        </div>
      </div>
    );
  }

  // ─── Slot picker ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 pt-4 pb-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <h1 className="font-serif font-bold text-lg text-foreground">{t("schedule.title")}</h1>
            <p className="text-xs text-muted-foreground">{info.address}, {info.city}</p>
          </div>
          <button
            onClick={() => setLang(lang === "en" ? "nl" : "en")}
            className="text-xs px-2 py-1 rounded-md border border-border text-muted-foreground"
          >
            {lang === "en" ? "NL" : "EN"}
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <p className="text-sm text-muted-foreground mb-4">{t("schedule.subtitle")}</p>

        {slots.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-muted-foreground">{t("schedule.no_slots")}</p>
          </div>
        )}

        {/* Slot list */}
        <div className="space-y-2 mb-6">
          {slots.map((slot) => {
            const isSelected = selected?.start === slot.start;
            return (
              <button
                key={slot.start}
                type="button"
                onClick={() => { setSelected(isSelected ? null : slot); setBookingError(""); }}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all
                  ${isSelected
                    ? "border-[#C84B2F] bg-[#C84B2F]/10"
                    : "border-border bg-card hover:border-[#C84B2F]/50"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground capitalize">{slot.label}</span>
                  {isSelected && (
                    <span className="text-xs font-medium text-[#C84B2F]">
                      {t("schedule.selected")}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {bookingError && (
          <p className="text-sm text-destructive mb-4">{bookingError}</p>
        )}

        {selected && (
          <Button
            className="w-full bg-[#C84B2F] hover:bg-[#b03f26] text-white h-12 text-base"
            onClick={confirmBooking}
            disabled={booking}
          >
            {booking ? t("schedule.booking") : t("schedule.confirm_slot")}
          </Button>
        )}
      </div>
    </div>
  );
}
