import { readFile } from "node:fs/promises";
import { IMMEDIATE_AIZUCHI } from "@gaya/shared";
import type { ExampleModel } from "reaction-evaluator";

const immediatePhrases = new Set<string>(IMMEDIATE_AIZUCHI);
type Dictionary = { whole: Set<string>; pieces: string[] };
interface Tokenizer {
  split: (text: string) => string[] | null;
  known: (text: string) => boolean;
}
let ready: Promise<Tokenizer> | undefined;
function tokenizer() {
  ready ??= load().catch((error: unknown) => {
    ready = undefined;
    throw error;
  });
  return ready;
}
export async function splitAizuchiReaction(text: string) {
  return (await tokenizer()).split(text);
}
export async function isKnownAizuchi(text: string) {
  return (await tokenizer()).known(text);
}
export function isImmediateAizuchi(text: string) {
  const canonical = text
    .normalize("NFKC")
    .trim()
    .replace(/[ァ-ヶ]/gu, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s!?。、.,~〜ー…・wW笑]+$/u, "");
  return immediatePhrases.has(canonical);
}
async function load(): Promise<Tokenizer> {
  const entry = import.meta.resolve("reaction-evaluator");
  const { buildAizuchiDict, splitAizuchiSet, canonicalAizuchi } = (await import(
    new URL("./aizuchi-set.js", entry).href
  )) as {
    buildAizuchiDict: (phrases: Iterable<string>) => Dictionary;
    splitAizuchiSet: (text: string, dictionary: Dictionary) => string[] | null;
    canonicalAizuchi: (text: string) => string;
  };
  const [model, library] = await Promise.all([
    readFile(new URL("../models/isAizuchi.json", entry), "utf8").then(
      (data) => JSON.parse(data) as ExampleModel,
    ),
    import(new URL("./config.js", entry).href) as Promise<{
      STOCK_PHRASES: string[];
    }>,
  ]);
  const dictionary = buildAizuchiDict([
    ...model.positives.map((example) => example.text),
    ...library.STOCK_PHRASES,
    "はい",
    ...IMMEDIATE_AIZUCHI,
  ]);
  const repeated = (text: string): string[] | null => {
    const value = canonicalAizuchi(text);
    // Prefer the smallest known word, even when the whole repetition is also a learned example.
    for (let length = 2; length <= value.length / 2; length++) {
      const word = value.slice(0, length);
      if (
        value.length % length === 0 &&
        dictionary.whole.has(word) &&
        word.repeat(value.length / length) === value
      )
        return Array<string>(value.length / length).fill(word);
    }
    return null;
  };
  return {
    known: (text) => dictionary.whole.has(canonicalAizuchi(text)),
    split: (text) => {
      const parts = repeated(text) ?? splitAizuchiSet(text, dictionary);
      return parts?.flatMap((part) => repeated(part) ?? [part]) ?? null;
    },
  };
}
