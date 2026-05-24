import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Reclamations from "@/pages/Reclamations";

const mockReclamations = [
  {
    id: "rec-1",
    date_reclamation: "2026-05-20",
    demandeur_nom: "Jean Dupont",
    demandeur_type: "stagiaire",
    objet: "Absence du formateur",
    description: "Le formateur était absent le premier jour.",
    statut: "ouverte",
    reponse: null,
    date_cloture: null,
    created_at: "2026-05-20T10:00:00Z",
  },
  {
    id: "rec-2",
    date_reclamation: "2026-04-10",
    demandeur_nom: "ACME SÉCURITÉ",
    demandeur_type: "entreprise",
    objet: "Support manquant",
    description: "Aucun support remis.",
    statut: "cloturee",
    reponse: "Support envoyé par email.",
    date_cloture: "2026-04-15",
    created_at: "2026-04-10T09:00:00Z",
  },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "reclamations") {
        return {
          select: () => ({ order: () => Promise.resolve({ data: mockReclamations, error: null }) }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: mockReclamations[0], error: null }) }) }),
          update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        };
      }
      return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) };
    },
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, roles: ["administrateur"] }),
}));

const renderPage = () => render(<MemoryRouter><Reclamations /></MemoryRouter>);

describe("Reclamations", () => {
  it("shows page title", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/réclamations/i)).toBeInTheDocument());
  });

  it("lists reclamations after load", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Absence du formateur")).toBeInTheDocument());
    expect(screen.getByText(/ACME SÉCURITÉ/)).toBeInTheDocument();
  });

  it("shows open count badge", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
  });

  it("filters by statut ouverte", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Absence du formateur"));
    fireEvent.click(screen.getByRole("button", { name: /ouvertes/i }));
    expect(screen.getByText("Absence du formateur")).toBeInTheDocument();
  });

  it("shows create button", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /nouvelle/i })).toBeInTheDocument());
  });
});
