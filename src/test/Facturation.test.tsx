import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Facturation from "@/pages/Facturation";

const mockFactures = [
  { id: "1", numero: "FACT-2026-001", client_nom: "Sécurimax SARL", montant_ht: 1200, statut: "brouillon", date_emission: "2026-05-26", participant_count: 3, formation_id: null, client_adresse: null, client_siret: null, formation: null },
  { id: "2", numero: "FACT-2026-002", client_nom: "France Travail", montant_ht: 800, statut: "paye", date_emission: "2026-05-20", participant_count: 2, formation_id: null, client_adresse: null, client_siret: null, formation: null },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: mockFactures, error: null }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  },
}));

vi.mock("@/lib/generateFacturePdf", () => ({
  generateFacturePdf: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("Facturation", () => {
  it("affiche le titre et les factures", async () => {
    render(<Facturation />);
    expect(screen.getByText("Facturation")).toBeInTheDocument();
    expect(await screen.findByText("FACT-2026-001")).toBeInTheDocument();
    expect(await screen.findByText("FACT-2026-002")).toBeInTheDocument();
  });

  it("filtre par statut 'payé' ne montre que les factures payées", async () => {
    render(<Facturation />);
    await screen.findByText("FACT-2026-001");
    fireEvent.click(screen.getByRole("button", { name: /payé/i }));
    expect(screen.queryByText("FACT-2026-001")).not.toBeInTheDocument();
    expect(screen.getByText("FACT-2026-002")).toBeInTheDocument();
  });

  it("affiche le message vide si aucune facture correspond au filtre", async () => {
    render(<Facturation />);
    await screen.findByText("FACT-2026-001");
    fireEvent.click(screen.getByRole("button", { name: /envoyé/i }));
    expect(screen.getByText(/aucune facture/i)).toBeInTheDocument();
  });
});
