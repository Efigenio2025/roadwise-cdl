export function scaledBlueprint(blueprint, count) {
  const entries = Object.entries(blueprint);
  const total = entries.reduce((sum, [, quota]) => sum + quota, 0);
  const scaled = entries.map(([domain, quota], index) => {
    const exact = quota * count / total;
    return { domain, quota: Math.floor(exact), remainder: exact - Math.floor(exact), index };
  });
  let remaining = count - scaled.reduce((sum, item) => sum + item.quota, 0);
  scaled.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let index = 0; index < remaining; index += 1) scaled[index % scaled.length].quota += 1;
  return Object.fromEntries(scaled.sort((a, b) => a.index - b.index).map(({ domain, quota }) => [domain, quota]));
}

export function selectQuestions({ questions, test, count, history = [], blueprint, rng = Math.random }) {
  const pool = questions.filter((question) => question.test === test);
  if (pool.length < count) throw new Error(`${test} needs ${count} questions but has ${pool.length}`);

  const recent = history.filter((attempt) => attempt.test === test).slice(0, 3);
  const usage = new Map();
  recent.forEach((attempt, recency) => {
    for (const id of attempt.questionIds || []) {
      const value = usage.get(id) || { count: 0, newest: Number.POSITIVE_INFINITY };
      value.count += 1;
      value.newest = Math.min(value.newest, recency);
      usage.set(id, value);
    }
  });

  const quotas = scaledBlueprint(blueprint, count);
  const selected = [];
  for (const [domain, quota] of Object.entries(quotas)) {
    const candidates = pool.filter((question) => question.domain === domain).map((question) => ({
      question,
      random: rng(),
      usage: usage.get(question.id) || { count: 0, newest: Number.POSITIVE_INFINITY },
    }));
    if (candidates.length < quota) throw new Error(`${test}/${domain} needs ${quota} questions but has ${candidates.length}`);
    candidates.sort((a, b) => a.usage.count - b.usage.count || b.usage.newest - a.usage.newest || a.random - b.random);
    selected.push(...candidates.slice(0, quota).map((item) => item.question));
  }

  return selected.map((question) => ({ question, random: rng() })).sort((a, b) => a.random - b.random).map((item) => item.question);
}

