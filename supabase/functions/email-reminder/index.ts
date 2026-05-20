import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HOUR_MS = 60 * 60 * 1000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/email-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ to, subject, html }),
    });
    return res.ok;
  } catch (err) {
    console.error("[email-reminder] Email send error:", err);
    return false;
  }
}

function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString("en-NL", {
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam",
  });
}

function getDueStage(booking: any, now: Date): "48h" | "24h" | "2h" | null {
  const hoursUntil = (new Date(booking.slot_start).getTime() - now.getTime()) / HOUR_MS;
  if (hoursUntil <= 0) return null;
  if (hoursUntil <= 2  && !booking.reminder_2h_sent_at) return "2h";
  if (hoursUntil <= 24 && !booking.reminder_24h_sent_at) return "24h";
  if (hoursUntil <= 48 && hoursUntil > 24 && !booking.tenant_confirmed_3d) return "48h";
  return null;
}

async function createNotification(supabase: any, payload: object) {
  await supabase.from("notifications").insert(payload);
}

async function sendDueReminders(supabase: any, now: Date, actions: string[]) {
  const cutoff = new Date(now.getTime() + 72 * HOUR_MS).toISOString();

  const { data: bookings, error } = await supabase
    .from("viewing_bookings")
    .select("id, applicant_id, landlord_id, property_id, slot_start, slot_end, status, reminder_24h_sent_at, reminder_2h_sent_at, tenant_confirmed_3d")
    .eq("status", "confirmed")
    .gt("slot_start", now.toISOString())
    .lte("slot_start", cutoff)
    .order("slot_start", { ascending: true });

  if (error) throw new Error(`Load bookings: ${error.message}`);
  if (!bookings?.length) return;

  const appIds = [...new Set(bookings.map((b: any) => b.applicant_id))];
  const propIds = [...new Set(bookings.map((b: any) => b.property_id))];

  const [{ data: applicants }, { data: properties }] = await Promise.all([
    supabase.from("applicants").select("id, full_name, email, preferred_language").in("id", appIds),
    supabase.from("landlord_properties").select("id, address, city, landlord_id").in("id", propIds),
  ]);

  const appMap = new Map((applicants || []).map((a: any) => [a.id, a]));
  const propMap = new Map((properties || []).map((p: any) => [p.id, p]));

  const landlordIds = [...new Set((properties || []).map((p: any) => p.landlord_id))];
  const { data: landlords } = await supabase
    .from("landlords")
    .select("id, email")
    .in("id", landlordIds);
  const landlordMap = new Map((landlords || []).map((l: any) => [l.id, l]));

  for (const booking of bookings) {
    const applicant = appMap.get(booking.applicant_id) as any;
    const property = propMap.get(booking.property_id) as any;
    if (!applicant || !property) continue;

    const stage = getDueStage(booking, now);
    if (!stage) continue;

    const slotLabel = formatSlot(booking.slot_start);
    const address = `${property.address}, ${property.city}`;
    const lang = applicant.preferred_language === "nl" ? "nl" : "en";
    const firstName = applicant.full_name?.split(" ")[0] ?? "there";

    if (applicant.email) {
      let subject = "";
      let html = "";

      if (stage === "48h") {
        subject = lang === "nl" ? `Herinnering: bezichtiging over 2 dagen` : `Reminder: viewing in 2 days`;
        html = lang === "nl"
          ? `<p>Hoi ${firstName},</p><p>Herinnering: je bezichtiging bij <strong>${address}</strong> is over 2 dagen op <strong>${slotLabel}</strong>.</p><p>— FairKamer</p>`
          : `<p>Hi ${firstName},</p><p>Heads up: your viewing at <strong>${address}</strong> is in 2 days on <strong>${slotLabel}</strong>.</p><p>— FairKamer</p>`;
      } else if (stage === "24h") {
        subject = lang === "nl" ? `Herinnering: bezichtiging morgen` : `Reminder: viewing tomorrow`;
        html = lang === "nl"
          ? `<p>Hoi ${firstName},</p><p>Je bezichtiging bij <strong>${address}</strong> is morgen om <strong>${slotLabel}</strong>. Tot dan!</p><p>— FairKamer</p>`
          : `<p>Hi ${firstName},</p><p>Your viewing at <strong>${address}</strong> is tomorrow at <strong>${slotLabel}</strong>. See you then!</p><p>— FairKamer</p>`;
      } else if (stage === "2h") {
        subject = lang === "nl" ? `Je bezichtiging begint over 2 uur` : `Your viewing starts in 2 hours`;
        html = lang === "nl"
          ? `<p>Hoi ${firstName},</p><p>Je bezichtiging bij <strong>${address}</strong> begint over 2 uur (${slotLabel}).</p><p>— FairKamer</p>`
          : `<p>Hi ${firstName},</p><p>Quick reminder: your viewing at <strong>${address}</strong> starts in 2 hours (${slotLabel}).</p><p>— FairKamer</p>`;
      }

      const sent = await sendEmail(applicant.email, subject, html);
      if (!sent) {
        await createNotification(supabase, {
          landlord_id: booking.landlord_id,
          type: "reminder_delivery_failed",
          title: "Email reminder could not be sent",
          message: `Failed to send ${stage} reminder to ${applicant.full_name} for ${address}.`,
          related_booking_id: booking.id,
          related_applicant_id: applicant.id,
        });
        actions.push(`${stage} reminder email failed for booking ${booking.id}`);
        continue;
      }
    }

    // Email to landlord at 24h
    if (stage === "24h") {
      const landlord = landlordMap.get(property.landlord_id) as any;
      if (landlord?.email) {
        await sendEmail(
          landlord.email,
          `Reminder: viewing tomorrow — ${applicant.full_name}`,
          `<p>Reminder: <strong>${applicant.full_name}</strong> has a viewing at <strong>${address}</strong> tomorrow at <strong>${slotLabel}</strong>.</p><p>— FairKamer</p>`
        );
      }
    }

    const patch: Record<string, unknown> = {};
    if (stage === "48h") patch.tenant_confirmed_3d = true;
    if (stage === "24h") patch.reminder_24h_sent_at = now.toISOString();
    if (stage === "2h") patch.reminder_2h_sent_at = now.toISOString();
    await supabase.from("viewing_bookings").update(patch).eq("id", booking.id);

    actions.push(`${stage} email reminder sent for booking ${booking.id}`);
  }
}

async function processNoResponses(supabase: any, now: Date, actions: string[]) {
  const noResponseCutoff = new Date(now.getTime() - 10 * HOUR_MS).toISOString();

  const { data: bookings } = await supabase
    .from("viewing_bookings")
    .select("id, applicant_id, landlord_id, property_id, slot_start, reminder_24h_sent_at, reminder_24h_response")
    .eq("status", "confirmed")
    .not("reminder_24h_sent_at", "is", null)
    .is("reminder_24h_response", null)
    .lte("reminder_24h_sent_at", noResponseCutoff)
    .gt("slot_start", now.toISOString());

  for (const booking of (bookings || [])) {
    await supabase.from("viewing_bookings").update({
      status: "cancelled_tenant",
      cancelled_at: now.toISOString(),
    }).eq("id", booking.id);

    const { data: applicant } = await supabase
      .from("applicants")
      .select("id, full_name, match_score, no_response_count, match_flags")
      .eq("id", booking.applicant_id)
      .single();

    if (applicant) {
      const flags = Array.isArray(applicant.match_flags) ? applicant.match_flags : [];
      flags.push("Reliability warning: no-show (did not respond to 24h reminder)");
      await supabase.from("applicants").update({
        match_score: Math.max(0, (applicant.match_score || 0) - 5),
        no_response_count: (applicant.no_response_count || 0) + 1,
        match_flags: flags,
        stage: "approved",
      }).eq("id", booking.applicant_id);
    }

    await createNotification(supabase, {
      landlord_id: booking.landlord_id,
      type: "cancellation",
      title: "Viewing cancelled — no response",
      message: `${applicant?.full_name ?? "Applicant"} did not respond to the reminder and the viewing has been cancelled.`,
      related_booking_id: booking.id,
      related_applicant_id: booking.applicant_id,
    });

    actions.push(`Cancelled booking ${booking.id} — no response`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const now = new Date();
  const actions: string[] = [];

  try {
    await sendDueReminders(supabase, now, actions);
    await processNoResponses(supabase, now, actions);

    return new Response(JSON.stringify({ ok: true, actions }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[email-reminder] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
