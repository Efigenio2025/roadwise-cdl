import { mkdir, readFile, writeFile } from "node:fs/promises";
import { questionBank, testDefinitions } from "../content/questions.mjs";

const expected = { general: 150, air: 75, combination: 60, passenger: 60, school: 60 };
const ids = new Set();

for (const question of questionBank) {
  if (ids.has(question.id)) throw new Error(`Duplicate question id: ${question.id}`);
  ids.add(question.id);
  if (!(question.test in expected)) throw new Error(`Unknown test: ${question.test}`);
  if (!Array.isArray(question.choices) || question.choices.length !== 4) throw new Error(`${question.id} must have four choices`);
  if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex > 3) throw new Error(`${question.id} has an invalid answer`);
  for (const key of ["domain", "topic", "prompt", "explanation", "sourceReference"]) {
    if (!question[key]?.trim()) throw new Error(`${question.id} is missing ${key}`);
  }
}

for (const [test, count] of Object.entries(expected)) {
  const actual = questionBank.filter((question) => question.test === test).length;
  if (actual !== count) throw new Error(`${test}: expected ${count}, found ${actual}`);
  if (testDefinitions[test].poolSize !== count) throw new Error(`${test}: pool-size definition mismatch`);
}

const payload = JSON.stringify({ version: 4, tests: testDefinitions, questions: questionBank }, null, 2) + "\n";
const selector = await readFile(new URL("../content/selector.mjs", import.meta.url), "utf8");
await Promise.all(["public", "docs"].map(async (directory) => {
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(`${directory}/questions.json`, payload, "utf8"),
    writeFile(`${directory}/selector.js`, selector, "utf8"),
  ]);
}));

console.log(`Validated and synced ${questionBank.length} questions.`);

