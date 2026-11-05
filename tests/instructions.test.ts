import { describe, expect, it } from "vitest";
import { COPPER_INSTRUCTIONS } from "@/lib/copper/assistant/instructions";
import { DOCUMENTS } from "@/lib/copper/documents";

// These check what the instructions tell Copper to do. They can't prove the
// model obeys; the live check of the real model does that.
describe("COPPER_INSTRUCTIONS", () => {
  it("send setup, troubleshooting, warranty and policy questions to search_docs", () => {
    expect(COPPER_INSTRUCTIONS).toContain("search_docs");
    for (const topic of ["setup", "troubleshooting", "warranty", "policy"]) {
      expect(COPPER_INSTRUCTIONS, topic).toContain(topic);
    }
  });

  it("allow answers only from what search_docs returns, and never guessing", () => {
    expect(COPPER_INSTRUCTIONS).toMatch(/only from the passages/i);
    expect(COPPER_INSTRUCTIONS).toMatch(/never guess/i);
  });

  it("make every sentence cite its source, in the form [Title, p. 9]", () => {
    expect(COPPER_INSTRUCTIONS).toMatch(/every sentence/i);
    expect(COPPER_INSTRUCTIONS).toContain("[Copper Home User Guide, p. 9]");
  });

  it("use a real document title in its citation example", () => {
    expect(DOCUMENTS.map((d) => d.title)).toContain("Copper Home User Guide");
  });

  it("say exactly what to reply when the passages don't answer", () => {
    expect(COPPER_INSTRUCTIONS).toContain(
      "I couldn't find that in our support docs",
    );
    expect(COPPER_INSTRUCTIONS).toContain("Copper Crew");
  });

  it("no longer tell Copper to refuse setup, warranty or troubleshooting", () => {
    expect(COPPER_INSTRUCTIONS).not.toMatch(/can't help with that yet/i);
  });
});
