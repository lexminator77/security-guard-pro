import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SupabaseClient } from "@supabase/supabase-js";

const ORGANISME = {
  nom: "AV Sécurité Formation",
  adresse: "ADRESSE_ORGANISME",
  siret: "SIRET_ORGANISME",
  nda: "NDA_ORGANISME",
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

function separator(doc: jsPDF, y: number): void {
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.3);
  doc.line(15, y, 195, y);
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(212, 175, 55);
  doc.text(text, 15, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  return y + 6;
}

function labelValue(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(label + " :", 18, y);
  doc.setFont("helvetica", "normal");
  doc.text(value || "……………………………………………………", 70, y);
  return y + 5;
}

export async function generateConventionPdf(
  formation: { id: string; title: string; type: string; start_date: string; end_date: string; location: string | null; duration_hours: number | null },
  participants: { last_name: string; first_name: string; tarif: number | null }[],
  formateur: { first_name: string; last_name: string } | null,
  supabase: SupabaseClient
): Promise<void> {
  const { data: entreprises } = await supabase
    .from("entreprise_rh")
    .select("nom, contact_nom, contact_prenom, adresse, code_postal, ville, email, telephone, siret");
  const e = entreprises?.length === 1 ? entreprises[0] : null;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("CONVENTION DE FORMATION PROFESSIONNELLE", 105, 18, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Art. L. 6353-1 du Code du Travail", 105, 24, { align: "center" });
  separator(doc, 27);

  let y = 33;

  y = sectionTitle(doc, "Article 01 — L'ORGANISME DE FORMATION", y);
  y = labelValue(doc, "Raison sociale", ORGANISME.nom, y);
  y = labelValue(doc, "Adresse", ORGANISME.adresse, y);
  y = labelValue(doc, "SIRET", ORGANISME.siret, y);
  y = labelValue(doc, "N° déclaration d'activité", ORGANISME.nda, y);
  y += 2; separator(doc, y); y += 4;

  y = sectionTitle(doc, "Article 02 — LE CLIENT", y);
  y = labelValue(doc, "Raison sociale / Nom", e?.nom ?? "", y);
  y = labelValue(doc, "Contact", e ? `${e.contact_prenom ?? ""} ${e.contact_nom ?? ""}`.trim() : "", y);
  y = labelValue(doc, "Adresse", e ? `${e.adresse ?? ""} ${e.code_postal ?? ""} ${e.ville ?? ""}`.trim() : "", y);
  y = labelValue(doc, "Email", e?.email ?? "", y);
  y = labelValue(doc, "Téléphone", e?.telephone ?? "", y);
  y = labelValue(doc, "SIRET", e?.siret ?? "", y);
  y += 2; separator(doc, y); y += 4;

  y = sectionTitle(doc, "Article 03 — DÉSIGNATION DE LA FORMATION", y);
  y = labelValue(doc, "Intitulé", formation.title, y);
  y = labelValue(doc, "Type", formation.type, y);
  y = labelValue(doc, "Dates", `Du ${fmtDate(formation.start_date)} au ${fmtDate(formation.end_date)}`, y);
  y = labelValue(doc, "Lieu", formation.location ?? "", y);
  y = labelValue(doc, "Durée", formation.duration_hours ? `${formation.duration_hours}h` : "", y);
  y = labelValue(doc, "Formateur", formateur ? `${formateur.first_name} ${formateur.last_name}` : "", y);
  y = labelValue(doc, "Nombre de stagiaires", String(participants.length), y);
  y += 2; separator(doc, y); y += 4;

  y = sectionTitle(doc, "Article 04 — STAGIAIRES CONCERNÉS", y);
  autoTable(doc, {
    startY: y,
    head: [["Nom", "Prénom"]],
    body: participants.map(p => [p.last_name?.toUpperCase() ?? "", p.first_name ?? ""]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [44, 44, 44], textColor: [212, 175, 55], fontStyle: "bold" },
    margin: { left: 15, right: 15 },
  });
  y = (doc as any).lastAutoTable.finalY + 4;
  separator(doc, y); y += 4;

  const totalHt = participants.reduce((acc, p) => acc + (Number(p.tarif) || 0), 0);
  y = sectionTitle(doc, "Article 05 — PRIX ET MODALITÉS DE RÈGLEMENT", y);
  autoTable(doc, {
    startY: y,
    body: [
      ["Prix total HT", `${totalHt.toLocaleString("fr-FR")} €`],
      ["TVA", "Non applicable — Art. 261-4-4° du CGI"],
      ["Prise en charge OPCO / CPF / Autre", ""],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 } },
    margin: { left: 15, right: 15 },
  });

  const pageH = doc.internal.pageSize.height;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Convention générée le ${new Date().toLocaleDateString("fr-FR")} — AV Sécurité Formation`,
    105, pageH - 8, { align: "center" }
  );

  doc.save(`convention_${formation.type}_${formation.start_date}.pdf`);
}
