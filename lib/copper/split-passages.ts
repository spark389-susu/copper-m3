// Cuts one page of a document into passages: a few sentences each, so a search
// can point at a small piece of the page instead of the whole page.
// Each passage starts with the document's title, so the embedding also knows
// which document the sentences came from.
const MAX_SENTENCES = 4;
const MAX_CHARS = 700;
// A last passage shorter than this is joined to the one before it.
const MIN_LAST_CHARS = 80;

const sentenceSplitter = new Intl.Segmenter("en", { granularity: "sentence" });

/** The passages of one page, each starting with `title`. Empty if the page has no text. */
export function splitPage(title: string, pageText: string): string[] {
  // PDF text comes with line breaks in the middle of sentences.
  const text = pageText.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const sentences = [...sentenceSplitter.segment(text)]
    .map((part) => part.segment.trim())
    .filter(Boolean);

  const groups: string[][] = [];
  let current: string[] = [];
  let length = 0;
  for (const sentence of sentences) {
    const full =
      current.length >= MAX_SENTENCES ||
      (current.length > 0 && length + sentence.length > MAX_CHARS);
    if (full) {
      groups.push(current);
      current = [];
      length = 0;
    }
    current.push(sentence);
    length += sentence.length + 1;
  }
  if (current.length > 0) groups.push(current);

  const last = groups.at(-1);
  if (groups.length > 1 && last && last.join(" ").length < MIN_LAST_CHARS) {
    groups.pop();
    groups[groups.length - 1].push(...last);
  }

  return groups.map((group) => `${title}\n${group.join(" ")}`);
}
