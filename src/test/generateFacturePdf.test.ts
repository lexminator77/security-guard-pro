import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateFacturePdf } from "@/lib/generateFacturePdf";

const mockSave = vi.fn();
const mockText = vi.fn();
const mockDoc: any = {
  setFontSize: vi.fn(),
  setFont: vi.fn(),
  setTextColor: vi.fn(),
  setFillColor: vi.fn(),
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  rect: vi.fn(),
  line: vi.fn(),
  text: mockText,
  internal: { pageSize: { height: 297, width: 210 } },
  save: mockSave,
  splitTextToSize: vi.fn().mockReturnValue(["mocked text"]),
};

vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(() => mockDoc),
}));

vi.mock("jspdf-autotable", () => ({
  default: vi.fn().mockImplementation((doc: any) => {
    doc.lastAutoTable = { finalY: 180 };
  }),
}));

const facture = {
  numero: "FACT-2026-001",
  client_nom: "Sécurimax SARL",
  client_adresse: "12 rue des Lilas, 75001 Paris",
  client_siret: "123 456 789 00012",
  montant_ht: 1200,
  date_emission: "2026-05-26",
  participant_count: 3,
};

const formation = {
  title: "Formation SST", type: "SST",
  start_date: "2026-05-26", end_date: "2026-05-27",
  duration_hours: 14,
};

describe("generateFacturePdf", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sauvegarde le PDF avec le bon nom de fichier", () => {
    generateFacturePdf(facture, formation);
    expect(mockSave).toHaveBeenCalledWith("facture_FACT-2026-001.pdf");
  });

  it("inclut la mention TVA obligatoire (art. 261-4-4°)", () => {
    generateFacturePdf(facture, formation);
    const textCalls = mockText.mock.calls.flat();
    expect(textCalls.some((a: any) => typeof a === "string" && a.includes("261-4-4"))).toBe(true);
  });

  it("inclut le label 'Pénalités de retard'", () => {
    generateFacturePdf(facture, formation);
    const textCalls = mockText.mock.calls.flat();
    expect(textCalls.some((a: any) => typeof a === "string" && a.includes("Pénalités"))).toBe(true);
  });

  it("ne crash pas si formation null", () => {
    generateFacturePdf(facture, null);
    expect(mockSave).toHaveBeenCalled();
  });
});
