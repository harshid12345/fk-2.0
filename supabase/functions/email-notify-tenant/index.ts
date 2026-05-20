import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://landlord.fairkamer.nl";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

interface NotifyRequest {
  applicantId: string;
  action: "approve" | "reject" | "confirm_booking" | "message";
  slotLabel?: string;
  customMessage?: string;
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/email-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[email-notify-tenant] Email failed:", err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { applicantId, action, slotLabel, customMessage } =
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
          ? `Goed nieuws over je aanmelding voor ${address}`
          : `Good news about your application for ${address}`;
        html = lang === "nl"
          ? `<p>Hoi ${firstName},</p><p>Goed nieuws! Je bent uitgenodigd voor een bezichtiging van <strong>${address}</strong>.</p><p><a href="${scheduleUrl}" style="background:#C84B2F;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Plan je bezichtiging</a></p><p>— FairKamer</p>`
          : `<p>Hi ${firstName},</p><p>Great news! You're invited to schedule a viewing at <strong>${address}</strong>.</p><p><a href="${scheduleUrl}" style="background:#C84B2F;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Book your viewing</a></p><p>— FairKamer</p>`;
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
