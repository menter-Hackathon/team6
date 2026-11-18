import {
  WhisperTextStreamer,
  type WhisperTokenizer,
} from "@huggingface/transformers";
/** Decode every token so Japanese without spaces can appear before end(). */
export function speechTextStreamer(
  tokenizer: WhisperTokenizer,
  onText: (text: string) => void,
) {
  const tokens: bigint[] = [];
  let previous = "";
  return new WhisperTextStreamer(tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: () => {},
    token_callback_function: (next) => {
      tokens.push(...next);
      const text = tokenizer
        .decode(tokens, { skip_special_tokens: true })
        .replace(/\uFFFD/g, "")
        .trim();
      if (text && text !== previous) {
        previous = text;
        onText(text);
      }
    },
  });
}
