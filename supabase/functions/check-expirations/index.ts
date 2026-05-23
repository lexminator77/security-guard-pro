// supabase/functions/check-expirations/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@3.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RECYCLAGE_TYPE: Record<string, string> = {
  sst: "mac_sst", mac_sst: "mac_sst",
  ssiap1: "ssiap1", ssiap2: "ssiap2", ssiap3: "ssiap3",
  tfp_aps: "mac_aps", mac_aps: "mac_aps",
  epi: "epi", h0b0: "h0b0",
};

const CERT_LABELS: Record<string, string> = {
  sst: "SST", mac_sst: "MAC SST",
  ssiap1: "SSIAP 1", ssiap2: "SSIAP 2", ssiap3: "SSIAP 3",
  tfp_aps: "TFP APS", mac_aps: "MAC APS",
  epi: "EPI / Extincteurs", h0b0: "H0B0",
};

/** Look up entreprise_id for a stagiaire via the junction table. Returns null if none. */
async function getEntrepriseId(db: any, stagiaireId: string): Promise<string | null> {
  const { data } = await db
    .from("entreprise_stagiaires")
    .select("entreprise_id")
    .eq("stagiaire_id", stagiaireId)
    .limit(1)
    .maybeSingle();
  return data?.entreprise_id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

  const today = new Date();
  const errors: string[] = [];
  const processed: string[] = [];

  // Collect all certs needing admin summary
  const adminBatch: Array<{ cert: any; stagiaire: any; threshold: number }> = [];

  // --- Process 90j / 30j / 7j thresholds ---
  for (const days of [90, 30, 7]) {
    const target = new Date(today);
    target.setDate(target.getDate() + days);
    const dateStr = target.toISOString().slice(0, 10);

    const { data: certs, error: certsErr } = await db
      .from("certifications")
      .select("*, stagiaires(id, first_name, last_name, email)")
      .eq("date_expiration", dateStr);

    if (certsErr) { errors.push(`fetch ${days}j: ${certsErr.message}`); continue; }

    for (const cert of (certs ?? [])) {
      try {
        const stagiaire = cert.stagiaires;
        const alerteType = `${days}j`;

        // Idempotence: skip if notification already sent for this cert + threshold
        const { data: dup } = await db
          .from("notifications")
          .select("id")
          .eq("certification_id", cert.id)
          .eq("type_alerte", alerteType)
          .maybeSingle();
        if (dup) { processed.push(`skip:${cert.id}:${alerteType}`); continue; }

        // Look up stagiaire's profiles.id (= auth.uid()) for notification destinataire_id
        let destinataireId: string = cert.stagiaire_id;
        if (stagiaire?.email) {
          const { data: profile } = await db
            .from("profiles")
            .select("id")
            .eq("email", stagiaire.email)
            .maybeSingle();
          if (profile?.id) destinataireId = profile.id;
        }

        // Recyclage sessions (next 90 days)
        const in90 = new Date(today);
        in90.setDate(in90.getDate() + 90);
        const recyclageType = (RECYCLAGE_TYPE[cert.type] ?? cert.type).toUpperCase();
        const { data: sessions } = await db
          .from("formations")
          .select("id, title, start_date, location")
          .eq("type", recyclageType)
          .gte("start_date", today.toISOString().slice(0, 10))
          .lte("start_date", in90.toISOString().slice(0, 10))
          .order("start_date")
          .limit(3);

        // Insert stagiaire notification
        const { data: stagNotif } = await db
          .from("notifications")
          .insert({
            destinataire_id: destinataireId,
            destinataire_type: "stagiaire",
            certification_id: cert.id,
            type_alerte: alerteType,
          })
          .select("id")
          .single();

        // Insert entreprise notification if applicable (via junction table)
        const entrepriseId = await getEntrepriseId(db, cert.stagiaire_id);
        if (entrepriseId) {
          await db.from("notifications").insert({
            destinataire_id: entrepriseId,
            destinataire_type: "entreprise",
            certification_id: cert.id,
            type_alerte: alerteType,
          });
        }

        adminBatch.push({ cert, stagiaire, threshold: days });

        // Send stagiaire email
        if (resend && stagiaire?.email) {
          const certLabel = CERT_LABELS[cert.type] ?? cert.type;
          const expiryFr = new Date(cert.date_expiration).toLocaleDateString("fr-FR");
          const sessionsHtml = (sessions ?? []).length > 0
            ? `<ul>${(sessions ?? []).map((s: any) =>
                `<li>${s.title} — ${new Date(s.start_date).toLocaleDateString("fr-FR")}${s.location ? ` — ${s.location}` : ""}</li>`
              ).join("")}</ul>`
            : "<p>Contactez votre formateur pour planifier un recyclage.</p>";

          await resend.emails.send({
            from: "SecureCRM <noreply@secureguardpro.fr>",
            to: stagiaire.email,
            subject: `⚠️ Votre certification ${certLabel} expire dans ${days} jours`,
            html: `<p>Bonjour ${stagiaire.first_name},</p>
<p>Votre certification <strong>${certLabel}</strong> expire le <strong>${expiryFr}</strong> (dans ${days} jours).</p>
<p><strong>Sessions de recyclage disponibles :</strong></p>${sessionsHtml}
<p><a href="https://secureguardpro.fr/espace-stagiaire">Accéder à mon espace stagiaire</a></p>`,
          });

          if (stagNotif) {
            await db.from("notifications").update({ email_envoye: true }).eq("id", stagNotif.id);
          }
        }

        processed.push(`ok:${cert.id}:${alerteType}`);
      } catch (e: any) {
        errors.push(`cert ${cert.id}: ${e.message}`);
      }
    }
  }

  // --- Process expired today ---
  const todayStr = today.toISOString().slice(0, 10);
  const { data: expired } = await db
    .from("certifications")
    .select("*, stagiaires(id, first_name, last_name, email)")
    .eq("date_expiration", todayStr);

  for (const cert of (expired ?? [])) {
    try {
      const { data: dup } = await db
        .from("notifications")
        .select("id")
        .eq("certification_id", cert.id)
        .eq("type_alerte", "expire")
        .maybeSingle();
      if (dup) continue;

      const stagiaire = cert.stagiaires;
      let destinataireId: string = cert.stagiaire_id;
      if (stagiaire?.email) {
        const { data: profile } = await db
          .from("profiles")
          .select("id")
          .eq("email", stagiaire.email)
          .maybeSingle();
        if (profile?.id) destinataireId = profile.id;
      }

      await db.from("notifications").insert({
        destinataire_id: destinataireId,
        destinataire_type: "stagiaire",
        certification_id: cert.id,
        type_alerte: "expire",
      });

      adminBatch.push({ cert, stagiaire: cert.stagiaires, threshold: 0 });
      processed.push(`expire:${cert.id}`);
    } catch (e: any) {
      errors.push(`expire ${cert.id}: ${e.message}`);
    }
  }

  // --- Admin summary email (one per run) ---
  if (resend && adminBatch.length > 0) {
    const { data: admins } = await db
      .from("profiles")
      .select("email")
      .eq("role", "administrateur");

    for (const admin of (admins ?? [])) {
      if (!admin.email) continue;
      const rowsHtml = adminBatch.map(({ cert, stagiaire, threshold }) =>
        `<tr><td>${stagiaire?.first_name ?? ""} ${stagiaire?.last_name ?? ""}</td>
<td>${CERT_LABELS[cert.type] ?? cert.type}</td>
<td>${new Date(cert.date_expiration).toLocaleDateString("fr-FR")}</td>
<td>${threshold === 0 ? "Expiré" : `${threshold}j`}</td></tr>`
      ).join("");

      await resend.emails.send({
        from: "SecureCRM <noreply@secureguardpro.fr>",
        to: admin.email,
        subject: `Certifications — ${adminBatch.length} expirations dans les prochains jours`,
        html: `<p>Bonjour,</p>
<p>Récapitulatif des certifications à renouveler :</p>
<table border="1" cellpadding="6" style="border-collapse:collapse">
<thead><tr><th>Stagiaire</th><th>Certification</th><th>Expiration</th><th>Délai</th></tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
<p><a href="https://secureguardpro.fr/rappels">Voir les rappels</a></p>`,
      });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed: processed.length, errors }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
