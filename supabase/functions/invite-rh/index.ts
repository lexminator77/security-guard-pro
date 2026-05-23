import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!ANON_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller } } = await callerClient.auth.getUser();
  if (!caller) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: roleRow } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .eq("role", "administrateur")
    .maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { email?: string; entreprise_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { email, entreprise_id } = body;
  if (!email || !entreprise_id) {
    return new Response(JSON.stringify({ error: "email and entreprise_id are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: entreprise, error: entErr } = await adminClient
    .from("entreprises")
    .select("id")
    .eq("id", entreprise_id)
    .maybeSingle();
  if (entErr || !entreprise) {
    return new Response(JSON.stringify({ error: "Company not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:8081";
  const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${SITE_URL}/reset-password`,
  });
  if (inviteErr) {
    return new Response(JSON.stringify({ error: inviteErr.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = inviteData.user.id;

  const { error: roleErr } = await adminClient.from("user_roles").upsert(
    { user_id: userId, role: "rh" },
    { onConflict: "user_id,role" }
  );
  if (roleErr) {
    return new Response(JSON.stringify({ error: "Failed to assign role: " + roleErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: linkErr } = await adminClient.from("entreprise_rh").upsert(
    { user_id: userId, entreprise_id, email },
    { onConflict: "user_id" }
  );
  if (linkErr) {
    return new Response(JSON.stringify({ error: "Failed to link company: " + linkErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, user_id: userId }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
