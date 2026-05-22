export type LessonMeta = {
  id: string;
  title: string;
  emoji: string;
};

// Single source of truth for what counts as a "lesson" for progress
// tracking. Adding a new lesson here automatically expands the progress
// total on /learn — also wire it into the page so the card shows up.
export const LESSONS: LessonMeta[] = [
  { id: "stock-basics", title: "What's a stock?", emoji: "🍕" },
  { id: "wiggles", title: "Why do prices wiggle?", emoji: "🏷️" },
  { id: "diversification", title: "Don't put all your eggs in one basket", emoji: "🧺" },
  { id: "risk-reward", title: "Risk & reward", emoji: "🛡️" },
  { id: "compound", title: "Compound interest", emoji: "✨" },
  { id: "quiz", title: "Quick quiz", emoji: "🧠" },
];

export const LESSON_COUNT = LESSONS.length;
