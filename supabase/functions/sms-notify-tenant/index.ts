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
  bookingId?: string;
  slotLabel?: string;  // e.g. "Monday 26 May at 14:00"
  customMessage?: string;
}

async function sendSms(to: string, message: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sms-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ to, message }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[sms-notify-tenant] SMS failed:", err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { applicantId, action, bookingId, slotLabel, customMessage } =
      (await req.json()) as NotifyRequest;

    // Load applicant + property
    const { data: applicant, error: appErr } = await supabase
      .from("applicants")
      .select("id, full_name, phone, preferred_language, schedule_token, property_id, stage")
      .eq("id", applicantId)
      .single();

    if (appErr || !applicant?.phone) {
      return new Response(
        JSON.stringify({ success: false, error: "Applicant not found or no phone" }),
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

    let message = "";
    let newStage: string | null = null;

    switch (action) {
      case "approve": {
        newStage = "approved";
        message = lang === "nl"
          ? `Goed nieuws, ${firstName}! Je bent uitgenodigd voor een bezichtiging van ${address}. Plan je moment hier: ${scheduleUrl} — FairKamer`
          : `Great news, ${firstName}! You're invited to schedule a viewing at ${address}. Pick your slot here: ${scheduleUrl} — FairKamer`;
        break;
      }
      case "reject": {
        newStage = "rejected";
        message = lang === "nl"
          ? `Hallo ${firstName}, bedankt voor je interesse in ${address}. Helaas hebben we een betere match gevonden. Veel succes! — FairKamer`
          : `Hi ${firstName}, thank you for applying to ${address}. Unfortunately we've found a better match. Good luck with your search! — FairKamer`;
        break;
      }
      case "confirm_booking": {
        message = lang === "nl"
          ? `Je bezichtiging is bevestigd! 📍 ${address} — ${slotLabel ?? "Zie je dan"}. Tot dan! — FairKamer`
          : `Your viewing is confirmed! 📍 ${address} — ${slotLabel ?? "See you then"}. See you there! — FairKamer`;
        break;
      }
      case "message": {
        message = customMessage ?? "";
        break;
      }
    }

    if (!message) {
      return new Response(
        JSON.stringify({ success: false, error: "No message to send" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await sendSms(applicant.phone, message);

    // Update stage if needed
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
    console.error("[sms-notify-tenant] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
