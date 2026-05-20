import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

interface BookViewingRequest {
  schedule_token: string;
  slot_start: string; // ISO 8601
  slot_end: string;   // ISO 8601
}

async function sendSms(to: string, message: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/sms-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ to, message }),
    });
  } catch (err) {
    console.error("[book-viewing] SMS failed:", err);
  }
}

function formatSlot(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-NL", {
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { schedule_token, slot_start, slot_end } = (await req.json()) as BookViewingRequest;

    // 1. Validate schedule_token → applicant
    const { data: applicant, error: appErr } = await supabase
      .from("applicants")
      .select("id, full_name, phone, preferred_language, property_id, stage")
      .eq("schedule_token", schedule_token)
      .single();

    if (appErr || !applicant) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid scheduling link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (applicant.stage === "viewing_booked") {
      return new Response(
        JSON.stringify({ success: false, error: "Viewing already booked" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Load property + landlord info
    const { data: property } = await supabase
      .from("landlord_properties")
      .select("landlord_id, address, city")
      .eq("id", applicant.property_id)
      .single();

    if (!property) {
      return new Response(
        JSON.stringify({ success: false, error: "Property not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check slot is still available
    const { data: conflict } = await supabase
      .from("viewing_bookings")
      .select("id")
      .eq("landlord_id", property.landlord_id)
      .eq("slot_start", slot_start)
      .not("status", "in", '("cancelled_tenant","cancelled_landlord")')
      .maybeSingle();

    if (conflict) {
      return new Response(
        JSON.stringify({ success: false, error: "Slot no longer available" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Create viewing booking
    const { data: booking, error: bookErr } = await supabase
      .from("viewing_bookings")
      .insert({
        landlord_id: property.landlord_id,
        property_id: applicant.property_id,
        applicant_id: applicant.id,
        slot_start,
        slot_end,
        status: "confirmed",
      })
      .select("id")
      .single();

    if (bookErr || !booking) {
      console.error("[book-viewing] Insert error:", bookErr);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to book slot" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Update applicant stage
    await supabase
      .from("applicants")
      .update({ stage: "viewing_booked", viewing_booked_at: new Date().toISOString() })
      .eq("id", applicant.id);

    // 6. Send SMS to tenant
    const lang = applicant.preferred_language === "nl" ? "nl" : "en";
    const address = `${property.address}, ${property.city}`;
    const slotLabel = formatSlot(slot_start);
    const firstName = applicant.full_name?.split(" ")[0] ?? "there";

    const tenantMsg = lang === "nl"
      ? `Je bezichtiging is bevestigd! 📍 ${address} op ${slotLabel}. Je ontvangt een herinnering de dag ervoor. — FairKamer`
      : `Your viewing is confirmed! 📍 ${address} on ${slotLabel}. You'll get a reminder the day before. — FairKamer`;

    if (applicant.phone) {
      await sendSms(applicant.phone, tenantMsg);
    }

    // 7. Load landlord phone and send SMS to landlord
    const { data: landlord } = await supabase
      .from("landlords")
      .select("phone, full_name")
      .eq("id", property.landlord_id)
      .single();

    if (landlord?.phone) {
      const landlordMsg = `New viewing booked: ${applicant.full_name} at ${address} on ${slotLabel}. — FairKamer`;
      await sendSms(landlord.phone, landlordMsg);
    }

    // 8. Create notification for landlord
    await supabase.from("notifications").insert({
      landlord_id: property.landlord_id,
      type: "booking_confirmed",
      title: `Viewing booked: ${applicant.full_name}`,
      message: `${applicant.full_name} scheduled a viewing at ${address} for ${slotLabel}.`,
      related_booking_id: booking.id,
      related_applicant_id: applicant.id,
    });

    return new Response(
      JSON.stringify({ success: true, booking_id: booking.id, slot_label: slotLabel }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[book-viewing] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
