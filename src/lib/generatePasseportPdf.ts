// src/lib/generatePasseportPdf.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ORGANISME = "AV Sécurité Formation";

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR");
}

function separator(doc: jsPDF, y: number): void {
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.3);
  doc.line(15, y, 195, y);
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  if (y > 265) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(212, 175, 55);
  doc.text(text, 15, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  return y + 6;
}

function labelValue(doc: jsPDF, label: string, value: string, y: number): number {
  if (y > 270) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(label + " :", 18, y);
  doc.setFont("helvetica", "normal");
  doc.text(value || "……………………………………………………", 70, y);
  return y + 5;
}

type Stagiaire = {
  first_name: string;
  last_name: string;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  carte_pro_number: string | null;
  carte_pro_expiry: string | null;
  autorisation_numero: string | null;
  autorisation_type: string | null;
  autorisation_expiry: string | null;
};

type Participation = {
  status: string;
  resultat: string | null;
  formation: {
    title: string;
    type: string;
    start_date: string;
    end_date: string;
    duration_hours: number | null;
  } | null;
};

type CertificationItem = {
  type: string;
  date_obtention: string;
  date_expiration: string | null;
  formation: { title: string } | null;
};

const STATUT_LABEL: Record<string, string> = {
  inscrit: "Inscrit", present: "Présent", absent: "Absent", valide: "Validé", echec: "Échec",
};
const RESULTAT_LABEL: Record<string, string> = {
  obtenu: "Obtenu", en_attente: "En attente",
};

export async function generatePasseportPdf(
  stagiaire: Stagiaire,
  participations: Participation[],
  certifications: CertificationItem[]
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // En-tête
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("PASSEPORT DE PRÉVENTION", 105, 18, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Loi Santé au Travail — 2 août 2021", 105, 24, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(ORGANISME, 105, 29, { align: "center" });
  doc.setTextColor(30, 30, 30);
  separator(doc, 32);

  let y = 38;

  // Article 01 — Titulaire
  y = sectionTitle(doc, "Article 01 — TITULAIRE", y);
  y = labelValue(doc, "Nom", stagiaire.last_name.toUpperCase(), y);
  y = labelValue(doc, "Prénom", stagiaire.first_name, y);
  y = labelValue(doc, "Date de naissance", fmtDate(stagiaire.birth_date), y);
  y = labelValue(doc, "Email", stagiaire.email ?? "", y);
  y = labelValue(doc, "Téléphone", stagiaire.phone ?? "", y);
  y += 2; separator(doc, y); y += 4;

  // Article 02 — Carte professionnelle CNAPS
  y = sectionTitle(doc, "Article 02 — CARTE PROFESSIONNELLE CNAPS", y);
  y = labelValue(doc, "N° carte professionnelle", stagiaire.carte_pro_number ?? "", y);
  y = labelValue(doc, "Expiration carte pro", fmtDate(stagiaire.carte_pro_expiry), y);
  y = labelValue(doc, "Type d'autorisation", stagiaire.autorisation_type ?? "", y);
  y = labelValue(doc, "N° autorisation", stagiaire.autorisation_numero ?? "", y);
  y = labelValue(doc, "Expiration autorisation", fmtDate(stagiaire.autorisation_expiry), y);
  y += 2; separator(doc, y); y += 4;

  // Article 03 — Formations suivies
  y = sectionTitle(doc, "Article 03 — FORMATIONS SUIVIES", y);
  if (participations.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Aucune formation enregistrée.", 18, y);
    doc.setTextColor(30, 30, 30);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Intitulé", "Type", "Du", "Au", "Durée", "Statut", "Résultat"]],
      body: participations.map(p => [
        p.formation?.title ?? "—",
        p.formation?.type ?? "—",
        fmtDate(p.formation?.start_date),
        fmtDate(p.formation?.end_date),
        p.formation?.duration_hours ? `${p.formation.duration_hours}h` : "—",
        STATUT_LABEL[p.status] ?? p.status,
        p.resultat ? (RESULTAT_LABEL[p.resultat] ?? p.resultat) : "—",
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [44, 44, 44], textColor: [212, 175, 55], fontStyle: "bold" },
      margin: { left: 15, right: 15 },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y + 20) + 4;
  }
  separator(doc, y); y += 4;

  // Article 04 — Certifications
  y = sectionTitle(doc, "Article 04 — CERTIFICATIONS OBTENUES", y);
  if (certifications.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Aucune certification enregistrée.", 18, y);
    doc.setTextColor(30, 30, 30);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Type", "Date obtention", "Expiration", "Formation associée"]],
      body: certifications.map(c => [
        c.type.toUpperCase(),
        fmtDate(c.date_obtention),
        fmtDate(c.date_expiration),
        c.formation?.title ?? "—",
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [44, 44, 44], textColor: [212, 175, 55], fontStyle: "bold" },
      margin: { left: 15, right: 15 },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y + 20) + 4;
  }

  // Pied de page
  const pageH = doc.internal.pageSize.height;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Passeport généré le ${new Date().toLocaleDateString("fr-FR")} — ${ORGANISME}`,
    105, pageH - 8, { align: "center" }
  );

  doc.save(`passeport_${stagiaire.last_name.toUpperCase()}_${stagiaire.first_name}.pdf`);
}
