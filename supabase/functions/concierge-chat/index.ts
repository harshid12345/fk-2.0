import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

interface ChatRequest {
  concierge_token: string;
  message: string;
  tenant_name?: string;
  preferred_language?: "en" | "nl";
}

interface ClassifyResult {
  category: "trivial" | "needs_attention" | "urgent";
  ai_response: string;
}

async function classifyAndRespond(
  message: string,
  knowledgeBase: string,
  lang: "en" | "nl"
): Promise<ClassifyResult> {
  const systemPrompt = lang === "nl"
    ? `Je bent een vriendelijke huurondersteunings-assistent voor FairKamer, een Nederlands verhuurplatform.
Je taak is: beantwoord de vraag of het probleem van de huurder vriendelijk en bondig, op basis van de kennisbank hieronder.
Classificeer ook het urgentieniveau:
- trivial: kleine vragen, informatieverzoeken (wifi-wachtwoord, huisregels, etc.)
- needs_attention: niet-urgente onderhoudsproblemen of klachten die aandacht nodig hebben
- urgent: veiligheidsrisico's, waterschade, gaslek, schimmel, kapot slot, etc.

Kennisbank voor dit pand:
${knowledgeBase || "Geen kennisbank beschikbaar."}

Antwoord ALLEEN als JSON: {"category": "trivial"|"needs_attention"|"urgent", "ai_response": "<jouw antwoord>"}`
    : `You are a friendly tenant support assistant for FairKamer, a Dutch rental platform.
Your job: answer the tenant's question or issue helpfully and briefly, based on the property knowledge base below.
Also classify the urgency level:
- trivial: small questions, info requests (wifi password, house rules, etc.)
- needs_attention: non-urgent maintenance issues or complaints needing follow-up
- urgent: safety hazards, water damage, gas leak, mould, broken lock, etc.

Property knowledge base:
${knowledgeBase || "No knowledge base available."}

Respond ONLY as JSON: {"category": "trivial"|"needs_attention"|"urgent", "ai_response": "<your response>"}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
      max_tokens: 400,
    }),
  });

  if (!res.ok) {
    console.error("[concierge-chat] AI API error:", res.status, await res.text());
    // Fallback
    return {
      category: "needs_attention",
      ai_response: lang === "nl"
        ? "Bedankt voor je bericht. We hebben het ontvangen en nemen zo snel mogelijk contact op."
        : "Thank you for your message. We've received it and will follow up as soon as possible.",
    };
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(raw);
    return {
      category: ["trivial", "needs_attention", "urgent"].includes(parsed.category)
        ? parsed.category
        : "needs_attention",
      ai_response: parsed.ai_response ?? (lang === "nl" ? "Bericht ontvangen." : "Message received."),
    };
  } catch {
    return {
      category: "needs_attention",
      ai_response: lang === "nl"
        ? "Bedankt voor je bericht. We nemen contact met je op."
        : "Thank you for your message. We'll be in touch.",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { concierge_token, message, tenant_name, preferred_language } =
      (await req.json()) as ChatRequest;

    if (!concierge_token || !message?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing concierge_token or message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Validate token → property
    const { data: property, error: propErr } = await supabase
      .from("landlord_properties")
      .select("id, landlord_id, address, city, knowledge_base_text")
      .eq("concierge_token", concierge_token)
      .single();

    if (propErr || !property) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid support link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lang: "en" | "nl" = preferred_language === "nl" ? "nl" : "en";

    // 2. Classify + generate AI response
    const result = await classifyAndRespond(
      message,
      property.knowledge_base_text ?? "",
      lang
    );

    // 3. Save to tenant_issues
    const { data: issue } = await supabase
      .from("tenant_issues")
      .insert({
        property_id: property.id,
        tenant_name: tenant_name ?? "Unknown tenant",
        message,
        category: result.category,
        ai_response: result.ai_response,
        ai_resolved: result.category === "trivial",
      })
      .select("id")
      .single();

    // 4. If urgent, send SMS to landlord
    if (result.category === "urgent") {
      const { data: landlord } = await supabase
        .from("landlords")
        .select("phone")
        .eq("id", property.landlord_id)
        .single();

      if (landlord?.phone) {
        const address = `${property.address}, ${property.city}`;
        const summary = message.length > 120 ? message.substring(0, 120) + "…" : message;
        await fetch(`${SUPABASE_URL}/functions/v1/sms-send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            to: landlord.phone,
            message: `URGENT issue at ${address}: "${summary}" — FairKamer`,
          }),
        });
      }

      // Create urgent notification
      await supabase.from("notifications").insert({
        landlord_id: property.landlord_id,
        type: "info",
        title: `Urgent issue at ${property.address}`,
        message: message.substring(0, 200),
        ...(issue?.id ? { related_booking_id: null } : {}),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        category: result.category,
        ai_response: result.ai_response,
        issue_id: issue?.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[concierge-chat] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
