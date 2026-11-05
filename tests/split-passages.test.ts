import { describe, expect, it } from "vitest";
import { splitPage } from "@/lib/copper/split-passages";

const TITLE = "Copper Plus FAQ";

describe("splitPage", () => {
  it("starts every passage with the document title", () => {
    const passages = splitPage(
      TITLE,
      "One. Two. Three. Four. Five. Six. Seven. Eight. Nine. Ten.",
    );
    expect(passages.length).toBeGreaterThan(1);
    for (const passage of passages) {
      expect(passage.startsWith(`${TITLE}\n`)).toBe(true);
    }
  });

  it("keeps a few sentences in each passage", () => {
    const sentences = Array.from({ length: 10 }, (_, i) => `Sentence ${i}.`);
    const passages = splitPage(TITLE, sentences.join(" "));
    // 4 + 4 + 2, but a short last piece is joined to the one before it.
    expect(passages).toHaveLength(2);
    expect(passages[0]).toBe(`${TITLE}\n${sentences.slice(0, 4).join(" ")}`);
    expect(passages[1]).toBe(`${TITLE}\n${sentences.slice(4).join(" ")}`);
  });

  it("starts a new passage before one gets too long", () => {
    // Capitalized, because a sentence doesn't end before a lowercase word.
    const long = `Word ${"word ".repeat(69).trim()}.`;
    const passages = splitPage(TITLE, `${long} ${long} ${long}`);
    expect(passages).toHaveLength(3);
    for (const passage of passages) {
      expect(passage.length).toBeLessThan(TITLE.length + 1 + 400);
    }
  });

  it("never cuts inside a sentence, even a very long one", () => {
    const huge = `Word ${"word ".repeat(299).trim()}.`;
    const passages = splitPage(TITLE, huge);
    expect(passages).toEqual([`${TITLE}\n${huge}`]);
  });

  it("joins a very short last passage to the one before it", () => {
    const body = "A sentence that is long enough to count on its own here.";
    const text = [body, body, body, body, "Short."].join(" ");
    const passages = splitPage(TITLE, text);
    expect(passages).toHaveLength(1);
    expect(passages[0].endsWith("Short.")).toBe(true);
  });

  it("turns the line breaks PDFs leave in sentences into spaces", () => {
    const [passage] = splitPage(TITLE, "Copper Home\nlistens   only\nlocally.");
    expect(passage).toBe(`${TITLE}\nCopper Home listens only locally.`);
  });

  it("returns nothing for a page with no text", () => {
    expect(splitPage(TITLE, "")).toEqual([]);
    expect(splitPage(TITLE, " \n \t ")).toEqual([]);
  });
});
