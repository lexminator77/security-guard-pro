// src/test/VerificationCNAPS.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import VerificationCNAPS from "@/pages/VerificationCNAPS";

const mockAgents = [
  {
    id: "s1", first_name: "Jean", last_name: "Dupont",
    carte_pro_number: "CNAPS-001",
    cnaps_statut: "vert", cnaps_last_checked: "2026-05-20T10:00:00Z",
  },
  {
    id: "s2", first_name: "Paul", last_name: "Martin",
    carte_pro_number: "CNAPS-002",
    cnaps_statut: "rouge", cnaps_last_checked: "2026-05-15T08:00:00Z",
  },
  {
    id: "s3", first_name: "Marc", last_name: "Durand",
    carte_pro_number: null,
    cnaps_statut: "inconnu", cnaps_last_checked: null,
  },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    supabaseUrl: "https://test.supabase.co",
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "test-token" } } }),
    },
    from: (table: string) => {
      if (table === "stagiaires") {
        return {
          select: () => ({
            order: () => Promise.resolve({ data: mockAgents, error: null }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      return {
        select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      };
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, roles: ["administrateur"] }),
}));

const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ ok: true, processed: 3, results: [] }),
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <VerificationCNAPS />
    </MemoryRouter>
  );
}

describe("VerificationCNAPS", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", mockFetch); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("affiche le tableau avec les 3 agents et leurs badges", async () => {
    renderPage();
    expect(await screen.findByText("DUPONT")).toBeInTheDocument();
    expect(screen.getByText("MARTIN")).toBeInTheDocument();
    expect(screen.getByText("DURAND")).toBeInTheDocument();
    expect(screen.getByText("Valide")).toBeInTheDocument();
    expect(screen.getByText("Problème")).toBeInTheDocument();
    expect(screen.getByText("Inconnu")).toBeInTheDocument();
  });

  it("filtre 'Problème' ne montre que l'agent rouge", async () => {
    renderPage();
    await screen.findByText("DUPONT");
    fireEvent.click(screen.getByRole("button", { name: /problème/i }));
    await waitFor(() => {
      expect(screen.queryByText("DUPONT")).not.toBeInTheDocument();
      expect(screen.getByText("MARTIN")).toBeInTheDocument();
    });
  });

  it("bouton 'Vérifier tous' déclenche un POST vers la Edge Function", async () => {
    renderPage();
    await screen.findByText("DUPONT");
    fireEvent.click(screen.getByRole("button", { name: /vérifier tous/i }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("verify-cnaps"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
