// src/test/PasseportPrevention.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PasseportPrevention from "@/pages/PasseportPrevention";

const mockStagiaire = {
  id: "s1",
  first_name: "Jean",
  last_name: "Dupont",
  birth_date: "1990-05-15",
  email: "jean@example.com",
  phone: "0600000000",
  carte_pro_number: "CNAPS-001",
  carte_pro_expiry: "2027-01-01",
  autorisation_numero: null,
  autorisation_type: null,
  autorisation_expiry: null,
};

const mockParticipations = [
  {
    status: "valide",
    resultat: "obtenu",
    formation: { title: "Formation SST", type: "SST", start_date: "2026-04-01", end_date: "2026-04-02", duration_hours: 14 },
  },
  {
    status: "present",
    resultat: null,
    formation: { title: "Formation CQP", type: "CQP", start_date: "2026-03-01", end_date: "2026-03-03", duration_hours: 21 },
  },
];

const mockCertifications = [
  {
    type: "sst",
    date_obtention: "2026-04-02",
    date_expiration: "2026-01-01", // passé → expiré
    formation: { title: "Formation SST" },
  },
  {
    type: "mac_aps",
    date_obtention: "2026-05-01",
    date_expiration: "2028-05-01", // futur → valide
    formation: null,
  },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "stagiaires") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockStagiaire, error: null }),
            }),
          }),
        };
      }
      if (table === "formation_participants") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockParticipations, error: null }),
            }),
          }),
        };
      }
      if (table === "certifications") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockCertifications, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "admin@test.com" }, roles: ["administrateur"] }),
}));

vi.mock("@/lib/generatePasseportPdf", () => ({
  generatePasseportPdf: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/passeport-prevention/s1"]}>
      <Routes>
        <Route path="/passeport-prevention/:stagiaireId" element={<PasseportPrevention />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PasseportPrevention", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("affiche l'identité et les formations du stagiaire", async () => {
    renderPage();
    expect(await screen.findByText(/DUPONT/)).toBeInTheDocument();
    expect((await screen.findAllByText("Formation SST")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Formation CQP")).toBeInTheDocument();
  });

  it("affiche badge Expiré pour certification passée et Valide pour certification future", async () => {
    renderPage();
    await screen.findByText(/DUPONT/);
    expect(screen.getByText("Expiré")).toBeInTheDocument();
    expect(screen.getByText("Valide")).toBeInTheDocument();
  });

  it("clic sur Télécharger appelle generatePasseportPdf", async () => {
    const { generatePasseportPdf } = await import("@/lib/generatePasseportPdf");
    renderPage();
    const btn = await screen.findByRole("button", { name: /télécharger/i });
    fireEvent.click(btn);
    await waitFor(() => expect(generatePasseportPdf).toHaveBeenCalled());
  });
});
