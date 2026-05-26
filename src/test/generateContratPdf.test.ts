import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateContratPdf } from "@/lib/generateContratPdf";

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
  addPage: vi.fn(),
};

vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(() => mockDoc),
}));

vi.mock("jspdf-autotable", () => ({
  default: vi.fn().mockImplementation((doc: any) => {
    doc.lastAutoTable = { finalY: 150 };
  }),
}));

const stagiaire = { id: "s1", first_name: "Jean", last_name: "Dupont", email: "jean@example.com" };
const formation = { title: "Formation SST", type: "SST", start_date: "2026-05-26", end_date: "2026-05-27", location: "Paris", duration_hours: 14 };

const buildMock = (addressData: any) => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: addressData, error: null }),
      }),
    }),
  }),
});

describe("generateContratPdf", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sauvegarde le PDF avec le bon nom de fichier", async () => {
    await generateContratPdf(stagiaire, formation, 600, "particulier", buildMock({ address: "12 rue des Lilas", city: "Paris", postal_code: "75001" }) as any);
    expect(mockSave).toHaveBeenCalledWith("contrat_DUPONT_Jean_2026-05-26.pdf");
  });

  it("inclut le nom du stagiaire dans le PDF", async () => {
    await generateContratPdf(stagiaire, formation, 600, "particulier", buildMock({ address: "12 rue des Lilas", city: "Paris", postal_code: "75001" }) as any);
    const textCalls = mockText.mock.calls.flat();
    expect(textCalls.some((a: any) => typeof a === "string" && a.includes("Dupont"))).toBe(true);
  });

  it("inclut la mention délai de rétractation 10 jours", async () => {
    await generateContratPdf(stagiaire, formation, 600, "particulier", buildMock({ address: null, city: null, postal_code: null }) as any);
    const textCalls = mockText.mock.calls.flat();
    expect(textCalls.some((a: any) => typeof a === "string" && a.includes("10"))).toBe(true);
  });

  it("inclut la mention TVA art. 261-4-4°", async () => {
    await generateContratPdf(stagiaire, formation, 600, "cpf", buildMock({ address: null, city: null, postal_code: null }) as any);
    const textCalls = mockText.mock.calls.flat();
    expect(textCalls.some((a: any) => typeof a === "string" && a.includes("261-4-4"))).toBe(true);
  });

  it("ne crash pas si adresse manquante (pointillés)", async () => {
    await generateContratPdf(stagiaire, formation, null, "particulier", buildMock({ address: null, city: null, postal_code: null }) as any);
    expect(mockSave).toHaveBeenCalled();
  });

  it("mentionne 'CPF' si financement CPF", async () => {
    await generateContratPdf(stagiaire, formation, 600, "cpf", buildMock({ address: null, city: null, postal_code: null }) as any);
    const textCalls = mockText.mock.calls.flat();
    expect(textCalls.some((a: any) => typeof a === "string" && a.includes("CPF"))).toBe(true);
  });
});
