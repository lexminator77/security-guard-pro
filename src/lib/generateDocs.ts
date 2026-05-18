// @ts-nocheck
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageOrientation, Header
} from "docx";
import { saveAs } from "file-saver";

const BORDER = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "___/___/______";
  return new Date(d).toLocaleDateString("fr-FR");
};

const cell = (text: string, bold = false, shade = false, width = 4680) =>
  new TableCell({
    borders: BORDERS,
    width: { size: width, type: WidthType.DXA },
    shading: shade ? { fill: "1a1a2e", type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      children: [new TextRun({ text, bold, font: "Arial", size: 20 })]
    })]
  });

const headerCell = (text: string, width = 9360) =>
  new TableCell({
    borders: BORDERS,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: "2C2C2C", type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, font: "Arial", size: 22, color: "D4AF37" })]
    })]
  });

const row2 = (label: string, value: string) =>
  new TableRow({
    children: [
      cell(label, true, false, 3120),
      cell(value, false, false, 6240),
    ]
  });

const sectionTitle = (text: string) =>
  new Paragraph({
    spacing: { before: 300, after: 100 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: 24, color: "D4AF37" })]
  });

const footer = () =>
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: "D4AF37", space: 4 } },
    children: [new TextRun({
      text: "AV Sécurité Formation — Alexandre Villalba — Royan (17)  |  contact@av-securite-formation.fr",
      font: "Arial", size: 16, color: "888888", italics: true
    })]
  });

// ─── ATTESTATION ─────────────────────────────────────────────────────────────
export async function generateAttestation(formation: any, stagiaire: any, formateur: any) {
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }
        }
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: "ATTESTATION DE FIN DE FORMATION", bold: true, font: "Arial", size: 36, color: "D4AF37" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [new TextRun({ text: formation.title ?? formation.type, bold: true, font: "Arial", size: 26 })]
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({
            text: `Je soussigné(e), Alexandre Villalba, responsable pédagogique de l'organisme de formation AV Sécurité Formation, certifie que le(la) stagiaire désigné(e) ci-dessous a suivi et validé la formation suivante :`,
            font: "Arial", size: 20
          })]
        }),

        sectionTitle("IDENTITÉ DU STAGIAIRE"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [3120, 6240],
          rows: [
            row2("Nom :", stagiaire.last_name?.toUpperCase() ?? ""),
            row2("Prénom :", stagiaire.first_name ?? ""),
            row2("Date de naissance :", fmtDate(stagiaire.birth_date)),
            row2("Employeur / Organisme :", "________________________________"),
          ]
        }),

        sectionTitle("DÉTAIL DE LA FORMATION"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [3120, 6240],
          rows: [
            row2("Intitulé :", formation.title ?? formation.type),
            row2("Type :", formation.type ?? ""),
            row2("Dates de formation :", `Du ${fmtDate(formation.start_date)} au ${fmtDate(formation.end_date)}`),
            row2("Lieu de formation :", formation.location ?? "________________________________"),
            row2("Formateur :", formateur ? `${formateur.first_name} ${formateur.last_name}` : "________________________________"),
            row2("Résultat :", "Formation suivie avec succès — Assiduité validée"),
          ]
        }),

        new Paragraph({ spacing: { before: 400, after: 200 }, children: [new TextRun({ text: `Fait à Royan, le ${fmtDate(new Date().toISOString())}`, font: "Arial", size: 20 })] }),

        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [4513, 4513],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  borders: BORDERS,
                  width: { size: 4513, type: WidthType.DXA },
                  margins: { top: 80, bottom: 200, left: 120, right: 120 },
                  children: [
                    new Paragraph({ children: [new TextRun({ text: "Signature du formateur :", bold: true, font: "Arial", size: 20 })] }),
                    new Paragraph({ children: [new TextRun({ text: "Alexandre Villalba — AV Sécurité Formation", font: "Arial", size: 18, italics: true })] }),
                    new Paragraph({ children: [new TextRun({ text: " ", font: "Arial", size: 40 })] }),
                  ]
                }),
                new TableCell({
                  borders: BORDERS,
                  width: { size: 4513, type: WidthType.DXA },
                  margins: { top: 80, bottom: 200, left: 120, right: 120 },
                  children: [
                    new Paragraph({ children: [new TextRun({ text: "Signature du stagiaire :", bold: true, font: "Arial", size: 20 })] }),
                    new Paragraph({ children: [new TextRun({ text: '(précédée de la mention "Lu et approuvé")', font: "Arial", size: 18, italics: true })] }),
                    new Paragraph({ children: [new TextRun({ text: " ", font: "Arial", size: 40 })] }),
                  ]
                }),
              ]
            })
          ]
        }),

        new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: "Cette attestation est délivrée en un exemplaire original remis au stagiaire. Elle ne vaut pas certification mais justifie la réalisation de la formation.", font: "Arial", size: 16, italics: true, color: "888888" })] }),
        footer(),
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Attestation_${stagiaire.last_name}_${stagiaire.first_name}_${formation.type}.docx`);
}

// ─── FEUILLE D'ÉMARGEMENT ────────────────────────────────────────────────────
export async function generateEmargement(formation: any, stagiaires: any[], formateur: any) {
  const children: any[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: "FEUILLE D'ÉMARGEMENT", bold: true, font: "Arial", size: 32, color: "D4AF37" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: formation.title ?? formation.type, bold: true, font: "Arial", size: 24 })]
    }),

    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [4513, 4513],
      rows: [
        new TableRow({ children: [
          new TableCell({ borders: BORDERS, width: { size: 4513, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({ children: [new TextRun({ text: `Formation : ${formation.title ?? formation.type}`, bold: true, font: "Arial", size: 18 })] }),
              new Paragraph({ children: [new TextRun({ text: `Dates : Du ${fmtDate(formation.start_date)} au ${fmtDate(formation.end_date)}`, font: "Arial", size: 18 })] }),
              new Paragraph({ children: [new TextRun({ text: `Lieu : ${formation.location ?? "À compléter"}`, font: "Arial", size: 18 })] }),
            ]
          }),
          new TableCell({ borders: BORDERS, width: { size: 4513, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({ children: [new TextRun({ text: `Formateur : ${formateur ? `${formateur.first_name} ${formateur.last_name}` : "________________________________"}`, font: "Arial", size: 18 })] }),
              new Paragraph({ children: [new TextRun({ text: "Organisme : AV Sécurité Formation", font: "Arial", size: 18 })] }),
              new Paragraph({ children: [new TextRun({ text: "N° déclaration : À compléter", font: "Arial", size: 18 })] }),
            ]
          }),
        ]})
      ]
    }),

    new Paragraph({ spacing: { before: 300, after: 100 }, children: [new TextRun({ text: `Date : _____ / _____ / _____`, bold: true, font: "Arial", size: 22 })] }),

    new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [400, 1800, 1800, 1800, 1613, 1613],
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ borders: BORDERS, width: { size: 400, type: WidthType.DXA }, shading: { fill: "2C2C2C", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "N°", bold: true, font: "Arial", size: 18, color: "D4AF37" })] })] }),
            new TableCell({ borders: BORDERS, width: { size: 1800, type: WidthType.DXA }, shading: { fill: "2C2C2C", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "Nom", bold: true, font: "Arial", size: 18, color: "D4AF37" })] })] }),
            new TableCell({ borders: BORDERS, width: { size: 1800, type: WidthType.DXA }, shading: { fill: "2C2C2C", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "Prénom", bold: true, font: "Arial", size: 18, color: "D4AF37" })] })] }),
            new TableCell({ borders: BORDERS, width: { size: 1800, type: WidthType.DXA }, shading: { fill: "2C2C2C", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "Société", bold: true, font: "Arial", size: 18, color: "D4AF37" })] })] }),
            new TableCell({ borders: BORDERS, width: { size: 1613, type: WidthType.DXA }, shading: { fill: "2C2C2C", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Signature Matin", bold: true, font: "Arial", size: 18, color: "D4AF37" })] })] }),
            new TableCell({ borders: BORDERS, width: { size: 1613, type: WidthType.DXA }, shading: { fill: "2C2C2C", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Signature Après-midi", bold: true, font: "Arial", size: 18, color: "D4AF37" })] })] }),
          ]
        }),
        ...stagiaires.map((s, i) =>
          new TableRow({
            children: [
              new TableCell({ borders: BORDERS, width: { size: 400, type: WidthType.DXA }, margins: { top: 80, bottom: 200, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${i + 1}`, font: "Arial", size: 18 })] })] }),
              new TableCell({ borders: BORDERS, width: { size: 1800, type: WidthType.DXA }, margins: { top: 80, bottom: 200, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: s.last_name?.toUpperCase() ?? "", font: "Arial", size: 18 })] })] }),
              new TableCell({ borders: BORDERS, width: { size: 1800, type: WidthType.DXA }, margins: { top: 80, bottom: 200, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: s.first_name ?? "", font: "Arial", size: 18 })] })] }),
              new TableCell({ borders: BORDERS, width: { size: 1800, type: WidthType.DXA }, margins: { top: 80, bottom: 200, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "", font: "Arial", size: 18 })] })] }),
              new TableCell({ borders: BORDERS, width: { size: 1613, type: WidthType.DXA }, margins: { top: 80, bottom: 200, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "", font: "Arial", size: 18 })] })] }),
              new TableCell({ borders: BORDERS, width: { size: 1613, type: WidthType.DXA }, margins: { top: 80, bottom: 200, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "", font: "Arial", size: 18 })] })] }),
            ]
          })
        ),
        new TableRow({
          children: [
            new TableCell({ borders: BORDERS, columnSpan: 4, width: { size: 5800, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: "Signature du formateur :", bold: true, font: "Arial", size: 18 })] })] }),
            new TableCell({ borders: BORDERS, columnSpan: 2, width: { size: 3226, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 }, children: [new Paragraph({ children: [new TextRun({ text: `Présents : _____ / ${stagiaires.length}`, font: "Arial", size: 18 })] })] }),
          ]
        })
      ]
    }),
    footer(),
  ];

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      children,
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Emargement_${formation.type}_${fmtDate(formation.start_date).replace(/\//g, "-")}.docx`);
}

// ─── CONVENTION ───────────────────────────────────────────────────────────────
export async function generateConvention(formation: any, stagiaires: any[], formateur: any, entreprise?: any) {
  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 100 },
          children: [new TextRun({ text: "CONVENTION DE FORMATION", bold: true, font: "Arial", size: 36, color: "D4AF37" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "PROFESSIONNELLE CONTINUE", bold: true, font: "Arial", size: 28 })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [new TextRun({ text: "Art. L6353-1 du Code du travail", font: "Arial", size: 18, italics: true, color: "888888" })]
        }),

        sectionTitle("01 — L'ORGANISME DE FORMATION"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [3120, 6240],
          rows: [
            row2("Raison sociale", "AV Sécurité Formation"),
            row2("Responsable", "Alexandre Villalba"),
            row2("Siège social", "Royan — Charente-Maritime (17)"),
            row2("N° Déclaration d'Activité", "À compléter — DREETS Nouvelle-Aquitaine"),
            row2("Email", "contact@av-securite-formation.fr"),
          ]
        }),

        sectionTitle("02 — LE CLIENT"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [3120, 6240],
          rows: [
            row2("Raison sociale / Nom", entreprise?.nom ?? "________________________________"),
            row2("Représenté par", entreprise ? `${entreprise.contact_prenom ?? ""} ${entreprise.contact_nom ?? ""}`.trim() || "________________________________" : "________________________________"),
            row2("Adresse", entreprise ? `${entreprise.adresse ?? ""} ${entreprise.code_postal ?? ""} ${entreprise.ville ?? ""}`.trim() || "________________________________" : "________________________________"),
            row2("Email", entreprise?.email ?? "________________________________"),
            row2("Téléphone", entreprise?.telephone ?? "________________________________"),
            row2("N° SIRET", entreprise?.siret ?? "________________________________"),
          ]
        }),

        sectionTitle("03 — DÉSIGNATION DE LA FORMATION"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [3120, 6240],
          rows: [
            row2("Intitulé", formation.title ?? formation.type),
            row2("Type", formation.type ?? ""),
            row2("Dates", `Du ${fmtDate(formation.start_date)} au ${fmtDate(formation.end_date)}`),
            row2("Lieu", formation.location ?? "________________________________"),
            row2("Formateur", formateur ? `${formateur.first_name} ${formateur.last_name}` : "________________________________"),
            row2("Nombre de stagiaires", `${stagiaires.length}`),
          ]
        }),

        sectionTitle("04 — STAGIAIRES CONCERNÉS"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [400, 2800, 2800, 3026],
          rows: [
            new TableRow({
              children: [
                new TableCell({ borders: BORDERS, width: { size: 400, type: WidthType.DXA }, shading: { fill: "2C2C2C", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "N°", bold: true, font: "Arial", size: 18, color: "D4AF37" })] })] }),
                new TableCell({ borders: BORDERS, width: { size: 2800, type: WidthType.DXA }, shading: { fill: "2C2C2C", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "Nom", bold: true, font: "Arial", size: 18, color: "D4AF37" })] })] }),
                new TableCell({ borders: BORDERS, width: { size: 2800, type: WidthType.DXA }, shading: { fill: "2C2C2C", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "Prénom", bold: true, font: "Arial", size: 18, color: "D4AF37" })] })] }),
                new TableCell({ borders: BORDERS, width: { size: 3026, type: WidthType.DXA }, shading: { fill: "2C2C2C", type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "Poste / Service", bold: true, font: "Arial", size: 18, color: "D4AF37" })] })] }),
              ]
            }),
            ...stagiaires.map((s, i) =>
              new TableRow({
                children: [
                  new TableCell({ borders: BORDERS, width: { size: 400, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${i + 1}`, font: "Arial", size: 18 })] })] }),
                  new TableCell({ borders: BORDERS, width: { size: 2800, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: s.last_name?.toUpperCase() ?? "", font: "Arial", size: 18 })] })] }),
                  new TableCell({ borders: BORDERS, width: { size: 2800, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: s.first_name ?? "", font: "Arial", size: 18 })] })] }),
                  new TableCell({ borders: BORDERS, width: { size: 3026, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: "", font: "Arial", size: 18 })] })] }),
                ]
              })
            ),
          ]
        }),

        sectionTitle("05 — PRIX ET MODALITÉS"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [3120, 6240],
          rows: [
            row2("Prix total HT", `${stagiaires.reduce((acc, s) => acc + (Number(s.tarif) || 0), 0).toLocaleString("fr-FR")} €`),
            row2("TVA", "Non applicable — Exonération art. 261-4-4° CGI"),
            row2("Prise en charge", "________________________________"),
          ]
        }),

        new Paragraph({ spacing: { before: 400, after: 100 }, children: [new TextRun({ text: `Fait à Royan, le ${fmtDate(new Date().toISOString())}`, font: "Arial", size: 20 })] }),

        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [4513, 4513],
          rows: [
            new TableRow({
              children: [
                new TableCell({ borders: BORDERS, width: { size: 4513, type: WidthType.DXA }, margins: { top: 80, bottom: 300, left: 120, right: 120 }, children: [
                  new Paragraph({ children: [new TextRun({ text: "Pour AV Sécurité Formation :", bold: true, font: "Arial", size: 20 })] }),
                  new Paragraph({ children: [new TextRun({ text: "Alexandre Villalba", font: "Arial", size: 18, italics: true })] }),
                  new Paragraph({ children: [new TextRun({ text: " ", size: 40 })] }),
                ]}),
                new TableCell({ borders: BORDERS, width: { size: 4513, type: WidthType.DXA }, margins: { top: 80, bottom: 300, left: 120, right: 120 }, children: [
                  new Paragraph({ children: [new TextRun({ text: "Pour le Client :", bold: true, font: "Arial", size: 20 })] }),
                  new Paragraph({ children: [new TextRun({ text: entreprise?.nom ?? "________________________________", font: "Arial", size: 18, italics: true })] }),
                  new Paragraph({ children: [new TextRun({ text: " ", size: 40 })] }),
                ]}),
              ]
            })
          ]
        }),
        footer(),
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Convention_${formation.type}_${fmtDate(formation.start_date).replace(/\//g, "-")}.docx`);
}