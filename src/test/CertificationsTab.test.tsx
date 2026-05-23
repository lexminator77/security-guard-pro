import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Supabase mock ─────────────────────────────────────────────────────────────
// All builders are module-level so they can be reassigned per test.

let mockSelectResolve: (val: any) => void;
let mockUpsertResolve: (val: any) => void;
let mockUpdateResolve: (val: any) => void;
let mockDeleteResolve: (val: any) => void;

// We build a fresh chain for each test via resetMocks() below.
const mockEqDelete = vi.fn();
const mockDelete = vi.fn();
const mockEqUpdate = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();
const mockEqSelect = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      get from() {
        return mockFrom;
      },
    },
  };
});

function buildChain(certsData: any[] = []) {
  // SELECT chain: from().select().eq()
  mockEqSelect.mockResolvedValue({ data: certsData, error: null });
  mockSelect.mockReturnValue({ eq: mockEqSelect });

  // UPSERT chain: from().upsert()
  mockUpsert.mockResolvedValue({ data: null, error: null });

  // UPDATE chain: from().update().eq()
  mockEqUpdate.mockResolvedValue({ data: null, error: null });
  mockUpdate.mockReturnValue({ eq: mockEqUpdate });

  // DELETE chain: from().delete().eq()
  mockEqDelete.mockResolvedValue({ data: null, error: null });
  mockDelete.mockReturnValue({ eq: mockEqDelete });

  mockFrom.mockReturnValue({
    select: mockSelect,
    upsert: mockUpsert,
    update: mockUpdate,
    delete: mockDelete,
  });
}

// ─── Import component after mocks ─────────────────────────────────────────────
import { CertificationsTab } from "../components/CertificationsTab";

// ─── Test data ─────────────────────────────────────────────────────────────────

const FUTURE_VALIDE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 120);
  return d.toISOString().slice(0, 10);
})();

const FUTURE_RENOUVELER = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d.toISOString().slice(0, 10);
})();

const FUTURE_URGENT = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().slice(0, 10);
})();

const PAST_EXPIRE = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 10);
  return d.toISOString().slice(0, 10);
})();

const CERT_1 = {
  id: "cert-1",
  stagiaire_id: "stag-1",
  type: "sst",
  date_obtention: "2024-01-01",
  date_expiration: FUTURE_VALIDE,
  source: "auto",
  formation_id: null,
  notes: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const CERT_2 = {
  id: "cert-2",
  stagiaire_id: "stag-1",
  type: "epi",
  date_obtention: "2024-06-01",
  date_expiration: FUTURE_RENOUVELER,
  source: "manuel",
  formation_id: null,
  notes: "Note test",
  created_at: "2024-06-01T00:00:00Z",
  updated_at: "2024-06-01T00:00:00Z",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CertificationsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildChain([]);
  });

  // ── 1. Loading state ────────────────────────────────────────────────────────
  it("renders loading state initially", () => {
    // Keep the promise pending
    mockEqSelect.mockReturnValue(new Promise(() => {}));
    mockSelect.mockReturnValue({ eq: mockEqSelect });
    mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert, update: mockUpdate, delete: mockDelete });

    render(<CertificationsTab stagiaireId="stag-1" />);
    expect(screen.getByText(/chargement/i)).toBeInTheDocument();
  });

  // ── 2. Renders certifications table ────────────────────────────────────────
  it("renders certifications table with 2 rows", async () => {
    buildChain([CERT_1, CERT_2]);

    render(<CertificationsTab stagiaireId="stag-1" />);

    await waitFor(() => {
      expect(screen.getByText("SST")).toBeInTheDocument();
      expect(screen.getByText("EPI / Extincteurs")).toBeInTheDocument();
    });
  });

  // ── 3. Empty state ──────────────────────────────────────────────────────────
  it("shows empty state when no certifications", async () => {
    buildChain([]);

    render(<CertificationsTab stagiaireId="stag-1" />);

    await waitFor(() => {
      expect(screen.getByText(/aucune certification/i)).toBeInTheDocument();
    });
  });

  // ── 4. Correct status badge class for valide ────────────────────────────────
  it("shows Valide badge for >90 days", async () => {
    buildChain([CERT_1]);

    render(<CertificationsTab stagiaireId="stag-1" />);

    await waitFor(() => {
      expect(screen.getByText("Valide")).toBeInTheDocument();
    });
    const badge = screen.getByText("Valide");
    expect(badge.className).toMatch(/success/);
  });

  // ── 5. Correct status badge class for renouveler ────────────────────────────
  it("shows À renouveler badge for 30-90 days", async () => {
    buildChain([CERT_2]);

    render(<CertificationsTab stagiaireId="stag-1" />);

    await waitFor(() => {
      expect(screen.getByText("À renouveler")).toBeInTheDocument();
    });
    const badge = screen.getByText("À renouveler");
    expect(badge.className).toMatch(/warning/);
  });

  // ── 6. Correct status badge class for urgent ────────────────────────────────
  it("shows Urgent badge for <30 days", async () => {
    const urgentCert = { ...CERT_1, id: "cert-urgent", type: "ssiap1", date_expiration: FUTURE_URGENT };
    buildChain([urgentCert]);

    render(<CertificationsTab stagiaireId="stag-1" />);

    await waitFor(() => {
      expect(screen.getByText("Urgent")).toBeInTheDocument();
    });
    const badge = screen.getByText("Urgent");
    expect(badge.className).toMatch(/orange/);
  });

  // ── 7. Correct status badge class for expire ────────────────────────────────
  it("shows Expiré badge for past date", async () => {
    const expiredCert = { ...CERT_1, id: "cert-exp", type: "h0b0", date_expiration: PAST_EXPIRE };
    buildChain([expiredCert]);

    render(<CertificationsTab stagiaireId="stag-1" />);

    await waitFor(() => {
      expect(screen.getByText("Expiré")).toBeInTheDocument();
    });
    const badge = screen.getByText("Expiré");
    expect(badge.className).toMatch(/destructive/);
  });

  // ── 8. Source column ────────────────────────────────────────────────────────
  it("shows Automatique for source=auto and Manuel for source=manuel", async () => {
    buildChain([CERT_1, CERT_2]);

    render(<CertificationsTab stagiaireId="stag-1" />);

    await waitFor(() => {
      expect(screen.getByText("Automatique")).toBeInTheDocument();
      expect(screen.getByText("Manuel")).toBeInTheDocument();
    });
  });

  // ── 9. Opens add dialog on button click ─────────────────────────────────────
  it("opens add dialog when button is clicked", async () => {
    buildChain([]);

    render(<CertificationsTab stagiaireId="stag-1" />);

    await waitFor(() => {
      expect(screen.queryByText(/chargement/i)).not.toBeInTheDocument();
    });

    const addButton = screen.getByRole("button", { name: /ajouter une certification/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  // ── 10. Computes expiration date in dialog ───────────────────────────────────
  it("computes and displays expiration date when type and date are selected", async () => {
    buildChain([]);
    const user = userEvent.setup();

    render(<CertificationsTab stagiaireId="stag-1" />);

    await waitFor(() => {
      expect(screen.queryByText(/chargement/i)).not.toBeInTheDocument();
    });

    const addButton = screen.getByRole("button", { name: /ajouter une certification/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill the date input
    const dateInput = screen.getByLabelText(/date d.obtention/i);
    await user.clear(dateInput);
    await user.type(dateInput, "2026-01-01");
    fireEvent.change(dateInput, { target: { value: "2026-01-01" } });

    // The SST type should be pre-selected (first option); expiration should be displayed
    await waitFor(() => {
      // SST = 24 months → 2028-01-01
      expect(screen.getByText(/expire le/i)).toBeInTheDocument();
    });
  });

  // ── 11. Calls supabase upsert on form submit ────────────────────────────────
  it("calls supabase upsert with correct data on form submit", async () => {
    buildChain([]);

    render(<CertificationsTab stagiaireId="stag-1" />);

    await waitFor(() => {
      expect(screen.queryByText(/chargement/i)).not.toBeInTheDocument();
    });

    const addButton = screen.getByRole("button", { name: /ajouter une certification/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Fill date
    const dateInput = screen.getByLabelText(/date d.obtention/i);
    fireEvent.change(dateInput, { target: { value: "2026-01-01" } });

    // Submit
    const submitButton = screen.getByRole("button", { name: /enregistrer/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("certifications");
      expect(mockUpsert).toHaveBeenCalled();
    });

    const upsertArg = mockUpsert.mock.calls[0][0];
    expect(upsertArg).toMatchObject({
      stagiaire_id: "stag-1",
      source: "manuel",
      date_obtention: "2026-01-01",
    });
    expect(upsertArg).toHaveProperty("type");
    expect(upsertArg).toHaveProperty("date_expiration");
  });

  // ── 12. Delete calls supabase delete after confirm ─────────────────────────
  it("calls supabase delete when trash button is clicked and confirmed", async () => {
    buildChain([CERT_1]);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<CertificationsTab stagiaireId="stag-1" />);

    await waitFor(() => {
      expect(screen.getByText("SST")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /supprimer/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("certifications");
      expect(mockDelete).toHaveBeenCalled();
    });

    vi.restoreAllMocks();
  });

  // ── 13. Edit dialog pre-fills existing values ──────────────────────────────
  it("opens edit dialog pre-filled with existing certification data", async () => {
    buildChain([CERT_1]);

    render(<CertificationsTab stagiaireId="stag-1" />);

    await waitFor(() => {
      expect(screen.getByText("SST")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole("button", { name: /modifier/i });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const dateInput = screen.getByLabelText(/date d.obtention/i) as HTMLInputElement;
    expect(dateInput.value).toBe("2024-01-01");
  });
});
