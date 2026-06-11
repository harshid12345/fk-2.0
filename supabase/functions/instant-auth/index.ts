import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const PROFILES: Record<string, { email: string; password: string; name: string }> = {
  dev: {
    email: "dev@fairkamer.test",
    password: "devpass123!",
    name: "Dev User",
  },
  investor: {
    email: "investor@fairkamer.demo",
    password: "investor2026!",
    name: "Investor Demo",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type } = await req.json();
    const profile = PROFILES[type];
    if (!profile) {
      return new Response(JSON.stringify({ error: "Unknown login type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Try creating the user (idempotent — fails silently if already exists)
    const { data: created } = await admin.auth.admin.createUser({
      email: profile.email,
      password: profile.password,
      email_confirm: true,
      user_metadata: { full_name: profile.name },
    });

    let userId = created?.user?.id;

    // 2. If user already existed, find them and reset password to guarantee it matches
    if (!userId) {
      const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existing = users.find((u) => u.email === profile.email);
      if (existing) {
        await admin.auth.admin.updateUserById(existing.id, {
          password: profile.password,
          email_confirm: true,
        });
        userId = existing.id;
      }
    }

    // 3. Ensure a landlords row exists for this user
    if (userId) {
      await admin.from("landlords").upsert(
        { id: userId, full_name: profile.name, email: profile.email },
        { onConflict: "id" }
      );
    }

    // 4. Sign in via password grant and return tokens directly
    const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ email: profile.email, password: profile.password }),
    });

    const tokens = await signInRes.json();

    if (!tokens.access_token) {
      return new Response(
        JSON.stringify({ error: tokens.error_description || "Sign-in failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(tokens), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
