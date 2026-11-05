// The documents cut into passages, each with its embedding. The file is made by
// `npm run embed-docs` and loaded into memory once, when the app starts.
import data from "./data/passages.json";

export type Passage = {
  id: string;
  documentId: string;
  /** The document's title, which is also how `text` starts. */
  title: string;
  /** The PDF page the passage is on, counting the first page as 1. */
  page: number;
  text: string;
  /** Unit length, so a dot product with another embedding is their similarity. */
  embedding: number[];
};

export const EMBEDDING_MODEL_ID: string = data.model;
export const EMBEDDING_DIMENSIONS: number = data.dimensions;
export const PASSAGES: Passage[] = data.passages;
