import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listFormations from "./tools/list-formations";
import searchStagiaires from "./tools/search-stagiaires";
import listFormationParticipants from "./tools/list-formation-participants";
import listExpiringCertifications from "./tools/list-expiring-certifications";
import createIncident from "./tools/create-incident";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "security-guard-pro",
  title: "Security Guard Pro",
  version: "0.1.0",
  instructions:
    "Outils du CRM de sécurité privée et de formation (SecureCRM). Utilisez list_formations pour les sessions, search_stagiaires pour retrouver un stagiaire, list_formation_participants pour les inscrits d'une session, list_expiring_certifications pour les échéances de cartes pro / MAC APS, et create_incident pour enregistrer un incident dans la main courante. Toutes les données sont filtrées selon les droits de l'utilisateur connecté.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listFormations,
    searchStagiaires,
    listFormationParticipants,
    listExpiringCertifications,
    createIncident,
  ],
});
