import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_stagiaires",
  title: "Rechercher des stagiaires",
  description:
    "Recherche des stagiaires par nom ou prénom et renvoie leurs coordonnées, statut, numéro de carte pro et dates d'expiration.",
  inputSchema: {
    query: z.string().trim().optional().describe("Texte recherché dans le nom ou le prénom"),
    limit: z.number().int().optional().describe("Nombre maximum de résultats (défaut 25, max 100)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    }
    const max = Math.min(Math.max(limit ?? 25, 1), 100);
    const supabase = supabaseForUser(ctx);
    let req = supabase
      .from("stagiaires")
      .select(
        "id, first_name, last_name, email, phone, city, status, carte_pro_number, carte_pro_expiry, mac_aps_expiry",
      )
      .order("last_name", { ascending: true })
      .limit(max);
    if (query) {
      const safe = query.replace(/[%,()]/g, " ");
      req = req.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%`);
    }

    const { data, error } = await req;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { stagiaires: data ?? [] },
    };
  },
});
