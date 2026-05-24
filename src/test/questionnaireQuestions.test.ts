import { describe, it, expect } from "vitest";
import { QUESTIONS, type QuestionDef } from "@/lib/questionnaireQuestions";

describe("QUESTIONS", () => {
  it("has at least 10 questions for positionnement", () => {
    expect(QUESTIONS.positionnement.length).toBeGreaterThanOrEqual(10);
  });

  it("has at least 10 questions for satisfaction_chaud", () => {
    expect(QUESTIONS.satisfaction_chaud.length).toBeGreaterThanOrEqual(10);
  });

  it("has at least 10 questions for satisfaction_froid", () => {
    expect(QUESTIONS.satisfaction_froid.length).toBeGreaterThanOrEqual(10);
  });

  it("every question has id, label, and type", () => {
    const all: QuestionDef[] = [
      ...QUESTIONS.positionnement,
      ...QUESTIONS.satisfaction_chaud,
      ...QUESTIONS.satisfaction_froid,
    ];
    for (const q of all) {
      expect(q.id).toBeTruthy();
      expect(q.label).toBeTruthy();
      expect(["scale", "boolean", "text", "select", "boolean_text"]).toContain(q.type);
    }
  });
});
