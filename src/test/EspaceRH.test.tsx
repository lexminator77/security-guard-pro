import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EspaceRH from "@/pages/EspaceRH";

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: (table: string) => {
        if (table === "entreprise_rh") return { select: () => ({ maybeSingle: () => Promise.resolve({ data: { entreprise_id: "ent-1" }, error: null }) }) };
        if (table === "entreprises") return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "ent-1", nom: "EHPAD Les Pins" }, error: null }) }) }) };
        if (table === "entreprise_stagiaires") return { select: () => ({ eq: () => Promise.resolve({ data: [{ stagiaire_id: "stag-1" }], error: null }) }) };
        if (table === "stagiaires") return { select: () => ({ in: () => ({ order: () => Promise.resolve({ data: [{ id: "stag-1", first_name: "Jean", last_name: "Dupont" }], error: null }) }) }) };
        if (table === "certifications") return { select: () => ({ in: () => Promise.resolve({ data: [{ id: "cert-1", stagiaire_id: "stag-1", type: "sst", date_obtention: "2024-01-01", date_expiration: "2026-01-01", source: "auto" }], error: null }) }) };
        if (table === "formation_participants") return { select: () => ({ in: () => ({ gte: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) };
        if (table === "stagiaire_documents") return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
        return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
      },
      auth: { signOut: vi.fn() },
    },
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-rh-1" }, signOut: vi.fn() }),
}));

const renderPage = () =>
  render(<MemoryRouter><EspaceRH /></MemoryRouter>);

describe("EspaceRH", () => {
  it("shows loading state initially", () => {
    renderPage();
    expect(screen.getByText(/chargement/i)).toBeInTheDocument();
  });

  it("shows company name after load", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("EHPAD Les Pins")).toBeInTheDocument());
  });

  it("lists agents", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Jean Dupont")).toBeInTheDocument());
  });

  it("shows certifications for each agent", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("SST")).toBeInTheDocument());
  });

  it("shows empty documents state when no documents", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/aucun document/i)).toBeInTheDocument());
  });

  it("shows empty formations state when no upcoming formations", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/aucune formation/i)).toBeInTheDocument());
  });
});
