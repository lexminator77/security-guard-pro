import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SupabaseClient } from "@supabase/supabase-js";

function getDaysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    days.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

function fmtShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export async function generateEmargementPdf(
  formation: { id: string; title: string; type: string; start_date: string; end_date: string },
  supabase: SupabaseClient
): Promise<void> {
  const [{ data: esData }, { data: efData }] = await Promise.all([
    supabase
      .from("emargements_stagiaire")
      .select("*, stagiaire:stagiaires(id, first_name, last_name)")
      .eq("formation_id", formation.id),
    supabase
      .from("emargements_formateur")
      .select("*, formateur:formateurs(id, first_name, last_name)")
      .eq("formation_id", formation.id),
  ]);

  const days = getDaysBetween(formation.start_date, formation.end_date);
  const periodes = ["matin", "apres_midi"] as const;

  // Build stagiaire list from emargements
  const stagiaireMap: Record<string, any> = {};
  for (const e of esData ?? []) {
    if (e.stagiaire && !stagiaireMap[e.stagiaire.id]) {
      stagiaireMap[e.stagiaire.id] = e.stagiaire;
    }
  }
  const stagiaires = Object.values(stagiaireMap);

  // Build signature lookup: stagiaireId → date → periode → signature_data
  const sigMap: Record<string, Record<string, Record<string, string>>> = {};
  for (const e of esData ?? []) {
    if (!e.stagiaire_id) continue;
    sigMap[e.stagiaire_id] ??= {};
    sigMap[e.stagiaire_id][e.date] ??= {};
    sigMap[e.stagiaire_id][e.date][e.periode] = e.signature_data;
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Header
  doc.setFontSize(16);
  doc.text("FEUILLE D'ÉMARGEMENT", 148, 14, { align: "center" });
  doc.setFontSize(11);
  doc.text(formation.title, 148, 21, { align: "center" });
  doc.setFontSize(9);
  doc.text(
    `${formation.type}  |  Du ${fmtDate(formation.start_date)} au ${fmtDate(formation.end_date)}  |  AV Sécurité Formation`,
    148, 27, { align: "center" }
  );

  // Build table columns and body
  const head = [
    [
      { content: "Stagiaire", rowSpan: 1 },
      ...days.flatMap(d => [
        { content: `${fmtShort(d)}\nMatin` },
        { content: `${fmtShort(d)}\nAM` },
      ]),
    ],
  ];

  const body = stagiaires.map(s => [
    { content: `${s.last_name?.toUpperCase() ?? ""} ${s.first_name ?? ""}` },
    ...days.flatMap(d =>
      periodes.map(p => ({
        content: "",
        _sig: sigMap[s.id]?.[d]?.[p] ?? null,
      }))
    ),
  ]);

  const sigCellHeight = 18;

  autoTable(doc, {
    startY: 32,
    head,
    body,
    styles: { fontSize: 7, cellPadding: 1, minCellHeight: sigCellHeight },
    headStyles: { fillColor: [44, 44, 44], textColor: [212, 175, 55], fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { cellWidth: 40, fontStyle: "bold" } },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index > 0) {
        const raw = data.cell.raw as any;
        if (raw?._sig) {
          const pad = 1;
          doc.addImage(
            raw._sig,
            "PNG",
            data.cell.x + pad,
            data.cell.y + pad,
            data.cell.width - pad * 2,
            data.cell.height - pad * 2
          );
        }
      }
    },
  });

  // Formateur section
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(9);
  doc.text("Signature du formateur :", 14, finalY + 5);

  const formateurSig = (efData ?? []).find(e => e.signature_data);
  if (formateurSig?.signature_data) {
    doc.addImage(formateurSig.signature_data, "PNG", 60, finalY, 45, 16);
  }

  if (formateurSig?.formateur) {
    doc.setFontSize(8);
    doc.text(
      `${formateurSig.formateur.first_name} ${formateurSig.formateur.last_name}`,
      60, finalY + 20
    );
  }

  // Footer
  doc.setFontSize(7);
  const pageH = doc.internal.pageSize.height;
  doc.text(
    `Feuille d'émargement générée le ${new Date().toLocaleDateString("fr-FR")} — AV Sécurité Formation`,
    148, pageH - 5, { align: "center" }
  );

  const safeName = formation.title.replace(/[^a-z0-9]/gi, "_").slice(0, 30);
  doc.save(`emargement_${safeName}_${formation.start_date}.pdf`);
}
