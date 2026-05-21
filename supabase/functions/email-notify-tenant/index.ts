import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://landlord.fairkamer.nl";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

interface ProposedSlot {
  start: string;
  end: string;
  label: string;
}

interface NotifyRequest {
  applicantId: string;
  action: "approve" | "reject" | "confirm_booking" | "message";
  slotLabel?: string;
  customMessage?: string;
  proposedSlots?: ProposedSlot[];
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "FairKamer <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend ${res.status}: ${err}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { applicantId, action, slotLabel, customMessage, proposedSlots } =
      (await req.json()) as NotifyRequest;

    // Load applicant + property
    const { data: applicant, error: appErr } = await supabase
      .from("applicants")
      .select("id, full_name, email, preferred_language, schedule_token, property_id, stage")
      .eq("id", applicantId)
      .single();

    if (appErr || !applicant?.email) {
      return new Response(
        JSON.stringify({ success: false, error: "Applicant not found or no email" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: property } = await supabase
      .from("landlord_properties")
      .select("address, city")
      .eq("id", applicant.property_id)
      .single();

    const lang = applicant.preferred_language === "nl" ? "nl" : "en";
    const address = property ? `${property.address}, ${property.city}` : "your property";
    const firstName = applicant.full_name?.split(" ")[0] ?? "there";
    const scheduleUrl = `${APP_BASE_URL}/schedule/${applicant.schedule_token}`;

    let subject = "";
    let html = "";
    let newStage: string | null = null;

    switch (action) {
      case "approve": {
        newStage = "approved";
        subject = lang === "nl"
          ? `Goed nieuws — bezichtiging ${address}`
          : `Good news — viewing at ${address}`;

        if (proposedSlots && proposedSlots.length > 0) {
          // Slot-picker email: show specific times the landlord selected
          const slotButtons = proposedSlots.map(s => {
            const bookUrl = `${scheduleUrl}?slot=${encodeURIComponent(s.start)}&end=${encodeURIComponent(s.end)}`;
            return `<div style="margin:8px 0;"><a href="${bookUrl}" style="display:inline-block;background:#C84B2F;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${s.label}</a></div>`;
          }).join("");

          html = lang === "nl"
            ? `<p>Hoi ${firstName},</p><p>Goed nieuws! De verhuurder wil je uitnodigen voor een bezichtiging van <strong>${address}</strong>.</p><p><strong>Kies een moment dat jou uitkomt:</strong></p>${slotButtons}<p style="font-size:12px;color:#666;">Klik op een tijdstip om je bezichtiging direct te bevestigen.</p><p>— FairKamer</p>`
            : `<p>Hi ${firstName},</p><p>Great news! The landlord would like to invite you to view <strong>${address}</strong>.</p><p><strong>Pick a time that works for you:</strong></p>${slotButtons}<p style="font-size:12px;color:#666;">Click a time to confirm your viewing instantly.</p><p>— FairKamer</p>`;
        } else {
          // Fallback: generic schedule link
          html = lang === "nl"
            ? `<p>Hoi ${firstName},</p><p>Goed nieuws! Je bent uitgenodigd voor een bezichtiging van <strong>${address}</strong>.</p><p><a href="${scheduleUrl}" style="background:#C84B2F;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Plan je bezichtiging</a></p><p>— FairKamer</p>`
            : `<p>Hi ${firstName},</p><p>Great news! You're invited to schedule a viewing at <strong>${address}</strong>.</p><p><a href="${scheduleUrl}" style="background:#C84B2F;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Book your viewing</a></p><p>— FairKamer</p>`;
        }
        break;
      }
      case "reject": {
        newStage = "rejected";
        subject = lang === "nl"
          ? `Update over je aanmelding voor ${address}`
          : `Update on your application for ${address}`;
        html = lang === "nl"
          ? `<p>Hoi ${firstName},</p><p>Bedankt voor je interesse in <strong>${address}</strong>. Helaas hebben we een betere match gevonden. Veel succes met je zoektocht!</p><p>— FairKamer</p>`
          : `<p>Hi ${firstName},</p><p>Thank you for applying to <strong>${address}</strong>. Unfortunately we've selected another candidate. Good luck with your search!</p><p>— FairKamer</p>`;
        break;
      }
      case "confirm_booking": {
        subject = lang === "nl"
          ? `Bezichtiging bevestigd — ${address}`
          : `Viewing confirmed — ${address}`;
        html = lang === "nl"
          ? `<p>Hoi ${firstName},</p><p>Je bezichtiging bij <strong>${address}</strong> is bevestigd voor <strong>${slotLabel ?? "de afgesproken tijd"}</strong>. Tot dan!</p><p>— FairKamer</p>`
          : `<p>Hi ${firstName},</p><p>Your viewing at <strong>${address}</strong> is confirmed for <strong>${slotLabel ?? "the scheduled time"}</strong>. See you there!</p><p>— FairKamer</p>`;
        break;
      }
      case "message": {
        subject = "Message from FairKamer";
        html = `<p>${customMessage ?? ""}</p>`;
        break;
      }
    }

    if (!subject) {
      return new Response(
        JSON.stringify({ success: false, error: "No message to send" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await sendEmail(applicant.email, subject, html);

    if (newStage) {
      await supabase
        .from("applicants")
        .update({ stage: newStage })
        .eq("id", applicantId);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[email-notify-tenant] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
