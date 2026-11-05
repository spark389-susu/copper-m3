// npm run embed-docs: reads every PDF in public/docs, cuts each page into
// passages, embeds each passage with Gemini, and saves them all to
// lib/copper/data/passages.json, which the app loads into memory at start-up.
// Run it again whenever a PDF changes.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { extractText, getDocumentProxy } from "unpdf";
import { AiNotConfiguredError, callEmbed } from "@/lib/ai/call";
import { EMBEDDING_MODEL } from "@/lib/ai/models";
import { DOCUMENTS } from "@/lib/copper/documents";
import { splitPage } from "@/lib/copper/split-passages";

// Same variables as `next dev`, so GOOGLE_GENERATIVE_AI_API_KEY is found.
loadEnvConfig(process.cwd());

// 768 numbers per passage keeps the file small and is still plenty to tell
// passages apart.
const DIMENSIONS = 768;
const OUTPUT = join(process.cwd(), "lib/copper/data/passages.json");

type Draft = {
  id: string;
  documentId: string;
  title: string;
  page: number;
  text: string;
};

/** Scales a vector to length 1, which Gemini needs for fewer than 3072 numbers. */
function unit(vector: number[]): number[] {
  const length = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
  return vector.map((x) => Math.round((x / length) * 1e5) / 1e5);
}

async function main() {
  const drafts: Draft[] = [];
  const counts: { title: string; pages: number; passages: number }[] = [];
  const emptyPages: string[] = [];

  for (const doc of DOCUMENTS) {
    const bytes = await readFile(join(process.cwd(), "public", doc.file));
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text: pages } = await extractText(pdf, { mergePages: false });

    let passages = 0;
    pages.forEach((pageText, index) => {
      const page = index + 1;
      const pieces = splitPage(doc.title, pageText);
      if (pieces.length === 0) emptyPages.push(`${doc.title} p.${page}`);
      pieces.forEach((text, n) => {
        drafts.push({
          id: `${doc.id}-p${page}-${n + 1}`,
          documentId: doc.id,
          title: doc.title,
          page,
          text,
        });
      });
      passages += pieces.length;
    });
    counts.push({ title: doc.title, pages: pages.length, passages });
  }

  const { embeddings } = await callEmbed(
    { module: 3, feature: "embed-docs" },
    drafts.map((draft) => draft.text),
    { kind: "document", dimensions: DIMENSIONS },
  );
  if (embeddings.length !== drafts.length) {
    throw new Error(
      `Asked for ${drafts.length} embeddings and got ${embeddings.length}.`,
    );
  }

  const passages = drafts.map((draft, i) => ({
    ...draft,
    embedding: unit(embeddings[i]),
  }));

  // One passage per line, so the file is still readable in a diff.
  const header = `"model": ${JSON.stringify(EMBEDDING_MODEL.id)},\n  "dimensions": ${DIMENSIONS},\n  "createdAt": ${JSON.stringify(new Date().toISOString())}`;
  const lines = passages.map((p) => `    ${JSON.stringify(p)}`).join(",\n");
  const json = `{\n  ${header},\n  "passages": [\n${lines}\n  ]\n}\n`;
  await writeFile(OUTPUT, json);

  console.log("\nPassages per document:");
  for (const c of counts) {
    console.log(`  ${c.title}: ${c.passages} (from ${c.pages} pages)`);
  }
  console.log(`  Total: ${passages.length} passages`);
  if (emptyPages.length > 0) {
    console.log(`\nPages with no text (skipped): ${emptyPages.join(", ")}`);
  }
  console.log(
    `\nSaved to lib/copper/data/passages.json (${(json.length / 1e6).toFixed(2)} MB)`,
  );
}

main().catch((error) => {
  if (error instanceof AiNotConfiguredError) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
