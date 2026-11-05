import { describe, expect, it } from "vitest";
import { DOCUMENTS } from "@/lib/copper/documents";
import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL_ID,
  PASSAGES,
} from "@/lib/copper/passages";

// These check the file `npm run embed-docs` saved, so they fail if it is
// stale or broken.
describe("the saved passages", () => {
  it("comes from the embedding model", () => {
    expect(EMBEDDING_MODEL_ID).toBe("google/gemini-embedding-001");
    expect(EMBEDDING_DIMENSIONS).toBeGreaterThan(0);
  });

  it("has passages for every document", () => {
    for (const doc of DOCUMENTS) {
      expect(
        PASSAGES.filter((p) => p.documentId === doc.id).length,
        `${doc.title} has passages`,
      ).toBeGreaterThan(0);
    }
  });

  it("keeps each passage's document title and page number", () => {
    for (const p of PASSAGES) {
      const doc = DOCUMENTS.find((d) => d.id === p.documentId);
      expect(doc, `${p.id} names a known document`).toBeDefined();
      expect(p.title).toBe(doc!.title);
      expect(Number.isInteger(p.page) && p.page >= 1).toBe(true);
    }
  });

  it("starts each passage's text with its document title", () => {
    for (const p of PASSAGES) {
      expect(p.text.startsWith(p.title), p.id).toBe(true);
    }
  });

  it("gives every passage its own id", () => {
    expect(new Set(PASSAGES.map((p) => p.id)).size).toBe(PASSAGES.length);
  });

  it("gives every passage an embedding of the right size and length 1", () => {
    for (const p of PASSAGES) {
      expect(p.embedding, p.id).toHaveLength(EMBEDDING_DIMENSIONS);
      const length = Math.sqrt(p.embedding.reduce((sum, x) => sum + x * x, 0));
      expect(length, p.id).toBeCloseTo(1, 3);
    }
  });
});
