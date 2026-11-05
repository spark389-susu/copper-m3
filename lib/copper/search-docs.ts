// Finds the passages of Copper's documents that are closest in meaning to a
// question. The question is embedded (turned into a list of numbers) the same
// way the passages were, then every passage is scored by how close its numbers
// are. The passages are already in memory, so only the question costs a call.
import { callEmbed } from "@/lib/ai/call";
import { DOCUMENTS } from "@/lib/copper/documents";
import {
  EMBEDDING_DIMENSIONS,
  PASSAGES,
  type Passage,
} from "@/lib/copper/passages";

/** How many passages come back. */
export const RESULT_COUNT = 5;

export type DocResult = {
  title: string;
  /** The PDF page, counting the first page as 1. */
  page: number;
  /** The passage, without the title line it was embedded with. */
  text: string;
  /** Opens the PDF at `page`. */
  url: string;
  /** How close the passage is to the question: 1 is identical, 0 unrelated. */
  score: number;
};

export type DocSearch =
  | { status: "ok"; query: string; results: DocResult[] }
  | { status: "unavailable"; message: string };

/** Both lengths are 1, so the dot product is the cosine: how alike their meaning is. */
const similarity = (a: number[], b: number[]) =>
  a.reduce((sum, x, i) => sum + x * b[i], 0);

function unit(vector: number[]): number[] {
  const length = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
  return vector.map((x) => x / length);
}

function resultFor(passage: Passage, score: number): DocResult {
  const doc = DOCUMENTS.find((d) => d.id === passage.documentId)!;
  return {
    title: passage.title,
    page: passage.page,
    text: passage.text.startsWith(`${passage.title}\n`)
      ? passage.text.slice(passage.title.length + 1)
      : passage.text,
    // Browsers open a PDF at this page with #page=.
    url: `${doc.file}#page=${passage.page}`,
    score: Math.round(score * 1000) / 1000,
  };
}

/** search_docs: the 5 passages closest in meaning to `query`, best first. */
export async function searchDocs(query: string): Promise<DocSearch> {
  let embedding: number[];
  try {
    const { embeddings } = await callEmbed(
      { module: 3, feature: "search-docs" },
      [query],
      { kind: "query", dimensions: EMBEDDING_DIMENSIONS },
    );
    embedding = unit(embeddings[0]);
  } catch {
    return {
      status: "unavailable",
      message: "The documents can't be searched right now. Please try again shortly.",
    };
  }

  const results = PASSAGES.map((passage) => ({
    passage,
    score: similarity(embedding, passage.embedding),
  }))
    .sort((a, b) => b.score - a.score)
    .slice(0, RESULT_COUNT)
    .map(({ passage, score }) => resultFor(passage, score));
  return { status: "ok", query, results };
}
