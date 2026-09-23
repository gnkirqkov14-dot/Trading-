import part1 from './lessons-1.js';
import part2 from './lessons-2.js';

export const LESSONS = [...part1, ...part2].sort((a, b) => a.id - b.id);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

for (const l of LESSONS) {
  for (const w of l.words) {
    w.id = slug(w.en);
    w.lesson = l.id;
  }
}

export const WORDS = LESSONS.flatMap((l) => l.words);
export const WORD = Object.fromEntries(WORDS.map((w) => [w.id, w]));
export const LESSON = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
