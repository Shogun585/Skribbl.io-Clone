import { SupportedLanguage, WordCategory, WordMode } from '../types/shared.js';

export const CATEGORIZED_WORDS: Record<Exclude<WordCategory, 'all'>, string[]> = {
  animals: [
    'chameleon', 'platypus', 'octopus', 'flamingo', 'hedgehog', 'jellyfish',
    'kangaroo', 'penguin', 'narwhal', 'axolotl', 'crocodile', 'peacock',
    'seahorse', 'armadillo', 'wolverine', 'dolphin'
  ],
  food: [
    'croissant', 'guacamole', 'pineapple', 'spaghetti', 'watermelon', 'pancakes',
    'burrito', 'pretzel', 'avocado', 'dumpling', 'sushi', 'tiramisu',
    'waffle', 'popcorn', 'lasagna', 'ramen', 'pizza'
  ],
  objects: [
    'telescope', 'hourglass', 'chandelier', 'compass', 'parachute', 'typewriter',
    'flashlight', 'microscope', 'gramophone', 'boomerang', 'periscope', 'umbrella',
    'backpack', 'skateboard', 'headphones', 'lantern'
  ],
  space: [
    'supernova', 'constellation', 'asteroid', 'nebula', 'spacecraft', 'astronaut',
    'satellite', 'blackhole', 'exoplanet', 'meteorite', 'cosmonaut', 'wormhole',
    'observatory', 'moonwalk', 'galaxy', 'eclipse'
  ],
  actions: [
    'juggling', 'skydiving', 'sleepwalking', 'tightrope', 'meditating', 'snowboarding',
    'fencing', 'archery', 'weightlifting', 'surfing', 'gardening', 'whispering'
  ],
  tech: [
    'keyboard', 'firewall', 'blockchain', 'algorithm', 'motherboard', 'database',
    'joystick', 'hologram', 'smartwatch', 'drone', 'encryption', 'terminal'
  ]
};

export const LANGUAGE_PACKS: Record<SupportedLanguage, string[]> = {
  English: [],
  Spanish: ['mariposa', 'guitarra', 'helado', 'astronauta', 'castillo', 'volcan', 'telescopio', 'piramide'],
  French: ['croissant', 'papillon', 'etoile', 'boussole', 'chateau', 'fusée', 'parapluie', 'montagne'],
  German: ['schmetterling', 'fernrohr', 'leuchtturm', 'sanduhr', 'rakete', 'kompass', 'regenschirm', 'vulkan'],
  Hindi: ['samosa', 'rickshaw', 'charminar', 'peacock', 'tabla', 'mango', 'lantern', 'monsoon']
};

/**
 * Dynamically masks the secret word based on revealed hint indices and WordMode.
 */
export function maskWord(
  word: string,
  revealedIndices: Set<number>,
  wordMode: WordMode = 'normal'
): string {
  if (!word) return '';
  if (wordMode === 'hidden') {
    return '? ? ?';
  }
  return word
    .split('')
    .map((ch, idx) => {
      if (ch === ' ' || ch === '-') return ch;
      return revealedIndices.has(idx) ? ch.toUpperCase() : '_';
    })
    .join(' ');
}

/**
 * Selects `count` random candidate words respecting custom words, language, category, and combination mode.
 */
export function getRandomWords(
  count: number,
  customWords: string[] = [],
  useCustomWordsOnly: boolean = false,
  category: WordCategory = 'all',
  wordMode: WordMode = 'normal',
  language: SupportedLanguage = 'English',
  usedWords: Set<string> = new Set()
): string[] {
  const cleanCustom = customWords
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 2 && w.length <= 32);

  let pool: string[] = [];
  if (useCustomWordsOnly && cleanCustom.length >= count) {
    pool = [...cleanCustom];
  } else if (language !== 'English' && LANGUAGE_PACKS[language]?.length >= count) {
    pool = [...new Set([...cleanCustom, ...LANGUAGE_PACKS[language]])];
  } else {
    const base =
      category === 'all'
        ? Object.values(CATEGORIZED_WORDS).flat()
        : CATEGORIZED_WORDS[category] || CATEGORIZED_WORDS.objects;
    pool = [...new Set([...cleanCustom, ...base])];
  }

  const unused = pool.filter((w) => !usedWords.has(w));
  const source = unused.length >= count ? unused : pool;
  const shuffled = [...source].sort(() => Math.random() - 0.5);

  const safeCount = Math.max(1, Math.min(5, count));
  if (wordMode === 'combination' && shuffled.length >= safeCount * 2) {
    const combos: string[] = [];
    for (let i = 0; i < safeCount; i++) {
      combos.push(`${shuffled[i * 2]} ${shuffled[i * 2 + 1]}`);
    }
    return combos;
  }

  return shuffled.slice(0, safeCount);
}

/**
 * Picks a random unrevealed character index for timed hints (capped at 60% of word length).
 */
export function pickNextHintIndex(word: string, revealedIndices: Set<number>): number | null {
  const unrevealed: number[] = [];
  let letterCount = 0;
  for (let i = 0; i < word.length; i++) {
    if (word[i] !== ' ' && word[i] !== '-') {
      letterCount++;
      if (!revealedIndices.has(i)) unrevealed.push(i);
    }
  }
  if (unrevealed.length === 0 || revealedIndices.size >= Math.floor(letterCount * 0.6)) {
    return null;
  }
  return unrevealed[Math.floor(Math.random() * unrevealed.length)];
}

/**
 * Matrix Levenshtein edit-distance calculation for fuzzy proximity matching.
 */
export function levenshteinDistance(a: string, b: string): number {
  const s = a.trim().toLowerCase();
  const t = b.trim().toLowerCase();
  const m = s.length;
  const n = t.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function evaluateGuess(
  rawGuess: string,
  targetWord: string
): 'exact' | 'close_guess' | 'wrong' {
  const g = rawGuess.trim().toLowerCase().replace(/\s+/g, ' ');
  const t = targetWord.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!g || !t) return 'wrong';
  if (g === t) return 'exact';
  if (t.length >= 4 && Math.abs(g.length - t.length) <= 1 && levenshteinDistance(g, t) <= 1) {
    return 'close_guess';
  }
  return 'wrong';
}
