import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

interface ApplicationPayload {
  application_token: string;
  // Tenant intake
  phone: string;
  email?: string;
  full_name: string;
  age: number;
  gender: string;
  // Screening answers
  num_occupants: string;
  desired_move_in: string;
  employment_type: string;
  monthly_income_range: string;
  desired_lease_length: string;
  smoking: string;
  pets: string;
  bkr_status: string;
  // Optional
  social_handle?: string;
  consent_given: boolean;
  preferred_language: "en" | "nl";
}

// Inline match score calculation (duplicates logic from matchScore.ts)
function getIncomeEstimate(range: string | null): number {
  switch (range) {
    case "Under €1,500": return 1250;
    case "€1,500 - €2,500": return 2000;
    case "€2,500 - €3,500": return 3000;
    case "€3,500 - €5,000": return 4250;
    case "€5,000+": return 5500;
    default: return 0;
  }
}

function getOccupantNumber(text: string | null): number {
  switch (text) {
    case "Just me": return 1;
    case "2 people": return 2;
    case "3 people": return 3;
    case "4+": return 4;
    default: return 1;
  }
}

function calculateInitialScore(payload: ApplicationPayload, criteria: any, rent: number) {
  const flags: string[] = [];
  const smoking = payload.smoking;
  const pets = payload.pets;
  const incomeEstimate = getIncomeEstimate(payload.monthly_income_range);

  const smokingMap: Record<string, string> = {
    "smoke_yes": "Yes", "smoke_no": "No", "smoke_outside": "Outside only",
    "yes": "Yes", "no": "No", "social": "Outside only",
    "No": "No", "Outside only": "Outside only", "Yes": "Yes",
  };
  const resolvedSmoking = smokingMap[smoking?.toLowerCase?.()] || smoking;

  const petsMap: Record<string, string> = {
    "none": "No pets", "cat": "Cat", "dog": "Dog", "other": "Other",
    "None": "No pets", "Cat": "Cat", "Dog": "Dog", "Other": "Other",
  };
  const resolvedPets = petsMap[pets?.toLowerCase?.()] || pets;

  // Hard disqualifiers
  if (criteria?.smoking_allowed === "No" && resolvedSmoking === "Yes") {
    return { score: 0, label: "Disqualified", hardDisqualified: true, hardDisqualifyReason: "Smoking not allowed", flags: [] };
  }
  if (criteria?.pets_allowed === "No" && resolvedPets !== "No pets" && resolvedPets) {
    return { score: 0, label: "Disqualified", hardDisqualified: true, hardDisqualifyReason: "Pets not allowed", flags: [] };
  }
  if (incomeEstimate > 0 && incomeEstimate < rent * 2) {
    return { score: 0, label: "Disqualified", hardDisqualified: true, hardDisqualifyReason: "Income below 2x rent", flags: [] };
  }
  if (payload.bkr_status === "Yes, I can explain") {
    return { score: 0, label: "Disqualified", hardDisqualified: true, hardDisqualifyReason: "BKR history reported", flags: [] };
  }

  // Preference score (max 4)
  let preferenceScore = 0;
  if (criteria?.smoking_allowed === "Yes" || resolvedSmoking === "No") preferenceScore += 1;
  else if (criteria?.smoking_allowed === "Outside only" && resolvedSmoking === "Outside only") preferenceScore += 1;
  else { preferenceScore -= 1; flags.push("Smoking preference mismatch"); }

  if (criteria?.pets_allowed === "Yes" || resolvedPets === "No pets" || !resolvedPets) preferenceScore += 1;
  else if (criteria?.pets_allowed === "Negotiable") { preferenceScore += 0.5; flags.push("Tenant has pets — landlord says negotiable"); }
  else { preferenceScore -= 1; flags.push("Pets preference mismatch"); }

  const occupants = getOccupantNumber(payload.num_occupants);
  if (occupants <= (criteria?.max_occupants || 1)) preferenceScore += 1;
  else { preferenceScore -= 1; flags.push("Too many occupants"); }

  if (payload.desired_move_in === "This month" || payload.desired_move_in === "Next month") preferenceScore += 1;
  else if (payload.desired_move_in === "Flexible") preferenceScore += 0.5;
  else { preferenceScore -= 0.5; flags.push("Move-in timing mismatch"); }

  preferenceScore = Math.max(0, Math.min(4, preferenceScore));

  // Financial score (max 4)
  let financialScore = 0;
  const ratio = rent > 0 ? incomeEstimate / rent : 0;
  if (ratio >= 3) financialScore += 2.0;
  else if (ratio >= 2.5) financialScore += 1.0;

  switch (payload.employment_type) {
    case "Loondienst (employed)": financialScore += 1.0; break;
    case "ZZP (self-employed)": financialScore += 0.25; break;
    case "Student": case "Uitkering (benefits)": financialScore += 0.25; flags.push("Limited financial stability"); break;
    default: financialScore += 0.25;
  }
  financialScore += 0.5; // clean BKR assumed
  financialScore = Math.max(0, Math.min(4, financialScore));

  // Scrape score: no data yet → 1.0 placeholder
  const scrapedScore = 1.0;

  const totalScore = Math.round((preferenceScore + financialScore + scrapedScore) * 10) / 10;
  let label = "Weak match";
  if (totalScore >= 8.5) label = "Strong match";
  else if (totalScore >= 6.5) label = "Good match";
  else if (totalScore >= 4.5) label = "Moderate match";

  return { score: totalScore, label, hardDisqualified: false, hardDisqualifyReason: null, flags };
}

async function callEmailSend(to: string, subject: string, html: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/email-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ to, subject, html }),
    });
  } catch (err) {
    console.error("[submit-application] Email send failed:", err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const payload = (await req.json()) as ApplicationPayload;

    // 1. Validate application_token → get property
    const { data: property, error: propErr } = await supabase
      .from("landlord_properties")
      .select("id, landlord_id, address, city, rent_amount, application_token")
      .eq("application_token", payload.application_token)
      .single();

    if (propErr || !property) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid application link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Load landlord criteria for match scoring
    const { data: criteria } = await supabase
      .from("landlord_criteria")
      .select("*")
      .eq("property_id", property.id)
      .single();

    // 3. Calculate initial match score
    const scoreResult = calculateInitialScore(payload, criteria, property.rent_amount || 0);

    // 4. Upsert applicant (by phone + property_id to support resume)
    const applicantData = {
      property_id: property.id,
      phone: payload.phone,
      email: payload.email || null,
      full_name: payload.full_name,
      age: payload.age,
      gender: payload.gender,
      num_occupants: payload.num_occupants,
      desired_move_in: payload.desired_move_in,
      employment_type: payload.employment_type,
      desired_lease_length: payload.desired_lease_length,
      bkr_status: payload.bkr_status,
      social_handle: payload.social_handle || null,
      consent_given: payload.consent_given,
      preferred_language: payload.preferred_language,
      stage: "new",
      // Direct columns (added in migration 20260521000002)
      smoking: payload.smoking || null,
      pets: payload.pets || null,
      monthly_income_range: payload.monthly_income_range || null,
      lifestyle_answers: {
        smoking: payload.smoking,
        pets: payload.pets,
        income_range: payload.monthly_income_range,
      },
      match_score: Math.round(scoreResult.score * 10) / 10,
      match_label: scoreResult.label,
      match_flags: scoreResult.flags,
      hard_disqualified: scoreResult.hardDisqualified,
      hard_disqualify_reason: scoreResult.hardDisqualifyReason ?? null,
    };

    const { data: applicant, error: insertErr } = await supabase
      .from("applicants")
      .upsert(applicantData, { onConflict: 'property_id,phone' })
      .select("id, schedule_token")
      .single();

    if (insertErr || !applicant) {
      console.error("[submit-application] Insert error:", insertErr);
      return new Response(
        JSON.stringify({ success: false, error: insertErr?.message ?? "Failed to save application" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Trigger social media scrape (fire and forget)
    fetch(`${SUPABASE_URL}/functions/v1/social-media-scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ applicantId: applicant.id }),
    }).catch((err) => console.error("[submit-application] Scrape trigger failed:", err));

    // 6. Send email confirmation to tenant
    const address = `${property.address}, ${property.city}`;
    if (payload.email) {
      const firstName = payload.full_name.split(" ")[0];
      const subject = payload.preferred_language === "nl"
        ? `Je aanmelding voor ${address} — FairKamer`
        : `Your application for ${address} — FairKamer`;
      const html = payload.preferred_language === "nl"
        ? `<p>Hoi ${firstName},</p><p>We hebben je aanmelding voor <strong>${address}</strong> ontvangen. Je hoort snel van ons!</p><p>— FairKamer</p>`
        : `<p>Hi ${firstName},</p><p>We received your application for <strong>${address}</strong>. We'll be in touch soon!</p><p>— FairKamer</p>`;
      await callEmailSend(payload.email, subject, html);
    }

    // 7. Create notification for landlord
    await supabase.from("notifications").insert({
      landlord_id: property.landlord_id,
      type: "info",
      title: `New application: ${payload.full_name}`,
      message: `${payload.full_name} applied for ${address}. Match score: ${scoreResult.score}/10.`,
    });

    return new Response(
      JSON.stringify({ success: true, applicant_id: applicant.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[submit-application] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
