export const PRESENTATION_TOPICS = [
  "最近やらかした大失敗",
  "実は人生で一番恥ずかしかった瞬間",
  "メンターをやっていて一番笑った話",
  "今だから言える、ちょっとした秘密",
  "最近一番テンションが上がった出来事",
  "子どもの頃の黒歴史エピソード",
  "自分の「ここが変かも」と思うこだわり",
  "もし100万円が突然手に入ったら何に使う？",
  "人生で一番焦ったピンチと乗り越え方",
  "最近ハマっている沼・推しトーク",
  "キャンプやイベントでの忘れられない珍事件",
  "実はちょっと自慢したい特技や武勇伝",
  "最近買って大正解だったもの・失敗したもの",
  "朝起きてから今日ここに来るまでのハイライト",
  "小中学生の頃の自分に一言ツッコむなら",
  "今までで一番衝撃だった食べ物・グルメ",
] as const;

export type PresentationTopic = (typeof PRESENTATION_TOPICS)[number];

export function createTopicDeck(random: () => number = Math.random): string[] {
  const deck: string[] = [...PRESENTATION_TOPICS];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const clamped = Math.max(0, Math.min(i, j));
    const temp = deck[i]!;
    deck[i] = deck[clamped]!;
    deck[clamped] = temp;
  }
  return deck;
}

export function drawNextTopic(
  deck: readonly string[],
  currentTopic = "",
  random: () => number = Math.random,
): { topic: string; remainingDeck: string[] } {
  const pool = deck.length > 0 ? [...deck] : createTopicDeck(random);

  if (pool.length > 1 && pool[0] === currentTopic) {
    const swapIndex = 1 + Math.floor(random() * (pool.length - 1));
    const clamped = Math.max(1, Math.min(pool.length - 1, swapIndex));
    const first = pool[0]!;
    pool[0] = pool[clamped]!;
    pool[clamped] = first;
  } else if (pool.length === 1 && pool[0] === currentTopic) {
    const refilled = createTopicDeck(random).filter(
      (item) => item !== currentTopic,
    );
    if (refilled.length > 0) {
      const [topic, ...rest] = refilled;
      return {
        topic: topic!,
        remainingDeck: [...rest, currentTopic],
      };
    }
  }

  const [topic, ...remainingDeck] = pool;
  return {
    topic: topic ?? PRESENTATION_TOPICS[0],
    remainingDeck,
  };
}
