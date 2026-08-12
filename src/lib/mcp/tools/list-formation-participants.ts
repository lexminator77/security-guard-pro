import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_formation_participants",
  title: "Lister les participants d'une session",
  description:
    "Liste les stagiaires inscrits à une session de formation donnée, avec leur statut (inscrit, present, absent, valide, echec).",
  inputSchema: {
    formation_id: z.string().trim().describe("Identifiant de la session de formation"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ formation_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("formation_participants")
      .select("id, status, stagiaire_id, stagiaires(first_name, last_name, email)")
      .eq("formation_id", formation_id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { participants: data ?? [] },
    };
  },
});
