import type { CertType, CertStatusBadge } from "../types/certifications";

export const CERT_LABELS: Record<CertType, string> = {
  sst: "SST",
  mac_sst: "MAC SST",
  ssiap1: "SSIAP 1",
  ssiap2: "SSIAP 2",
  ssiap3: "SSIAP 3",
  tfp_aps: "TFP APS",
  mac_aps: "MAC APS",
  epi: "EPI / Extincteurs",
  h0b0: "H0B0",
};

export const CERT_DURATIONS_MONTHS: Record<CertType, number> = {
  sst: 24, mac_sst: 24,
  ssiap1: 36, ssiap2: 36, ssiap3: 36,
  tfp_aps: 60, mac_aps: 60,
  epi: 12,
  h0b0: 36,
};

export const RECYCLAGE_TYPE: Record<CertType, CertType> = {
  sst: "mac_sst", mac_sst: "mac_sst",
  ssiap1: "ssiap1", ssiap2: "ssiap2", ssiap3: "ssiap3",
  tfp_aps: "mac_aps", mac_aps: "mac_aps",
  epi: "epi",
  h0b0: "h0b0",
};

export function daysUntilExpiry(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export function certStatusBadge(dateExpiration: string): CertStatusBadge {
  const days = daysUntilExpiry(dateExpiration) ?? -1;
  if (days < 0)   return { status: "expire",     label: "Expiré",        className: "bg-destructive/20 text-destructive border-destructive/30" };
  if (days < 30)  return { status: "urgent",     label: "Urgent",        className: "bg-orange-500/20 text-orange-400 border-orange-500/30" };
  if (days <= 90) return { status: "renouveler", label: "À renouveler",  className: "bg-warning/20 text-warning border-warning/30" };
  return           { status: "valide",            label: "Valide",        className: "bg-success/20 text-success border-success/30" };
}

export function calcDateExpiration(dateObtention: string, type: CertType): string {
  const d = new Date(dateObtention);
  d.setUTCMonth(d.getUTCMonth() + CERT_DURATIONS_MONTHS[type]);
  return d.toISOString().slice(0, 10);
}

export function formatDateFr(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR");
}
