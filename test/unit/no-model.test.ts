import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";

/**
 * The decision path must not consult a language model. This is a proxy, not a
 * proof: nothing stops raw HTTP. What it does catch is a provider SDK being
 * added later, which is how this invariant would realistically be lost.
 */
const MODEL_PROVIDER_MARKERS = [
  "openai",
  "@anthropic-ai",
  "anthropic",
  "@google/generative-ai",
  "@google/genai",
  "google-generativeai",
  "cohere",
  "mistralai",
  "@mistralai",
  "replicate",
  "ollama",
  "langchain",
  "llamaindex",
  "@huggingface",
];

// dist/test/unit -> dist/test -> dist -> repository root
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");

test("no language model provider SDK is declared as a dependency", () => {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const declared = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ];

  const found = declared.filter((name) =>
    MODEL_PROVIDER_MARKERS.some(
      (marker) => name === marker || name.startsWith(`${marker}/`) || name.includes(marker),
    ),
  );

  assert.deepEqual(found, [], `model provider SDK declared: ${found.join(", ")}`);
});

test("the marker list is not empty, so the check cannot pass vacuously", () => {
  assert.ok(MODEL_PROVIDER_MARKERS.length > 0);
});
