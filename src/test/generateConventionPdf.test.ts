import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateConventionPdf } from "@/lib/generateConventionPdf";

const mockSave = vi.fn();
const mockText = vi.fn();
const mockDoc: any = {
  setFontSize: vi.fn(),
  setFont: vi.fn(),
  setTextColor: vi.fn(),
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  line: vi.fn(),
  text: mockText,
  internal: { pageSize: { height: 297, width: 210 } },
  save: mockSave,
  splitTextToSize: vi.fn().mockReturnValue(["mocked"]),
};

vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(() => mockDoc),
}));

vi.mock("jspdf-autotable", () => ({
  default: vi.fn().mockImplementation((doc: any) => {
    doc.lastAutoTable = { finalY: 150 };
  }),
}));

const formation = {
  id: "f1", title: "Formation SST", type: "SST",
  start_date: "2026-05-26", end_date: "2026-05-27",
  location: "Paris", duration_hours: 14,
};
const participants = [{ last_name: "Dupont", first_name: "Jean", tarif: 600 }];
const formateur = { first_name: "Marie", last_name: "Martin" };

const buildMock = (entreprises: any[]) => ({
  from: () => ({
    select: () => Promise.resolve({ data: entreprises, error: null }),
  }),
});

describe("generateConventionPdf", () => {
  beforeEach(() => vi.clearAllMocks());

  it("génère et sauvegarde le PDF avec le bon nom", async () => {
    await generateConventionPdf(formation, participants, formateur, buildMock([]) as any);
    expect(mockSave).toHaveBeenCalledWith("convention_SST_2026-05-26.pdf");
  });

  it("inclut le nom entreprise si une seule en DB", async () => {
    const e = [{ nom: "Sécurimax SARL", contact_nom: "Leblanc", contact_prenom: "Paul", adresse: "12 rue des Lilas", code_postal: "75001", ville: "Paris", email: "contact@securimax.fr", telephone: "0123456789", siret: "12345678900012" }];
    await generateConventionPdf(formation, participants, formateur, buildMock(e) as any);
    const textCalls = mockText.mock.calls.flat();
    expect(textCalls.some((a: any) => typeof a === "string" && a.includes("Sécurimax"))).toBe(true);
  });

  it("ne crash pas si plusieurs entreprises (section client laissée vide)", async () => {
    await generateConventionPdf(formation, participants, formateur, buildMock([{ nom: "A" }, { nom: "B" }]) as any);
    expect(mockSave).toHaveBeenCalled();
  });

  it("ne crash pas si formateur null", async () => {
    await generateConventionPdf(formation, participants, null, buildMock([]) as any);
    expect(mockSave).toHaveBeenCalled();
  });

  it("lance une erreur si Supabase échoue", async () => {
    const failMock = {
      from: () => ({
        select: () => Promise.resolve({ data: null, error: { message: "DB error" } }),
      }),
    };
    await expect(
      generateConventionPdf(formation, participants, formateur, failMock as any)
    ).rejects.toThrow("DB error");
  });
});
