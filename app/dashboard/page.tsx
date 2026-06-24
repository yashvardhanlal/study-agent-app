import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import type { Metadata } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const masteryScores: Record<string, number> = {
  Strong: 4,
  Proficient: 3,
  Developing: 2,
  Introduced: 1,
  "In Progress": 0,
};

const subjectPillClasses: Record<string, string> = {
  Physics: "bg-blue-500/10 text-blue-300 border border-blue-500/20",
  Biology: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
  Mathematics: "bg-violet-500/10 text-violet-300 border border-violet-500/20",
  "Computer Science": "bg-orange-500/10 text-orange-300 border border-orange-500/20",
  Chemistry: "bg-red-500/10 text-red-300 border border-red-500/20",
};

const masteryBadgeClasses: Record<string, string> = {
  Strong: "bg-emerald-500/10 text-emerald-200",
  Proficient: "bg-sky-500/10 text-sky-200",
  Developing: "bg-yellow-500/10 text-amber-200",
  Introduced: "bg-violet-500/10 text-violet-200",
  "In Progress": "bg-slate-700/90 text-slate-100",
};

function formatDate(dateValue: string | null | undefined) {
  if (!dateValue) return "Unknown";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string") {
    return value.trim().length ? [value.trim()] : [];
  }

  return [];
}

async function getConcepts() {
  const { data, error } = await supabase.from("concepts").select("*");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export const metadata: Metadata = {
  title: "Dashboard | Study Agent",
  description: "Track your learned concepts and mastery progress.",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const concepts = await getConcepts();
  const totalConcepts = concepts.length;
  const uniqueSubjects = new Set(
    concepts
      .map((item) => (item?.subject ? String(item.subject).trim() : ""))
      .filter(Boolean)
  ).size;

  const totalScore = concepts.reduce((sum, item) => {
    const mastery = String(item?.mastery_level ?? "In Progress");
    return sum + (masteryScores[mastery] ?? 0);
  }, 0);

  const averageMastery = totalConcepts
    ? Math.round((totalScore / totalConcepts / 4) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <nav className="mb-6 rounded-3xl border border-slate-800 bg-slate-900/95 px-4 py-4 shadow-xl shadow-slate-950/20 sm:px-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
              Study Agent
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="rounded-full px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800/80"
              >
                Chat
              </Link>
              <Link
                href="/dashboard"
                className="rounded-full bg-slate-800 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-700"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </nav>
        <div className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-xl shadow-slate-950/40 backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Your study tracker</h1>
            </div>
            <p className="max-w-2xl text-slate-400">
              Review concepts saved from your study sessions and explore mastery insights at a glance.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Concepts studied</p>
              <p className="mt-3 text-3xl font-semibold text-white">{totalConcepts}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Unique subjects</p>
              <p className="mt-3 text-3xl font-semibold text-white">{uniqueSubjects}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Average mastery</p>
              <p className="mt-3 text-3xl font-semibold text-white">{averageMastery}%</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {concepts.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-8 text-center text-slate-400">
              No saved concepts yet. Start a chat and save a concept to populate your dashboard.
            </div>
          ) : (
            concepts.map((conceptItem: Record<string, unknown>, index: number) => {
              const subject = String(conceptItem.subject ?? "Unknown");
              const masteryLevel = String(conceptItem.mastery_level ?? "In Progress");
              const progress = Math.round(((masteryScores[masteryLevel] ?? 0) / 4) * 100);
              const strongAreas = toStringArray(conceptItem.strong_areas);
              const weakAreas = toStringArray(conceptItem.weak_areas);
              const nextSteps = toStringArray(conceptItem.next_steps);

              return (
                <details
                  key={`${subject}-${String(conceptItem.concept ?? index)}`}
                  className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 shadow-lg shadow-slate-950/30"
                >
                  <summary className="flex cursor-pointer flex-col gap-4 px-6 py-5 focus:outline-none focus:ring-2 focus:ring-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                            subjectPillClasses[subject] ?? "bg-slate-700 text-slate-200"
                          }`}
                        >
                          {subject}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                            masteryBadgeClasses[masteryLevel] ?? "bg-slate-700 text-slate-100"
                          }`}
                        >
                          {masteryLevel}
                        </span>
                      </div>
                      <h2 className="text-xl font-semibold text-white">
                        {String(conceptItem.concept ?? "Untitled concept")}
                      </h2>
                      <p className="text-sm text-slate-400">
                        Last updated: {formatDate(String(conceptItem.last_updated ?? ""))}
                      </p>
                    </div>
                    <div className="min-w-[180px] sm:text-right">
                      <div className="mb-2 text-sm text-slate-400">Mastery progress</div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="mt-2 text-sm font-medium text-slate-200">{progress}%</div>
                    </div>
                  </summary>
                  <div className="border-t border-slate-800 px-6 py-5 text-sm text-slate-300">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Strong areas</p>
                        <div className="flex flex-wrap gap-2">
                          {strongAreas.length > 0 ? (
                            strongAreas.map((area, idx) => (
                              <span
                                key={`strong-${idx}`}
                                className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-200"
                              >
                                {area}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500">No strong areas listed.</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Weak areas</p>
                        <div className="flex flex-wrap gap-2">
                          {weakAreas.length > 0 ? (
                            weakAreas.map((area, idx) => (
                              <span
                                key={`weak-${idx}`}
                                className="rounded-full bg-red-500/10 px-3 py-1 text-red-200"
                              >
                                {area}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500">No weak areas listed.</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Next steps</p>
                        <div className="flex flex-wrap gap-2">
                          {nextSteps.length > 0 ? (
                            nextSteps.map((step, idx) => (
                              <span
                                key={`next-${idx}`}
                                className="rounded-full bg-sky-500/10 px-3 py-1 text-sky-200"
                              >
                                {step}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500">No next steps listed.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
