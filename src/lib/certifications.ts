// @ts-nocheck
// Helpers pour le suivi des échéances de certifications
export type AlertLevel = "ok" | "soon" | "expired" | "none";

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export function monthsUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
}

// warnDays = 90 jours (3 mois)
export function alertLevel(dateStr: string | null | undefined, warnDays = 90): AlertLevel {
  const days = daysUntil(dateStr);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= warnDays) return "soon";
  return "ok";
}

// Logique MAC APS : le MAC couvre le TFP tant qu'il est valide
export function shouldAlertTfpAps(
  tfp_aps_expiry: string | null | undefined,
  mac_aps_expiry: string | null | undefined
): boolean {
  if (!tfp_aps_expiry) return false;
  const tfpLevel = alertLevel(tfp_aps_expiry);
  if (tfpLevel === "ok") return false;
  const macLevel = alertLevel(mac_aps_expiry);
  if (macLevel === "ok" || macLevel === "soon") return false;
  return true;
}

// Durées de validité réglementaires :
// TFP APS    → 5 ans (carte CNAPS valable 5 ans)
// MAC APS    → 5 ans (renouvellement carte CNAPS tous les 5 ans)
// SST        → 2 ans (MAC SST 1 jour tous les 2 ans)
// SSIAP 1/2/3 → 3 ans (MAC SSIAP 2 jours tous les 3 ans, initiale si dépassé)
// Carte CNAPS → 5 ans

export const CERTS_FORMATEUR = [
  { key: "carte_pro",  label: "Carte CNAPS",      date: "carte_pro_expiry" },
  { key: "sst",        label: "SST (2 ans)",       date: "sst_expiry"       },
  { key: "tfp_aps",    label: "TFP APS (5 ans)",   date: "tfp_aps_expiry"   },
  { key: "mac_aps",    label: "MAC APS (5 ans)",   date: "mac_aps_expiry"   },
  { key: "ssiap1",     label: "SSIAP 1 (3 ans)",   date: "ssiap1_expiry"    },
  { key: "ssiap2",     label: "SSIAP 2 (3 ans)",   date: "ssiap2_expiry"    },
  { key: "ssiap3",     label: "SSIAP 3 (3 ans)",   date: "ssiap3_expiry"    },
] as const;

export const CERTS_STAGIAIRE = [
  { key: "carte_pro",  label: "Carte CNAPS",      date: "carte_pro_expiry" },
  { key: "mac_aps",    label: "MAC APS (5 ans)",  date: "mac_aps_expiry"   },
] as const;

export function badgeClass(level: AlertLevel): string {
  switch (level) {
    case "expired": return "bg-destructive text-destructive-foreground";
    case "soon":    return "bg-orange-500 text-white";
    case "ok":      return "bg-emerald-600 text-white";
    default:        return "bg-muted text-muted-foreground";
  }
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export function daysLabel(days: number | null): string {
  if (days === null) return "—";
  if (days < 0) return `Expiré depuis ${Math.abs(days)}j`;
  if (days === 0) return "Expire aujourd'hui";
  return `Dans ${days}j`;
}