export type CertType =
  | "sst" | "mac_sst" | "ssiap1" | "ssiap2" | "ssiap3"
  | "tfp_aps" | "mac_aps" | "epi" | "h0b0";

export type CertSource = "auto" | "manuel";
export type CertStatus = "valide" | "renouveler" | "urgent" | "expire";

export interface Certification {
  id: string;
  stagiaire_id: string;
  type: CertType;
  date_obtention: string;
  date_expiration: string;
  source: CertSource;
  formation_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CertStatusBadge {
  status: CertStatus;
  label: string;
  className: string;
}
