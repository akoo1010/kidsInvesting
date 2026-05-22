import Link from "next/link";
import { CompoundCalculator } from "@/components/lessons/CompoundCalculator";
import { DiversificationQuiz } from "@/components/lessons/DiversificationQuiz";
import { LessonCard } from "@/components/lessons/LessonCard";
import { LessonProgress } from "@/components/lessons/LessonProgress";

export const metadata = {
  title: "Learn — Wall Street Cubs",
  description:
    "Investing for kids: bite-size lessons, an interactive compound interest calculator, and a quick quiz.",
};

const GLOSSARY: { term: string; def: string }[] = [
  { term: "Share", def: "One tiny piece of a company." },
  { term: "Portfolio", def: "All of the stocks (and cash) you own." },
  {
    term: "Dividend",
    def: "Some companies hand out small cash payments to shareholders every few months. Free money for owning a share!",
  },
  { term: "Bull market 🐂", def: "When prices are going up overall." },
  { term: "Bear market 🐻", def: "When prices are going down overall." },
  {
    term: "Volatility",
    def: "How wiggly the price is. Roller-coaster stocks have high volatility.",
  },
  {
    term: "Market cap",
    def: "How much the whole company is worth. Price per share × number of shares.",
  },
  {
    term: "P/E ratio",
    def: "Price ÷ Earnings. How many dollars investors pay for each $1 the company makes in a year.",
  },
];

export default function LearnPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="card p-6 sm:p-8 flex flex-col gap-3">
        <span className="chip w-fit">📘 Investing 101</span>
        <h1 className="text-3xl font-extrabold">
          Smart money ideas (in kid-language).
        </h1>
        <p className="text-slate-700 max-w-2xl">
          Read a card, play with the slider, take the mini quiz. Then jump into
          your{" "}
          <Link href="/portfolio" className="text-indigo-700 font-semibold hover:underline">
            portfolio
          </Link>{" "}
          and try it for real (with pretend money!).
        </p>
      </section>

      <LessonProgress />

      <section className="grid sm:grid-cols-2 gap-4">
        <LessonCard
          id="stock-basics"
          emoji="🍕"
          title="What's a stock?"
          body={
            <>
              Imagine Disney is a giant pizza 🍕 cut into millions of tiny
              slices. When you buy <strong>1 share of DIS</strong>, you own{" "}
              <strong>one slice</strong> of Disney. If Disney makes a great new
              movie and the whole pizza becomes more popular, your slice is
              worth more too. If people stop going to Disneyland, the slice is
              worth less.
            </>
          }
          callout="Owning a slice means you ride along with the company — good days and bad."
        />

        <LessonCard
          id="wiggles"
          emoji="🏷️"
          title="Why do prices wiggle?"
          body={
            <>
              Every second, lots of people are deciding to buy or sell. Good
              news (📱 new iPhone, 🚀 more customers) makes more people want to
              buy → price goes up. Bad news (😬 a recall, 📉 lower profits)
              flips it the other way. Short-term wiggles are normal.
            </>
          }
          callout="The daily wiggle is noise. The long-term trend is what matters."
        />

        <LessonCard
          id="diversification"
          emoji="🧺"
          title="Don't put all your eggs in one basket"
          body={
            <>
              If you spread your money across <strong>different kinds of
              companies</strong> — a phone maker, a food company, a bank, a toy
              company — then one bad day for one of them won&apos;t hurt much.
              That&apos;s called <strong>diversification</strong>. Big word,
              simple idea.
            </>
          }
          callout="More baskets = fewer broken eggs."
        />

        <LessonCard
          id="risk-reward"
          emoji="🛡️"
          title="Risk &amp; reward"
          body={
            <>
              Bigger possible reward almost always comes with bigger possible
              risk. A small, brand-new company might double — or it might
              disappear. A giant established one usually grows more slowly but
              steadier. Smart investors mix both kinds.
            </>
          }
          callout="Never invest money you'll need for something soon."
        />
      </section>

      <CompoundCalculator />

      <DiversificationQuiz />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">📖 Quick glossary</h2>
        <div className="card divide-y divide-slate-100">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="px-4 py-3 flex gap-4">
              <div className="font-semibold w-32 shrink-0">{g.term}</div>
              <div className="text-slate-700 text-sm">{g.def}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5 bg-amber-50 border-amber-200 text-sm text-amber-900">
        <strong>Reminder:</strong> Wall Street Cubs only uses pretend money.
        Real investing has real risks. When you&apos;re older, talk with a
        grown-up before ever using real money.
      </section>
    </div>
  );
}
