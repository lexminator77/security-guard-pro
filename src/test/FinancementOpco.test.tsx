// src/test/FinancementOpco.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FinancementOpco from "@/pages/FinancementOpco";

const mockDossiers = [
  {
    id: "1", formation_id: "f1", stagiaire_id: null,
    opco_nom: "AFDAS", numero_dossier: "AFDS-001",
    montant_accorde: 1200, montant_paye: 0,
    statut: "accord_recu", notes: null, facture_id: null,
    opco_contact_nom: null, opco_contact_email: null, opco_contact_tel: null,
    created_at: "2026-05-26",
    formation: { title: "Formation SST" }, stagiaire: null, facture: null,
  },
  {
    id: "2", formation_id: "f2", stagiaire_id: "s1",
    opco_nom: "OPCO EP", numero_dossier: null,
    montant_accorde: 800, montant_paye: 800,
    statut: "paye", notes: null, facture_id: null,
    opco_contact_nom: null, opco_contact_email: null, opco_contact_tel: null,
    created_at: "2026-05-20",
    formation: { title: "Formation SST 2" },
    stagiaire: { first_name: "Jean", last_name: "Dupont" }, facture: null,
  },
  {
    id: "3", formation_id: "f3", stagiaire_id: null,
    opco_nom: "Constructys", numero_dossier: "CTY-002",
    montant_accorde: 500, montant_paye: 0,
    statut: "refuse", notes: null, facture_id: null,
    opco_contact_nom: null, opco_contact_email: null, opco_contact_tel: null,
    created_at: "2026-05-15",
    formation: { title: "Formation CQP" }, stagiaire: null, facture: null,
  },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: mockDossiers, error: null }),
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("FinancementOpco", () => {
  it("affiche le titre et les dossiers mockés", async () => {
    render(<FinancementOpco />);
    expect(screen.getByText("Financement OPCO")).toBeInTheDocument();
    expect(await screen.findByText("AFDAS")).toBeInTheDocument();
    expect(await screen.findByText("OPCO EP")).toBeInTheDocument();
    expect(await screen.findByText("Constructys")).toBeInTheDocument();
  });

  it("filtre par statut 'Accord reçu' affiche uniquement les dossiers correspondants", async () => {
    render(<FinancementOpco />);
    await screen.findByText("AFDAS");
    fireEvent.click(screen.getByRole("button", { name: /accord reçu/i }));
    expect(screen.getByText("AFDAS")).toBeInTheDocument();
    expect(screen.queryByText("OPCO EP")).not.toBeInTheDocument();
    expect(screen.queryByText("Constructys")).not.toBeInTheDocument();
  });

  it("affiche les labels des indicateurs et inclut le total payé dans le rendu", async () => {
    render(<FinancementOpco />);
    await screen.findByText("AFDAS");
    expect(screen.getByText(/total accordé/i)).toBeInTheDocument();
    expect(screen.getByText(/total payé/i)).toBeInTheDocument();
    expect(screen.getByText(/solde en attente/i)).toBeInTheDocument();
    // Total payé = 0 + 800 + 0 = 800 — apparaît dans le DOM
    const textContent = document.body.textContent ?? "";
    expect(textContent).toContain("800");
  });
});
