import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUESTIONNAIRE_SUBJECTS: Record<string, string> = {
  positionnement: "Questionnaire de positionnement — SecureCRM",
  satisfaction_chaud: "Questionnaire de satisfaction — SecureCRM",
  satisfaction_froid: "Questionnaire de satisfaction (bilan) — SecureCRM",
};

const QUESTIONNAIRE_LABELS: Record<string, string> = {
  positionnement: "positionnement d'entrée",
  satisfaction_chaud: "satisfaction à chaud",
  satisfaction_froid: "satisfaction à froid (30 jours après la formation)",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:8081";
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@securecrm.fr";

  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY || !RESEND_API_KEY) {
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
    .in("role", ["administrateur", "secretaire"])
    .maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { formation_id?: string; stagiaire_ids?: string[]; type?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { formation_id, stagiaire_ids, type } = body;
  if (!formation_id || !stagiaire_ids?.length || !type) {
    return new Response(JSON.stringify({ error: "formation_id, stagiaire_ids, and type are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: formation } = await adminClient
    .from("formations")
    .select("title")
    .eq("id", formation_id)
    .maybeSingle();
  if (!formation) {
    return new Response(JSON.stringify({ error: "Formation not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const stagiaire_id of stagiaire_ids) {
    const { data: stagiaire } = await adminClient
      .from("stagiaires")
      .select("first_name, last_name, email")
      .eq("id", stagiaire_id)
      .maybeSingle();

    if (!stagiaire?.email) { errors.push(`${stagiaire_id}: no email`); continue; }

    // Preserve completed_at/reponses if already answered — only update sent_at
    const { data: existing } = await adminClient
      .from("questionnaire_tokens")
      .select("id, token")
      .eq("formation_id", formation_id)
      .eq("stagiaire_id", stagiaire_id)
      .eq("type", type)
      .maybeSingle();

    let tokenValue: string;
    if (existing) {
      await adminClient.from("questionnaire_tokens").update({ sent_at: new Date().toISOString() }).eq("id", existing.id);
      tokenValue = existing.token;
    } else {
      const { data: created, error: insertErr } = await adminClient
        .from("questionnaire_tokens")
        .insert({ formation_id, stagiaire_id, type })
        .select("token")
        .single();
      if (insertErr || !created) { errors.push(`${stagiaire_id}: insert failed`); continue; }
      tokenValue = created.token;
    }

    const link = `${SITE_URL}/q/${tokenValue}`;
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: stagiaire.email,
        subject: QUESTIONNAIRE_SUBJECTS[type] ?? "Questionnaire — SecureCRM",
        html: `<p>Bonjour ${stagiaire.first_name},</p>
<p>Merci de remplir votre questionnaire de ${QUESTIONNAIRE_LABELS[type] ?? type} pour la formation <strong>${formation.title}</strong>.</p>
<p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Remplir le questionnaire</a></p>
<p style="font-size:12px;color:#888;">Lien : ${link}</p>`,
      }),
    });

    if (!emailRes.ok) { errors.push(`${stagiaire_id}: email failed`); continue; }
    sent++;
  }

  return new Response(
    JSON.stringify({ ok: true, sent, errors }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
