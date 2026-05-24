import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import QuestionnairePublic from "@/pages/QuestionnairePublic";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const renderPage = (token = "test-token-uuid") =>
  render(
    <MemoryRouter initialEntries={[`/q/${token}`]}>
      <Routes>
        <Route path="/q/:token" element={<QuestionnairePublic />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => { mockFetch.mockReset(); });

describe("QuestionnairePublic", () => {
  it("shows loading initially", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/chargement/i)).toBeInTheDocument();
  });

  it("shows error when token not found (404)", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: "Token not found" }) });
    renderPage();
    await waitFor(() => expect(screen.getByText(/lien invalide/i)).toBeInTheDocument());
  });

  it("shows already completed message (409)", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "Already completed" }) });
    renderPage();
    await waitFor(() => expect(screen.getByText(/déjà rempli/i)).toBeInTheDocument());
  });

  it("renders questionnaire form on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        type: "positionnement",
        formation_title: "Formation SST",
        stagiaire_name: "Jean Dupont",
      }),
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/positionnement/i)).toBeInTheDocument());
    expect(screen.getByText("Formation SST")).toBeInTheDocument();
  });

  it("submit button calls submit endpoint", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: "satisfaction_chaud",
          formation_title: "SST",
          stagiaire_name: "Marie Martin",
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    renderPage();
    await waitFor(() => expect(screen.getByText(/satisfaction à chaud/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});
