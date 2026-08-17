export const DAY_MS = 86_400_000;
export const REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 14, 30];

export const STUDY_ROUTES = {
  "class-a": {
    title: "Class A",
    description: "Tractor-trailer study route",
    tests: ["general", "air", "combination"],
  },
  "class-b": {
    title: "Class B",
    description: "Straight-truck study route",
    tests: ["general", "air"],
  },
  passenger: {
    title: "Passenger",
    description: "Passenger-carrying vehicle route",
    tests: ["general", "air", "passenger"],
  },
  school: {
    title: "School Bus",
    description: "Passenger and school bus route",
    tests: ["general", "air", "passenger", "school"],
  },
};

export function routeTests(profile) {
  const route = STUDY_ROUTES[profile?.route] || STUDY_ROUTES.school;
  return route.tests.filter((test) => test !== "air" || profile?.airBrakes !== false);
}

export function domainPerformance({ attempts, questionsById, test, limit = 100 }) {
  const totals = new Map();
  const relevant = attempts.filter((attempt) => attempt.test === test).slice(0, 10);
  let observed = 0;
  for (const attempt of relevant) {
    for (const id of attempt.questionIds || []) {
      if (observed >= limit) break;
      const question = questionsById.get(id);
      if (!question) continue;
      const current = totals.get(question.domain) || { correct: 0, total: 0 };
      current.total += 1;
      if (attempt.answers?.[id] === question.correctIndex) current.correct += 1;
      totals.set(question.domain, current);
      observed += 1;
    }
    if (observed >= limit) break;
  }
  return Object.fromEntries([...totals].map(([domain, value]) => [domain, {
    ...value,
    percent: Math.round(value.correct / value.total * 100),
  }]));
}

export function readinessForTest({ attempts, questionsById, test }) {
  const exams = attempts.filter((attempt) => attempt.test === test && attempt.mode === "exam").slice(0, 3);
  const domains = domainPerformance({ attempts, questionsById, test });
  const domainValues = Object.values(domains);
  const passed = exams.filter((attempt) => attempt.passed).length;
  const enoughData = exams.length >= 2 && domainValues.length > 0;
  const weakest = domainValues.length ? Math.min(...domainValues.map((item) => item.percent)) : null;
  const ready = enoughData && passed >= 2 && weakest >= 70;
  const score = exams.length
    ? Math.round(exams.reduce((sum, attempt) => sum + Math.round(attempt.score / attempt.total * 100), 0) / exams.length)
    : null;
  return { ready, enoughData, passed, exams: exams.length, weakest, score, domains };
}

export function reviewQuestion(reviewSchedule, questionId, correct, now = Date.now()) {
  const current = reviewSchedule[questionId] || { stage: 0, dueAt: now, correctStreak: 0, lastAnsweredAt: 0 };
  const stage = correct ? Math.min(current.stage + 1, REVIEW_INTERVAL_DAYS.length - 1) : 0;
  return {
    ...reviewSchedule,
    [questionId]: {
      stage,
      dueAt: now + REVIEW_INTERVAL_DAYS[stage] * DAY_MS,
      correctStreak: correct ? current.correctStreak + 1 : 0,
      lastAnsweredAt: now,
    },
  };
}

export function dueReviewIds(reviewSchedule, questionsById, test, now = Date.now()) {
  return Object.entries(reviewSchedule)
    .filter(([id, item]) => item.dueAt <= now && (!test || questionsById.get(id)?.test === test))
    .sort((a, b) => a[1].dueAt - b[1].dueAt)
    .map(([id]) => id);
}

function shuffled(items, rng) {
  return items.map((item) => ({ item, random: rng() })).sort((a, b) => a.random - b.random).map(({ item }) => item);
}

export function selectAdaptiveQuestions({ questions, test, count, attempts = [], reviewSchedule = {}, now = Date.now(), rng = Math.random }) {
  const pool = questions.filter((question) => question.test === test);
  if (pool.length < count) throw new Error(`${test} needs ${count} questions but has ${pool.length}`);
  const byId = new Map(questions.map((question) => [question.id, question]));
  const domains = domainPerformance({ attempts, questionsById: byId, test });
  const domainScore = (domain) => domains[domain]?.percent ?? 50;
  const recent = attempts.filter((attempt) => attempt.test === test).slice(0, 3);
  const recentIds = new Set(recent.flatMap((attempt) => attempt.questionIds || []));
  const misses = new Set(recent.flatMap((attempt) => (attempt.questionIds || []).filter((id) => attempt.answers?.[id] !== byId.get(id)?.correctIndex)));
  const usage = new Map();
  for (const attempt of attempts.filter((item) => item.test === test)) {
    for (const id of attempt.questionIds || []) usage.set(id, (usage.get(id) || 0) + 1);
  }
  const due = new Set(dueReviewIds(reviewSchedule, byId, test, now));
  const ranked = shuffled(pool, rng).sort((a, b) => {
    const priorityA = (due.has(a.id) ? -1000 : 0) + (misses.has(a.id) ? -500 : 0) + domainScore(a.domain) * 5 + (usage.get(a.id) || 0) * 35 + (recentIds.has(a.id) ? 60 : 0) + (a.difficulty === "technical" ? -10 : 0);
    const priorityB = (due.has(b.id) ? -1000 : 0) + (misses.has(b.id) ? -500 : 0) + domainScore(b.domain) * 5 + (usage.get(b.id) || 0) * 35 + (recentIds.has(b.id) ? 60 : 0) + (b.difficulty === "technical" ? -10 : 0);
    return priorityA - priorityB;
  });
  const selected = ranked.slice(0, count);
  const technicalTarget = Math.max(1, Math.round(count * 0.25));
  let technicalCount = selected.filter((question) => question.difficulty === "technical").length;
  if (technicalCount < technicalTarget) {
    const selectedIds = new Set(selected.map((question) => question.id));
    const technical = ranked.filter((question) => question.difficulty === "technical" && !selectedIds.has(question.id));
    for (const incoming of technical) {
      const outgoingIndex = selected.findIndex((question) => question.difficulty !== "technical" && !due.has(question.id) && !misses.has(question.id));
      if (outgoingIndex < 0) break;
      selected[outgoingIndex] = incoming;
      technicalCount += 1;
      if (technicalCount >= technicalTarget) break;
    }
  }
  return shuffled(selected, rng);
}

export function nextRecommendation({ profile, attempts, activeSession, reviewSchedule, questionsById, definitions, now = Date.now() }) {
  if (activeSession) return { kind: "resume", test: activeSession.test, label: "Resume your saved session" };
  const due = dueReviewIds(reviewSchedule, questionsById, undefined, now);
  if (due.length) return { kind: "review", test: questionsById.get(due[0])?.test || "general", label: `Review ${due.length} due mistake${due.length === 1 ? "" : "s"}` };
  const tests = routeTests(profile);
  for (const test of tests) {
    const readiness = readinessForTest({ attempts, questionsById, test });
    if (!readiness.ready) {
      if (readiness.exams >= 1) return { kind: "adaptive", test, label: `Strengthen ${definitions[test].title}` };
      return { kind: "learn", test, label: `Start ${definitions[test].title}` };
    }
  }
  return { kind: "maintain", test: tests[0] || "general", label: "Keep your skills road-ready" };
}

