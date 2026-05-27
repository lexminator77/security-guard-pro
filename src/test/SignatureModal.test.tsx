import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { SignatureModal } from "@/components/SignatureModal";

const mockPad = {
  isEmpty: vi.fn().mockReturnValue(true),
  toDataURL: vi.fn().mockReturnValue("data:image/png;base64,abc123"),
  clear: vi.fn(),
  off: vi.fn(),
};

vi.mock("signature_pad", () => ({
  default: vi.fn().mockImplementation(() => mockPad),
}));

describe("SignatureModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockPad.isEmpty.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("affiche le dialog quand open=true", () => {
    render(
      <SignatureModal
        open={true}
        title="Signature — Matin"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Signature — Matin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /effacer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmer/i })).toBeInTheDocument();
  });

  it("appelle isEmpty au clic Confirmer si canvas vide", async () => {
    mockPad.isEmpty.mockReturnValue(true);
    render(
      <SignatureModal
        open={true}
        title="Signature — Matin"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await act(async () => { vi.advanceTimersByTime(150); });
    fireEvent.click(screen.getByRole("button", { name: /confirmer/i }));
    expect(mockPad.isEmpty).toHaveBeenCalled();
  });

  it("appelle onConfirm avec base64 si canvas non vide", async () => {
    mockPad.isEmpty.mockReturnValue(false);
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <SignatureModal
        open={true}
        title="Signature — Matin"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );
    await act(async () => { vi.advanceTimersByTime(150); });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirmer/i }));
    });
    expect(onConfirm).toHaveBeenCalledWith("data:image/png;base64,abc123");
  });

  it("appelle clear sur clic Effacer", async () => {
    render(
      <SignatureModal
        open={true}
        title="Signature — Matin"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await act(async () => { vi.advanceTimersByTime(150); });
    fireEvent.click(screen.getByRole("button", { name: /effacer/i }));
    expect(mockPad.clear).toHaveBeenCalled();
  });

  it("n'affiche rien quand open=false", () => {
    render(
      <SignatureModal
        open={false}
        title="Signature — Matin"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByText("Signature — Matin")).not.toBeInTheDocument();
  });
});
