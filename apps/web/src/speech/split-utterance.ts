/**
 * Splits one final speech result into the pieces that should be judged separately (D-096).
 *
 * Chrome's Japanese recognition often returns several sentences as one final result and
 * marks pauses with a space ("結果 一応 AI で開発しなさい って書いてた"). We cut:
 *   - after sentence-ending punctuation (。！？!?)
 *   - at a space whose neighbours on both sides are Japanese characters (a pause)
 * Spaces next to Latin letters or digits ("出そうと AI と") are how Chrome writes English
 * words, not pauses, so they stay inside the piece.
 */
const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー〜]/u;

export function splitUtterance(text: string): string[] {
  const pieces: string[] = [];
  let current = "";
  const chars = [...text.trim()];
  const push = () => {
    const piece = current.trim();
    if (piece) pieces.push(piece);
    current = "";
  };
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    if (/\s/u.test(c)) {
      // Find the nearest non-space characters on each side.
      const before = current.trimEnd().slice(-1);
      let j = i + 1;
      while (j < chars.length && /\s/u.test(chars[j]!)) j++;
      const after = chars[j] ?? "";
      if (before && JAPANESE.test(before) && JAPANESE.test(after)) {
        push();
        i = j - 1;
        continue;
      }
      current += c;
      continue;
    }
    current += c;
    if (/[。！？!?]/u.test(c) && !/[。！？!?]/u.test(chars[i + 1] ?? ""))
      push();
  }
  push();
  return pieces;
}
