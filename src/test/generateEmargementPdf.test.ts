import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateEmargementPdf } from "@/lib/generateEmargementPdf";

const mockSave = vi.fn();
const mockText = vi.fn();
const mockSetFontSize = vi.fn();
const mockAddImage = vi.fn();
const mockDoc: any = {
  setFontSize: mockSetFontSize,
  setTextColor: vi.fn(),
  setFont: vi.fn(),
  text: mockText,
  addImage: mockAddImage,
  internal: { pageSize: { height: 297, width: 210 } },
  save: mockSave,
};

vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(() => mockDoc),
}));

vi.mock("jspdf-autotable", () => ({
  default: vi.fn().mockImplementation((doc: any, options: any) => {
    doc.lastAutoTable = { finalY: 100 };
    // Simulate didDrawCell for body cells with _sig
    if (options?.didDrawCell && options?.body) {
      for (let rowIdx = 0; rowIdx < options.body.length; rowIdx++) {
        const row = options.body[rowIdx];
        for (let colIdx = 1; colIdx < row.length; colIdx++) {
          const cell = row[colIdx];
          if (cell?._sig) {
            options.didDrawCell({
              section: "body",
              column: { index: colIdx },
              cell: { raw: cell, x: 0, y: 0, width: 30, height: 18 },
            });
          }
        }
      }
    }
  }),
}));

const buildSupabaseMock = (esData: any[], efData: any[]) => ({
  from: (table: string) => ({
    select: () => ({
      eq: () => Promise.resolve({
        data: table === "emargements_stagiaire" ? esData : efData,
        error: null,
      }),
    }),
  }),
});

describe("generateEmargementPdf", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("génère un PDF et appelle doc.save() avec le bon nom", async () => {
    const supabase = buildSupabaseMock(
      [{ stagiaire_id: "s1", date: "2026-05-26", periode: "matin", signature_data: "data:image/png;base64,abc", stagiaire: { id: "s1", first_name: "Jean", last_name: "Dupont" } }],
      [{ formateur_id: "f1", date: "2026-05-26", periode: "matin", signature_data: "data:image/png;base64,xyz", formateur: { id: "f1", first_name: "Marie", last_name: "Martin" } }]
    );
    const formation = { id: "f1", title: "Formation SST", type: "SST", start_date: "2026-05-26", end_date: "2026-05-26" };
    await generateEmargementPdf(formation as any, supabase as any);
    expect(mockSave).toHaveBeenCalledWith(expect.stringContaining("emargement"));
  });

  it("génère un PDF sans erreur si aucun émargement", async () => {
    const supabase = buildSupabaseMock([], []);
    const formation = { id: "f1", title: "Formation Vide", type: "SST", start_date: "2026-05-26", end_date: "2026-05-26" };
    await generateEmargementPdf(formation as any, supabase as any);
    expect(mockSave).toHaveBeenCalled();
  });

  it("appelle addImage pour les cellules avec signature", async () => {
    const supabase = buildSupabaseMock(
      [{ stagiaire_id: "s1", date: "2026-05-26", periode: "matin", signature_data: "data:image/png;base64,abc", stagiaire: { id: "s1", first_name: "Jean", last_name: "Dupont" } }],
      []
    );
    const formation = { id: "f1", title: "Formation SST", type: "SST", start_date: "2026-05-26", end_date: "2026-05-26" };
    await generateEmargementPdf(formation as any, supabase as any);
    expect(mockAddImage).toHaveBeenCalled();
  });
});
