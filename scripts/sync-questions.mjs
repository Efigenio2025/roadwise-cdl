import { mkdir, readFile, writeFile } from "node:fs/promises";
import { questionBank, reviewCoverage, testDefinitions } from "../content/questions.mjs";

const expected = { general: 200, air: 100, combination: 80, passenger: 80, school: 80 };
const ids = new Set();

for (const question of questionBank) {
  if (ids.has(question.id)) throw new Error(`Duplicate question id: ${question.id}`);
  ids.add(question.id);
  if (!(question.test in expected)) throw new Error(`Unknown test: ${question.test}`);
  if (!Array.isArray(question.choices) || question.choices.length !== 4) throw new Error(`${question.id} must have four choices`);
  if (new Set(question.choices).size !== 4) throw new Error(`${question.id} must have four unique choices`);
  if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex > 3) throw new Error(`${question.id} has an invalid answer`);
  for (const key of ["domain", "topic", "prompt", "explanation", "sourceReference"]) {
    if (!question[key]?.trim()) throw new Error(`${question.id} is missing ${key}`);
  }
  if (!["standard","technical"].includes(question.difficulty)) throw new Error(`${question.id} has an invalid difficulty`);
  if (!Array.isArray(question.reviewRefs)) throw new Error(`${question.id} must have reviewRefs`);
}

for (const [test, count] of Object.entries(expected)) {
  const actual = questionBank.filter((question) => question.test === test).length;
  if (actual !== count) throw new Error(`${test}: expected ${count}, found ${actual}`);
  if (testDefinitions[test].poolSize !== count) throw new Error(`${test}: pool-size definition mismatch`);
}

const mappedIds = new Set(questionBank.flatMap((question)=>question.reviewRefs));
for (const item of reviewCoverage) {
  if (!mappedIds.has(item.id) || !item.questionIds.length) throw new Error(`Review concept ${item.id} has no mapped question`);
  if (item.questionIds.some((id)=>!ids.has(id))) throw new Error(`Review concept ${item.id} maps to an unknown question`);
}

const payload = JSON.stringify({ version: 5, tests: testDefinitions, reviewCoverage, questions: questionBank }, null, 2) + "\n";
const selector = await readFile(new URL("../content/selector.mjs", import.meta.url), "utf8");
await Promise.all(["public", "docs"].map(async (directory) => {
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(`${directory}/questions.json`, payload, "utf8"),
    writeFile(`${directory}/selector.js`, selector, "utf8"),
  ]);
}));

console.log(`Validated and synced ${questionBank.length} questions.`);

