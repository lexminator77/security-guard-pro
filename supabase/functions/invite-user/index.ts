import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = ["administrateur", "formateur", "agent", "secretaire", "stagiaire"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non autorisé" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "Non autorisé" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "administrateur" });
    if (!isAdmin) return json({ error: "Réservé aux administrateurs" }, 403);

    const { email, full_name, role, redirect_to } = await req.json();
    if (!email || !role) return json({ error: "email et role requis" }, 400);
    if (!ALLOWED_ROLES.includes(role)) return json({ error: "Rôle invalide" }, 400);

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: full_name ?? email, role },
      redirectTo: redirect_to,
    });

    if (error) return json({ error: error.message }, 400);

    return json({ ok: true, user_id: data.user?.id }, 200);
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
