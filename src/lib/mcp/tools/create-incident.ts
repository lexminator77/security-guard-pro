import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_incident",
  title: "Créer un incident (main courante)",
  description:
    "Enregistre un nouvel incident dans la main courante au nom de l'utilisateur connecté.",
  inputSchema: {
    title: z.string().trim().describe("Titre court de l'incident"),
    description: z.string().trim().optional().describe("Description détaillée"),
    location: z.string().trim().optional().describe("Lieu de l'incident"),
    severity: z.string().trim().optional().describe("Sévérité, ex: faible, moyenne, elevee, critique"),
    occurred_at: z.string().trim().optional().describe("Date/heure ISO de survenue (défaut: maintenant)"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, description, location, severity, occurred_at }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const payload: Record<string, unknown> = {
      author_id: ctx.getUserId(),
      title,
      description: description ?? null,
      location: location ?? null,
      occurred_at: occurred_at ?? new Date().toISOString(),
    };
    if (severity) payload.severity = severity;

    const { data, error } = await supabase.from("incidents").insert(payload).select().maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { incident: data },
    };
  },
});
