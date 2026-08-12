import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_formations",
  title: "Lister les sessions de formation",
  description:
    "Liste les sessions de formation (titre, type, dates, lieu, statut). Filtre optionnel par statut ou par sessions à venir uniquement.",
  inputSchema: {
    status: z.string().trim().optional().describe("Filtrer par statut, ex: planifiee, en_cours, terminee"),
    upcoming_only: z.boolean().optional().describe("Ne garder que les sessions dont la date de début est future"),
    limit: z.number().int().optional().describe("Nombre maximum de sessions (défaut 25, max 100)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, upcoming_only, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    }
    const max = Math.min(Math.max(limit ?? 25, 1), 100);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("formations")
      .select("id, title, type, status, start_date, end_date, location, max_participants")
      .order("start_date", { ascending: true })
      .limit(max);
    if (status) query = query.eq("status", status);
    if (upcoming_only) query = query.gte("start_date", new Date().toISOString().slice(0, 10));

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { formations: data ?? [] },
    };
  },
});
