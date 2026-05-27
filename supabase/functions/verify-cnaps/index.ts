// supabase/functions/verify-cnaps/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// ── À compléter après inspection du site CNAPS ────────────────────────────────
// 1. Ouvrir https://www.cnaps-securite.fr dans un navigateur
// 2. Trouver la page de vérification de carte professionnelle
// 3. Ouvrir DevTools → Réseau, saisir un numéro de carte, soumettre
// 4. Identifier : URL de la requête POST, paramètres du formulaire, texte dans la réponse
// 5. Mettre à jour CNAPS_URL et buildFormData() avec les vraies valeurs
const CNAPS_URL = "https://www.cnaps-securite.fr/verification-carte";
function buildFormData(carteProNumber: string): URLSearchParams {
  const params = new URLSearchParams();
  params.set("numero", carteProNumber); // clé du champ à confirmer via DevTools
  return params;
}
function parseResponse(html: string): "vert" | "rouge" | "a_verifier" {
  const lower = html.toLowerCase();
  if (lower.includes("valide") || lower.includes("en cours de validité")) return "vert";
  if (
    lower.includes("suspendu") ||
    lower.includes("invalide") ||
    lower.includes("expiré") ||
    lower.includes("retiré") ||
    lower.includes("révoqué")
  ) return "rouge";
  return "a_verifier";
}
// ─────────────────────────────────────────────────────────────────────────────

async function verifyCarte(carteNumber: string): Promise<{ statut: "vert" | "rouge" | "a_verifier"; result: string }> {
  try {
    const resp = await fetch(CNAPS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (compatible; AVSecuriteBot/1.0)",
      },
      body: buildFormData(carteNumber).toString(),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return { statut: "a_verifier", result: `HTTP ${resp.status}` };
    const html = await resp.text();
    const statut = parseResponse(html);
    const snippet = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    return { statut, result: snippet };
  } catch (e: any) {
    return { statut: "a_verifier", result: e.message ?? "Erreur réseau" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const CRON_SECRET = Deno.env.get("CRON_SECRET");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const cronSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization") ?? "";
  const isCron = CRON_SECRET && cronSecret === CRON_SECRET;

  if (!isCron) {
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
    const allowed = (roles ?? []).some((r: any) => ["administrateur", "secretaire"].includes(r.role));
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const stagiaireIds: string[] | undefined = body.stagiaire_ids;

  let query = db.from("stagiaires").select("id, carte_pro_number").not("carte_pro_number", "is", null);
  if (stagiaireIds?.length) query = (query as any).in("id", stagiaireIds);
  const { data: agents, error: fetchErr } = await query;

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ id: string; statut: string }> = [];
  const now = new Date().toISOString();

  for (const agent of (agents ?? [])) {
    const { statut, result } = await verifyCarte(agent.carte_pro_number);
    await db.from("stagiaires").update({
      cnaps_statut: statut,
      cnaps_last_checked: now,
      cnaps_last_result: result,
    }).eq("id", agent.id);
    results.push({ id: agent.id, statut });
  }

  return new Response(
    JSON.stringify({ ok: true, processed: results.length, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
