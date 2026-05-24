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

  let body: { token?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (typeof body.token !== "string") {
    return new Response(JSON.stringify({ error: "token must be a string" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: row } = await adminClient
    .from("questionnaire_tokens")
    .select("type, completed_at, formation_id, stagiaire_id")
    .eq("token", body.token)
    .maybeSingle();

  if (!row) {
    return new Response(JSON.stringify({ error: "Token not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (row.completed_at) {
    return new Response(JSON.stringify({ error: "Already completed" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const [{ data: formation }, { data: stagiaire }] = await Promise.all([
    adminClient.from("formations").select("title").eq("id", row.formation_id).maybeSingle(),
    adminClient.from("stagiaires").select("first_name, last_name").eq("id", row.stagiaire_id).maybeSingle(),
  ]);

  return new Response(
    JSON.stringify({
      type: row.type,
      formation_title: formation?.title ?? "",
      stagiaire_name: stagiaire ? `${stagiaire.first_name} ${stagiaire.last_name}` : "",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
