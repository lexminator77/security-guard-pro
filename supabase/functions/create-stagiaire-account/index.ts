// supabase/functions/create-stagiaire-account/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function capitalize(s: string): string {
  if (!s) return "User";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function generatePassword(firstName: string): string {
  const base = capitalize(firstName.replace(/\s+/g, "").slice(0, 10));
  const digits = Math.floor(1000 + Math.random() * 9000).toString();
  const pwd = base + digits;
  return pwd.length >= 8 ? pwd : pwd + Math.floor(1000 + Math.random() * 9000).toString();
}

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

  let body: { stagiaire_id?: string; formation_id?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { stagiaire_id, formation_id } = body;
  if (!stagiaire_id || !formation_id) {
    return new Response(JSON.stringify({ error: "stagiaire_id and formation_id are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: stagiaire } = await adminClient
    .from("stagiaires")
    .select("id, first_name, last_name, email, auth_user_id")
    .eq("id", stagiaire_id)
    .maybeSingle();

  if (!stagiaire) {
    return new Response(JSON.stringify({ error: "Stagiaire not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!stagiaire.email) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "no_email" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (stagiaire.auth_user_id) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "already_exists" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: formation } = await adminClient
    .from("formations")
    .select("title, start_date")
    .eq("id", formation_id)
    .maybeSingle();

  const password = generatePassword(stagiaire.first_name);

  let userId: string;
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email: stagiaire.email,
    password,
    email_confirm: true,
  });

  if (createErr) {
    // Account may already exist in Auth but not linked — find and link it
    const { data: { users } } = await adminClient.auth.admin.listUsers();
    const existing = users.find((u) => u.email === stagiaire.email);
    if (!existing) {
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = existing.id;
  } else {
    userId = created.user.id;
  }

  await adminClient.from("user_roles").upsert(
    { user_id: userId, role: "stagiaire" },
    { onConflict: "user_id,role" }
  );

  await adminClient.from("stagiaires").update({ auth_user_id: userId }).eq("id", stagiaire_id);

  const startDateFr = formation?.start_date
    ? new Date(formation.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: stagiaire.email,
      subject: `Votre accès formation — ${formation?.title ?? "SecureCRM"}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:auto">
        <h2>Bonjour ${stagiaire.first_name},</h2>
        <p>Votre compte a été créé pour la formation <strong>${formation?.title ?? ""}</strong>${startDateFr ? ` débutant le ${startDateFr}` : ""}.</p>
        <p>Voici vos identifiants de connexion :</p>
        <ul>
          <li><strong>Email :</strong> ${stagiaire.email}</li>
          <li><strong>Mot de passe temporaire :</strong> <code style="background:#f0f0f0;padding:2px 6px;border-radius:4px">${password}</code></li>
        </ul>
        <p><a href="${SITE_URL}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Accéder à mon espace</a></p>
        <p style="font-size:12px;color:#888">Nous vous recommandons de changer votre mot de passe dès votre première connexion via l'onglet Paramètres.</p>
      </div>`,
    }),
  });

  return new Response(
    JSON.stringify({ ok: true, user_id: userId }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
