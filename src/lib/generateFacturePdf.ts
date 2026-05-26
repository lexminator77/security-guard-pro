import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ORGANISME = {
  nom: "AV Sécurité Formation",
  adresse: "ADRESSE_ORGANISME",
  siret: "SIRET_ORGANISME",
  nda: "NDA_ORGANISME",
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("fr-FR");
}

export function generateFacturePdf(
  facture: {
    numero: string;
    client_nom: string;
    client_adresse: string | null;
    client_siret: string | null;
    montant_ht: number;
    date_emission: string;
    participant_count: number;
  },
  formation: {
    title: string;
    type: string;
    start_date: string;
    end_date: string;
    duration_hours: number | null;
  } | null
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Header band
  doc.setFillColor(44, 44, 44);
  doc.rect(0, 0, 210, 35, "F");
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(212, 175, 55);
  doc.text("FACTURE", 15, 18);
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text(`N° ${facture.numero}`, 15, 26);
  doc.text(`Date : ${fmtDate(facture.date_emission)}`, 195, 26, { align: "right" });

  // Organisme block (left)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(ORGANISME.nom, 15, 45);
  doc.setFont("helvetica", "normal");
  doc.text(ORGANISME.adresse, 15, 50);
  doc.text(`SIRET : ${ORGANISME.siret}`, 15, 55);
  doc.text(`N° Déclaration d'activité : ${ORGANISME.nda}`, 15, 60);

  // Client block (right)
  doc.setFont("helvetica", "bold");
  doc.text("FACTURÉ À :", 120, 45);
  doc.setFont("helvetica", "normal");
  doc.text(facture.client_nom, 120, 50);
  if (facture.client_adresse) {
    const lines = doc.splitTextToSize(facture.client_adresse, 70);
    doc.text(lines, 120, 55);
  }
  if (facture.client_siret) {
    doc.text(`SIRET : ${facture.client_siret}`, 120, 65);
  }

  let y = 75;
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.3);
  doc.line(15, y, 195, y);
  y += 6;

  // Formation details
  if (formation) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("OBJET DE LA FACTURE", 15, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Désignation", "Détail"]],
      body: [
        ["Intitulé de la formation", formation.title],
        ["Type", formation.type],
        ["Dates", `Du ${fmtDate(formation.start_date)} au ${fmtDate(formation.end_date)}`],
        ["Durée", formation.duration_hours ? `${formation.duration_hours} heures` : "—"],
        ["Nombre de stagiaires", String(facture.participant_count)],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [44, 44, 44], textColor: [212, 175, 55], fontStyle: "bold" },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
      margin: { left: 15, right: 15 },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y + 30) + 6;
  } else {
    y += 6;
  }

  // Pricing table
  autoTable(doc, {
    startY: y,
    body: [
      ["Total HT", `${Number(facture.montant_ht).toLocaleString("fr-FR")} €`],
      ["TVA", "Non applicable — Art. 261-4-4° du CGI"],
      ["Total TTC", `${Number(facture.montant_ht).toLocaleString("fr-FR")} €`],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 }, 1: { halign: "right" } },
    margin: { left: 100, right: 15 },
  });
  y = ((doc as any).lastAutoTable?.finalY ?? y + 20) + 8;

  // Legal mentions
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Conditions de règlement :", 15, y);
  doc.setFont("helvetica", "normal");
  y += 4;
  doc.text("Paiement à 30 jours à réception de facture.", 15, y);
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Pénalités de retard :", 15, y);
  doc.setFont("helvetica", "normal");
  y += 4;
  const penalite = "En cas de retard de paiement, des pénalités de retard au taux de 3 fois le taux d'intérêt légal seront appliquées, ainsi qu'une indemnité forfaitaire de recouvrement de 40 €.";
  doc.text(doc.splitTextToSize(penalite, 180), 15, y);

  // Footer
  const pageH = doc.internal.pageSize.height;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.line(15, pageH - 15, 195, pageH - 15);
  doc.text(`${ORGANISME.nom} — SIRET : ${ORGANISME.siret} — N° DA : ${ORGANISME.nda}`, 105, pageH - 9, { align: "center" });
  doc.text("TVA non applicable, art. 261-4-4° du CGI", 105, pageH - 5, { align: "center" });

  doc.save(`facture_${facture.numero}.pdf`);
}
