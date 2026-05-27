import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const makeDate = (daysFromNow: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};

const mockFormation = (startOffset: number, endOffset: number) => ({
  id: "f1", title: "Formation SST", type: "SST",
  start_date: makeDate(startOffset),
  end_date: makeDate(endOffset),
  location: null,
});

let mockFormations: any[] = [];

const buildSupabaseMock = (formations: any[]) => ({
  auth: {
    getUser: () => Promise.resolve({ data: { user: { id: "u1", email: "jean@test.fr" } }, error: null }),
    signOut: () => Promise.resolve({}),
    onAuthStateChange: (_: any, cb: any) => { cb("SIGNED_IN", { user: { id: "u1" } }); return { data: { subscription: { unsubscribe: () => {} } } }; },
    getSession: () => Promise.resolve({ data: { session: { access_token: "tok" } }, error: null }),
  },
  from: (table: string) => {
    if (table === "stagiaires") return {
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: "s1", first_name: "Jean", last_name: "Dupont", email: "jean@test.fr", status: "valide" }, error: null }) }) }),
    };
    if (table === "formation_participants") return {
      select: () => ({ eq: () => Promise.resolve({ data: formations.map(f => ({ formation: f })), error: null }) }),
    };
    return {
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          order: () => Promise.resolve({ data: [], error: null }),
        }),
        in: () => ({ order: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    };
  },
  rpc: () => Promise.resolve({ data: null, error: null }),
  storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  channel: () => ({ on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }) }),
});

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() { return buildSupabaseMock(mockFormations); },
}));
vi.mock("@/components/MainCourante", () => ({
  PageMainCourante: () => null,
  ConsignesStagiaire: () => null,
  PermisFeuStagiaire: () => null,
  StatistiquesStagiaire: () => null,
  RondierStagiaire: () => null,
}));
vi.mock("@/lib/certificationUtils", () => ({
  CERT_LABELS: {},
  RECYCLAGE_TYPE: {},
  certStatusBadge: () => ({ status: "valide", label: "Valide", className: "" }),
  daysUntilExpiry: () => 100,
}));

describe("EspaceStagiaire — fenêtre d'accès", () => {
  beforeEach(() => { vi.resetModules(); });

  it("affiche le dashboard quand une formation est active", async () => {
    mockFormations = [mockFormation(-2, 5)];
    const { default: ES } = await import("@/pages/EspaceStagiaire");
    render(<MemoryRouter><ES /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.queryByText(/expiré/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/ouvrira le/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/aucune formation associée/i)).not.toBeInTheDocument();
    });
  });

  it("affiche message expiré quand formation terminée depuis > 15j", async () => {
    mockFormations = [mockFormation(-30, -20)];
    const { default: ES } = await import("@/pages/EspaceStagiaire");
    render(<MemoryRouter><ES /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/expiré/i)).toBeInTheDocument());
  });

  it("affiche message futur quand formation n'a pas encore débuté", async () => {
    mockFormations = [mockFormation(10, 15)];
    const { default: ES } = await import("@/pages/EspaceStagiaire");
    render(<MemoryRouter><ES /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/ouvrira le/i)).toBeInTheDocument());
  });

  it("affiche message aucune formation si liste vide", async () => {
    mockFormations = [];
    const { default: ES } = await import("@/pages/EspaceStagiaire");
    render(<MemoryRouter><ES /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/aucune formation associée/i)).toBeInTheDocument());
  });
});

describe("EspaceStagiaire — onglet Paramètres", () => {
  it("affiche le formulaire de changement de mot de passe", async () => {
    mockFormations = [mockFormation(-2, 5)];
    const EspaceStagiaire = (await import("@/pages/EspaceStagiaire")).default;
    render(<MemoryRouter><EspaceStagiaire /></MemoryRouter>);
    await waitFor(() => screen.getByText(/tableau de bord/i));
    const btn = screen.getByRole("button", { name: /paramètres/i });
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByText(/changer mon mot de passe/i)).toBeInTheDocument());
  });
});
