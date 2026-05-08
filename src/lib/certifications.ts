// Helpers pour le suivi des échéances de certifications

export type AlertLevel = "ok" | "soon" | "expired" | "none";

export function monthsUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
}

export function alertLevel(dateStr: string | null | undefined, warnMonths = 1): AlertLevel {
  const m = monthsUntil(dateStr);
  if (m === null) return "none";
  if (m < 0) return "expired";
  if (m <= warnMonths) return "soon";
  return "ok";
}

export const CERTS_FORMATEUR = [
  { key: "carte_pro", label: "Carte CNAPS", date: "carte_pro_expiry" },
  { key: "sst", label: "SST", date: "sst_expiry" },
  { key: "tfp_aps", label: "TFP APS", date: "tfp_aps_expiry" },
  { key: "mac_aps", label: "MAC APS", date: "mac_aps_expiry" },
  { key: "ssiap1", label: "SSIAP 1", date: "ssiap1_expiry" },
  { key: "ssiap2", label: "SSIAP 2", date: "ssiap2_expiry" },
  { key: "ssiap3", label: "SSIAP 3", date: "ssiap3_expiry" },
] as const;

export function badgeClass(level: AlertLevel): string {
  switch (level) {
    case "expired": return "bg-destructive text-destructive-foreground";
    case "soon": return "bg-orange-500 text-white";
    case "ok": return "bg-emerald-600 text-white";
    default: return "bg-muted text-muted-foreground";
  }
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}
