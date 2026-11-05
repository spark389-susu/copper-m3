// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { embedMany } = vi.hoisted(() => ({ embedMany: vi.fn() }));
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  embedMany,
}));
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: () => ({
    embedding: (id: string) => ({ modelId: id }),
  }),
}));

import { AiNotConfiguredError, callEmbed } from "@/lib/ai/call";

const info = { module: 3, feature: "embed-docs" };
const options = { kind: "document", dimensions: 768 } as const;

let logged: Record<string, unknown>[];

beforeEach(() => {
  vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
  embedMany.mockReset();
  logged = [];
  vi.spyOn(console, "info").mockImplementation((tag, line) => {
    if (tag === "[ai_calls]") logged.push(JSON.parse(String(line)));
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("callEmbed", () => {
  it("returns one embedding per text, in order, and logs the call", async () => {
    embedMany.mockResolvedValue({
      embeddings: [[1, 0], [0, 1]],
      usage: { tokens: 12 },
    });
    const result = await callEmbed(info, ["a", "b"], options);
    expect(result.embeddings).toEqual([[1, 0], [0, 1]]);
    expect(result.tokens).toBe(12);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      module: 3,
      feature: "embed-docs",
      model: "google/gemini-embedding-001",
      input_tokens: 12,
      cost_usd: null,
      ok: true,
    });
  });

  it("asks Gemini for the embedding model, the size and the document task", async () => {
    embedMany.mockResolvedValue({ embeddings: [[1]], usage: { tokens: 1 } });
    await callEmbed(info, ["a"], options);
    const call = embedMany.mock.calls[0][0];
    expect(call.model).toEqual({ modelId: "gemini-embedding-001" });
    expect(call.values).toEqual(["a"]);
    expect(call.providerOptions.google).toEqual({
      outputDimensionality: 768,
      taskType: "RETRIEVAL_DOCUMENT",
    });
  });

  it("uses the query task for a question", async () => {
    embedMany.mockResolvedValue({ embeddings: [[1]], usage: { tokens: 1 } });
    await callEmbed(info, ["q"], { kind: "query", dimensions: 768 });
    expect(embedMany.mock.calls[0][0].providerOptions.google.taskType).toBe(
      "RETRIEVAL_QUERY",
    );
  });

  it("logs the tokens as unknown when Google doesn't report them", async () => {
    embedMany.mockResolvedValue({
      embeddings: [[1]],
      usage: { tokens: Number.NaN },
    });
    const result = await callEmbed(info, ["a"], options);
    expect(result.tokens).toBeNull();
    expect(logged[0].input_tokens).toBeNull();
  });

  it("logs a failed call and passes the error on", async () => {
    embedMany.mockRejectedValue(new Error("quota"));
    await expect(callEmbed(info, ["a"], options)).rejects.toThrow("quota");
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ ok: false, input_tokens: null });
  });

  it("says AI isn't set up when there is no key, without calling Gemini", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    await expect(callEmbed(info, ["a"], options)).rejects.toBeInstanceOf(
      AiNotConfiguredError,
    );
    expect(embedMany).not.toHaveBeenCalled();
  });
});
