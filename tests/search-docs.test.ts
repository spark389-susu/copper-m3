// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { callEmbed } = vi.hoisted(() => ({ callEmbed: vi.fn() }));
vi.mock("@/lib/ai/call", () => ({ callEmbed }));

import { copperTools, searchDocsInput } from "@/lib/copper/assistant/tools";
import { DOCUMENTS } from "@/lib/copper/documents";
import { EMBEDDING_DIMENSIONS, PASSAGES } from "@/lib/copper/passages";
import { RESULT_COUNT, searchDocs } from "@/lib/copper/search-docs";

/** Makes the fake embedding service answer with these numbers for the question. */
const questionEmbeds = (embedding: number[]) =>
  callEmbed.mockResolvedValue({ embeddings: [embedding], tokens: null });

beforeEach(() => {
  callEmbed.mockReset();
});

describe("searchDocs", () => {
  it("returns the 5 closest passages, closest first", async () => {
    questionEmbeds(PASSAGES[10].embedding);
    const search = await searchDocs("anything");
    expect(search.status).toBe("ok");
    if (search.status !== "ok") return;
    expect(RESULT_COUNT).toBe(5);
    expect(search.results).toHaveLength(5);
    const scores = search.results.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    // A question with exactly a passage's meaning finds that passage first.
    expect(search.results[0]).toMatchObject({
      title: PASSAGES[10].title,
      page: PASSAGES[10].page,
      score: 1,
    });
  });

  it("finds each document by the meaning of its own first passage", async () => {
    for (const doc of DOCUMENTS) {
      const passage = PASSAGES.find((p) => p.documentId === doc.id)!;
      questionEmbeds(passage.embedding);
      const search = await searchDocs("anything");
      if (search.status !== "ok") throw new Error("search failed");
      expect(search.results[0].title, doc.title).toBe(doc.title);
      expect(search.results[0].page).toBe(passage.page);
    }
  });

  it("doesn't need the question's numbers to have length 1", async () => {
    questionEmbeds(PASSAGES[3].embedding.map((x) => x * 7));
    const search = await searchDocs("anything");
    if (search.status !== "ok") throw new Error("search failed");
    expect(search.results[0]).toMatchObject({
      title: PASSAGES[3].title,
      page: PASSAGES[3].page,
      score: 1,
    });
  });

  it("gives each result its title, page, text and a link that opens the PDF at that page", async () => {
    questionEmbeds(PASSAGES[0].embedding);
    const search = await searchDocs("anything");
    if (search.status !== "ok") throw new Error("search failed");
    for (const result of search.results) {
      const doc = DOCUMENTS.find((d) => d.title === result.title)!;
      expect(doc, `${result.title} is one of the documents`).toBeDefined();
      expect(Number.isInteger(result.page) && result.page >= 1).toBe(true);
      expect(result.url).toBe(`${doc.file}#page=${result.page}`);
      expect(result.url).toMatch(/^\/docs\/[a-z-]+\.pdf#page=\d+$/);
      // The title line added for the embedding is dropped. (A page's own header
      // can still repeat the title on the same line, so check for the line.)
      expect(result.text.startsWith(`${result.title}\n`)).toBe(false);
      expect(result.text.length).toBeGreaterThan(0);
    }
  });

  it("repeats the question back with the results", async () => {
    questionEmbeds(PASSAGES[0].embedding);
    const search = await searchDocs("reset Wi-Fi");
    expect(search).toMatchObject({ status: "ok", query: "reset Wi-Fi" });
  });

  it("embeds the question as a query, the same size as the passages", async () => {
    questionEmbeds(PASSAGES[0].embedding);
    await searchDocs("annual refund");
    expect(callEmbed).toHaveBeenCalledWith(
      { module: 3, feature: "search-docs" },
      ["annual refund"],
      { kind: "query", dimensions: EMBEDDING_DIMENSIONS },
    );
  });

  it("says the documents can't be searched when the embedding fails", async () => {
    callEmbed.mockRejectedValue(new Error("quota"));
    const search = await searchDocs("C-47");
    expect(search.status).toBe("unavailable");
    if (search.status === "unavailable") {
      expect(search.message).toMatch(/can't be searched/);
    }
  });
});

describe("the search_docs tool", () => {
  it("is one of Copper's tools, with a description that names what it is for", () => {
    expect(Object.keys(copperTools)).toContain("search_docs");
    const { description } = copperTools.search_docs;
    expect(description).toMatch(/troubleshooting/);
    expect(description).toMatch(/warranty/);
    expect(description).toMatch(/policy/);
    expect(description).toMatch(/page/);
  });

  it("searches with the question it is given", async () => {
    questionEmbeds(PASSAGES[0].embedding);
    const result = await copperTools.search_docs.execute?.(
      { query: "reset Wi-Fi" },
      { toolCallId: "t1", messages: [] } as never,
    );
    expect(result).toMatchObject({ status: "ok", query: "reset Wi-Fi" });
    expect(callEmbed.mock.calls[0][1]).toEqual(["reset Wi-Fi"]);
  });

  it("takes a question and nothing else", () => {
    expect(searchDocsInput.safeParse({ query: "C-47" }).success).toBe(true);
    expect(searchDocsInput.safeParse({ query: "" }).success).toBe(false);
    expect(searchDocsInput.safeParse({ query: "   " }).success).toBe(false);
    expect(searchDocsInput.safeParse({}).success).toBe(false);
    expect(searchDocsInput.safeParse({ query: "x".repeat(301) }).success).toBe(
      false,
    );
    expect(searchDocsInput.safeParse({ query: "C-47", extra: 1 }).success).toBe(
      false,
    );
  });
});
