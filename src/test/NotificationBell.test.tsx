import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// Supabase mock — factory must not reference outer variables (hoisting rules).
// We use a module-level store object to hold mutable state safely.
vi.mock("@/integrations/supabase/client", () => {
  const store = {
    data: [] as any[],
  };

  const unsubscribe = vi.fn();
  const subscribe = vi.fn().mockReturnValue({ unsubscribe });
  const on = vi.fn().mockReturnValue({ subscribe });
  const channel = vi.fn().mockReturnValue({ on });

  const eqUpdate = vi.fn().mockResolvedValue({ data: null, error: null });
  const update = vi.fn().mockReturnValue({ eq: eqUpdate });

  const limit = vi.fn().mockImplementation(() => Promise.resolve({ data: store.data, error: null }));
  const order = vi.fn().mockReturnValue({ limit });
  const eqLu = vi.fn().mockReturnValue({ order });
  const eqDest = vi.fn().mockReturnValue({ eq: eqLu });
  const select = vi.fn().mockReturnValue({ eq: eqDest });
  const from = vi.fn().mockReturnValue({ select, update });

  const supabase = { from, channel, removeChannel: vi.fn(), _store: store };

  return { supabase };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "../components/NotificationBell";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockUser = { id: "user-123", email: "test@test.com" };

function setNotifData(data: any[]) {
  (supabase as any)._store.data = data;
  // Rebuild the chain so limit() returns the new data
  const limit = vi.fn().mockResolvedValue({ data, error: null });
  const order = vi.fn().mockReturnValue({ limit });
  const eqLu = vi.fn().mockReturnValue({ order });
  const eqDest = vi.fn().mockReturnValue({ eq: eqLu });
  const select = vi.fn().mockReturnValue({ eq: eqDest });
  const eqUpdate = vi.fn().mockResolvedValue({ data: null, error: null });
  const update = vi.fn().mockReturnValue({ eq: eqUpdate });
  (supabase.from as any).mockReturnValue({ select, update });
  return { update, eqUpdate };
}

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setNotifData([]);
    const unsubscribe = vi.fn();
    const subscribe = vi.fn().mockReturnValue({ unsubscribe });
    const on = vi.fn().mockReturnValue({ subscribe });
    (supabase.channel as any).mockReturnValue({ on });
  });

  it("renders nothing when not authenticated", () => {
    (useAuth as any).mockReturnValue({ user: null });
    const { container } = renderBell();
    expect(container.firstChild).toBeNull();
  });

  it("renders bell icon when authenticated", async () => {
    (useAuth as any).mockReturnValue({ user: mockUser });
    renderBell();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
    });
  });

  it("shows unread count badge when unread > 0", async () => {
    (useAuth as any).mockReturnValue({ user: mockUser });
    setNotifData([
      { id: "1", type_alerte: "90j", lu: false, created_at: new Date().toISOString(), certification_id: "cert-1" },
      { id: "2", type_alerte: "30j", lu: false, created_at: new Date().toISOString(), certification_id: "cert-2" },
      { id: "3", type_alerte: "7j",  lu: false, created_at: new Date().toISOString(), certification_id: "cert-3" },
    ]);

    renderBell();
    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  it("shows no badge when all notifications are read", async () => {
    (useAuth as any).mockReturnValue({ user: mockUser });
    setNotifData([
      { id: "1", type_alerte: "90j", lu: true, created_at: new Date().toISOString(), certification_id: "cert-1" },
    ]);

    renderBell();
    await waitFor(() => {
      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });
  });

  it("dropdown opens on click", async () => {
    (useAuth as any).mockReturnValue({ user: mockUser });
    setNotifData([]);

    renderBell();
    const button = await screen.findByRole("button", { name: /notifications/i });
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText(/^Notifications$/i)).toBeInTheDocument();
    });
  });

  it("lists notifications in the dropdown", async () => {
    (useAuth as any).mockReturnValue({ user: mockUser });
    setNotifData([
      { id: "n1", type_alerte: "30j",    lu: false, created_at: new Date(Date.now() - 3600000).toISOString(), certification_id: "cert-1" },
      { id: "n2", type_alerte: "expire", lu: false, created_at: new Date(Date.now() - 7200000).toISOString(), certification_id: "cert-2" },
    ]);

    renderBell();
    const button = await screen.findByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Alerte 30 jours")).toBeInTheDocument();
      expect(screen.getByText("Expiration")).toBeInTheDocument();
    });
  });

  it("clicking a notification marks it lu=true and navigates", async () => {
    (useAuth as any).mockReturnValue({ user: mockUser });
    const { update, eqUpdate } = setNotifData([
      { id: "n1", type_alerte: "7j", lu: false, created_at: new Date().toISOString(), certification_id: "cert-1" },
    ]);

    renderBell();
    const button = await screen.findByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    const notifItem = await screen.findByText("Alerte 7 jours");
    fireEvent.click(notifItem);

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({ lu: true });
      expect(eqUpdate).toHaveBeenCalledWith("id", "n1");
      expect(mockNavigate).toHaveBeenCalledWith("/espace-stagiaire");
    });
  });
});
