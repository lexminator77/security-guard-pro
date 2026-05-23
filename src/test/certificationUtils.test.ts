import { describe, it, expect } from "vitest";
import {
  CERT_LABELS,
  CERT_DURATIONS_MONTHS,
  RECYCLAGE_TYPE,
  certStatusBadge,
  daysUntilExpiry,
  calcDateExpiration,
} from "../lib/certificationUtils";

describe("CERT_LABELS", () => {
  it("has label for sst", () => { expect(CERT_LABELS.sst).toBe("SST"); });
  it("has label for tfp_aps", () => { expect(CERT_LABELS.tfp_aps).toBe("TFP APS"); });
  it("has label for epi", () => { expect(CERT_LABELS.epi).toBe("EPI / Extincteurs"); });
});

describe("CERT_DURATIONS_MONTHS", () => {
  it("sst is 24 months", () => { expect(CERT_DURATIONS_MONTHS.sst).toBe(24); });
  it("epi is 12 months", () => { expect(CERT_DURATIONS_MONTHS.epi).toBe(12); });
  it("tfp_aps is 60 months", () => { expect(CERT_DURATIONS_MONTHS.tfp_aps).toBe(60); });
});

describe("RECYCLAGE_TYPE", () => {
  it("sst recyclage is mac_sst", () => { expect(RECYCLAGE_TYPE.sst).toBe("mac_sst"); });
  it("tfp_aps recyclage is mac_aps", () => { expect(RECYCLAGE_TYPE.tfp_aps).toBe("mac_aps"); });
});

describe("daysUntilExpiry", () => {
  it("returns positive days for future date", () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    expect(daysUntilExpiry(future.toISOString().slice(0, 10))).toBeCloseTo(30, 0);
  });
  it("returns negative days for past date", () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    expect(daysUntilExpiry(past.toISOString().slice(0, 10))).toBeLessThan(0);
  });
  it("returns null for null input", () => {
    expect(daysUntilExpiry(null)).toBeNull();
  });
});

describe("certStatusBadge", () => {
  it("returns expire for past date", () => {
    const past = new Date(); past.setDate(past.getDate() - 1);
    expect(certStatusBadge(past.toISOString().slice(0, 10)).status).toBe("expire");
  });
  it("returns urgent for <30 days", () => {
    const soon = new Date(); soon.setDate(soon.getDate() + 15);
    expect(certStatusBadge(soon.toISOString().slice(0, 10)).status).toBe("urgent");
  });
  it("returns renouveler for 30-90 days", () => {
    const mid = new Date(); mid.setDate(mid.getDate() + 60);
    expect(certStatusBadge(mid.toISOString().slice(0, 10)).status).toBe("renouveler");
  });
  it("returns valide for >90 days", () => {
    const far = new Date(); far.setDate(far.getDate() + 100);
    expect(certStatusBadge(far.toISOString().slice(0, 10)).status).toBe("valide");
  });
});

describe("calcDateExpiration", () => {
  it("adds 24 months for sst", () => {
    expect(calcDateExpiration("2026-01-15", "sst")).toBe("2028-01-15");
  });
  it("adds 12 months for epi", () => {
    expect(calcDateExpiration("2026-03-01", "epi")).toBe("2027-03-01");
  });
  it("adds 60 months for tfp_aps", () => {
    expect(calcDateExpiration("2026-05-01", "tfp_aps")).toBe("2031-05-01");
  });
});
