import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export default defineTool({
  name: "list_expiring_certifications",
  title: "Échéances de cartes pro et MAC APS",
  description:
    "Liste les stagiaires dont la carte professionnelle ou le MAC APS expire dans les prochains mois (ou est déjà expiré), pour planifier les recyclages.",
  inputSchema: {
    months_ahead: z.number().int().optional().describe("Horizon en mois (défaut 6)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ months_ahead }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    }
    const horizonMonths = Math.min(Math.max(months_ahead ?? 6, 1), 24);
    const cutoff = new Date(Date.now() + horizonMonths * MONTH_MS).toISOString().slice(0, 10);
    const supabase = supabaseForUser(ctx);

    const { data, error } = await supabase
      .from("stagiaires")
      .select("id, first_name, last_name, email, carte_pro_expiry, mac_aps_expiry")
      .or(`carte_pro_expiry.lte.${cutoff},mac_aps_expiry.lte.${cutoff}`)
      .limit(200);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const today = new Date().toISOString().slice(0, 10);
    const rows = (data ?? []).flatMap((s: Record<string, string | null>) =>
      (
        [
          ["carte_pro", s.carte_pro_expiry],
          ["mac_aps", s.mac_aps_expiry],
        ] as const
      )
        .filter(([, date]) => date && date <= cutoff)
        .map(([kind, date]) => ({
          stagiaire_id: s.id,
          nom: `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim(),
          email: s.email,
          certification: kind,
          date_expiration: date,
          expire: (date as string) < today,
        })),
    );
    rows.sort((a, b) => String(a.date_expiration).localeCompare(String(b.date_expiration)));

    return {
      content: [{ type: "text", text: JSON.stringify(rows) }],
      structuredContent: { echeances: rows },
    };
  },
});
