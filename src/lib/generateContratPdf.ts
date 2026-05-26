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
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR");
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
  if (y > 265) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(label + " :", 18, y);
  doc.setFont("helvetica", "normal");
  doc.text(value || "……………………………………………………", 70, y);
  return y + 5;
}

export async function generateContratPdf(
  stagiaire: { id: string; first_name: string; last_name: string; email: string | null },
  formation: {
  title: string;
  type: string;
  start_date: string;
  end_date: string;
  location: string | null;
  duration_hours: number | null;
  description: string | null;  // ← add this
},
  tarif: number | null,
  financement: "particulier" | "cpf",
  supabase: SupabaseClient
): Promise<void> {
  const { data: addrData, error: addrError } = await supabase
    .from("stagiaires")
    .select("address, city, postal_code")
    .eq("id", stagiaire.id)
    .single();
  if (addrError && addrError.code !== "PGRST116") throw new Error(addrError.message);

  const adresse = addrData?.address
    ? `${addrData.address}${addrData.postal_code ? ", " + addrData.postal_code : ""}${addrData.city ? " " + addrData.city : ""}`
    : "";

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("CONTRAT DE FORMATION PROFESSIONNELLE", 105, 18, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Art. L.6353-3 et suivants du Code du Travail", 105, 24, { align: "center" });
  separator(doc, 27);

  let y = 33;

  // Article 01 — Organisme
  y = sectionTitle(doc, "Article 01 — L'ORGANISME DE FORMATION", y);
  y = labelValue(doc, "Raison sociale", ORGANISME.nom, y);
  y = labelValue(doc, "Adresse", ORGANISME.adresse, y);
  y = labelValue(doc, "SIRET", ORGANISME.siret, y);
  y = labelValue(doc, "N° déclaration d'activité", ORGANISME.nda, y);
  y += 2; separator(doc, y); y += 4;

  // Article 02 — Stagiaire
  y = sectionTitle(doc, "Article 02 — LE STAGIAIRE", y);
  y = labelValue(doc, "Nom", stagiaire.last_name, y);
  y = labelValue(doc, "Prénom", stagiaire.first_name, y);
  y = labelValue(doc, "Adresse", adresse, y);
  y = labelValue(doc, "Email", stagiaire.email ?? "", y);
  y += 2; separator(doc, y); y += 4;

  // Article 03 — Formation
  y = sectionTitle(doc, "Article 03 — DÉSIGNATION DE LA FORMATION", y);
  y = labelValue(doc, "Intitulé", formation.title, y);
  y = labelValue(doc, "Type", formation.type, y);
  y = labelValue(doc, "Dates", `Du ${fmtDate(formation.start_date)} au ${fmtDate(formation.end_date)}`, y);
  y = labelValue(doc, "Lieu", formation.location ?? "", y);
  y = labelValue(doc, "Durée", formation.duration_hours ? `${formation.duration_hours} heures` : "", y);
  y = labelValue(doc, "Objectifs / Programme", formation.description ?? "", y);
  y = labelValue(doc, "Niveau prérequis", "Aucun prérequis particulier", y);
  y += 2; separator(doc, y); y += 4;

  // Article 04 — Financement
  y = sectionTitle(doc, "Article 04 — MODE DE FINANCEMENT", y);
  const financementLabel = financement === "cpf"
    ? "CPF — Compte Personnel de Formation"
    : "Particulier — financement personnel";
  y = labelValue(doc, "Financement", financementLabel, y);
  if (financement === "cpf") {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text("Le stagiaire mobilise ses droits CPF via Mon Compte Formation (moncompteformation.gouv.fr).", 18, y);
    doc.setFont("helvetica", "normal");
    y += 5;
  }
  y += 2; separator(doc, y); y += 4;

  // Article 05 — Prix
  y = sectionTitle(doc, "Article 05 — PRIX ET MODALITÉS DE RÈGLEMENT", y);
  autoTable(doc, {
    startY: y,
    body: [
      ["Prix HT", tarif != null ? `${Number(tarif).toLocaleString("fr-FR")} €` : "……………………"],
      ["TVA", "Non applicable — Art. 261-4-4° du CGI"],
      ["Prix TTC", tarif != null ? `${Number(tarif).toLocaleString("fr-FR")} €` : "……………………"],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 } },
    margin: { left: 15, right: 15 },
  });
  y = ((doc as any).lastAutoTable?.finalY ?? y + 20) + 4;
  doc.setFontSize(8);
  doc.text("TVA non applicable — Art. 261-4-4° du CGI (exonération organismes de formation).", 18, y);
  y += 5;
  doc.text("Conditions de règlement : Paiement à réception de la convocation ou avant le début de la formation.", 18, y);
  y += 5;
  doc.text("Pénalités de retard au taux de 3 fois le taux d'intérêt légal + indemnité forfaitaire de recouvrement de 40 €.", 18, y);
  y += 6; separator(doc, y); y += 4;

  // Article 06 — Rétractation
  if (y > 240) { doc.addPage(); y = 20; }
  y = sectionTitle(doc, "Article 06 — DÉLAI DE RÉTRACTATION", y);
  doc.setFontSize(8);
  const retractation = "Conformément à l'article L.6353-5 du Code du Travail, le stagiaire dispose d'un délai de rétractation de 10 jours calendaires à compter de la signature du présent contrat. La rétractation doit être notifiée par écrit (lettre recommandée avec accusé de réception) à l'organisme de formation. Aucune somme ne peut être exigée du stagiaire avant l'expiration de ce délai.";
  const retractLines = doc.splitTextToSize(retractation, 180);
  doc.text(retractLines, 15, y);
  y += retractLines.length * 4 + 6;
  separator(doc, y); y += 6;

  // Signature blocks
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Fait en deux exemplaires originaux.", 105, y, { align: "center" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.text("Pour l'organisme de formation :", 30, y);
  doc.text("Le stagiaire :", 130, y);
  y += 4;
  doc.setFontSize(8);
  doc.text("(Signature + cachet)", 30, y);
  doc.text("(Signature précédée de la mention « Lu et approuvé »)", 130, y);
  y += 20;
  doc.line(20, y, 90, y);
  doc.line(120, y, 190, y);

  // Footer
  const pageH = doc.internal.pageSize.height;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Contrat généré le ${new Date().toLocaleDateString("fr-FR")} — AV Sécurité Formation`,
    105, pageH - 5, { align: "center" }
  );

  doc.save(`contrat_${stagiaire.last_name.toUpperCase()}_${stagiaire.first_name}_${formation.start_date}.pdf`);
}
