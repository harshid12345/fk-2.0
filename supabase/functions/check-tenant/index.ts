import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ exists: false, profile: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if email exists in auth.users
    const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 2000 });
    const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    // Fetch their most recent application data for prefill
    const { data: applicant } = await admin
      .from("applicants")
      .select("full_name, phone, age, num_occupants, desired_move_in, employment_type, monthly_income_range, smoking, pets, bkr_status, social_platform, social_handle")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const exists = !!authUser || !!applicant;
    const profile = applicant ?? null;

    return new Response(JSON.stringify({ exists, profile }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // On any error, return no account found — don't break the form
    return new Response(JSON.stringify({ exists: false, profile: null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
