import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { questionBank, testDefinitions } from "../content/questions.mjs";
import { scaledBlueprint, selectQuestions } from "../content/selector.mjs";

const pools = { general: 100, air: 50, combination: 40, passenger: 40, school: 40 };
const exams = { general: 50, air: 25, combination: 20, passenger: 20, school: 20 };
const seeded = (seed = 1) => () => ((seed = seed * 1664525 + 1013904223 >>> 0) / 4294967296);

test("question pools are twice the official-length practice tests", () => {
  assert.equal(questionBank.length, 270);
  for (const [key, poolSize] of Object.entries(pools)) {
    assert.equal(questionBank.filter((question) => question.test === key).length, poolSize);
    assert.equal(testDefinitions[key].poolSize, poolSize);
    assert.equal(testDefinitions[key].questionCount, exams[key]);
    assert.equal(testDefinitions[key].passCount, Math.ceil(exams[key] * 0.8));
  }
});

test("every question is complete, categorized, and uniquely identified", () => {
  assert.equal(new Set(questionBank.map((question) => question.id)).size, questionBank.length);
  for (const question of questionBank) {
    assert.equal(question.choices.length, 4, question.id);
    assert.equal(new Set(question.choices).size, 4, question.id);
    assert.ok(Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < 4, question.id);
    for (const key of ["domain", "topic", "prompt", "explanation", "sourceReference"]) assert.ok(question[key]?.length > 2, `${question.id}/${key}`);
    assert.ok(question.domain in testDefinitions[question.test].blueprint, `${question.id}/${question.domain}`);
  }
});

test("all original question IDs remain available for saved sessions", () => {
  const expectedOriginals = { GEN: 50, AIR: 25, COM: 20, PAS: 20, SCH: 20 };
  for (const [prefix, count] of Object.entries(expectedOriginals)) {
    for (let number = 1; number <= count; number += 1) {
      const id = `${prefix}-${String(number).padStart(3, "0")}`;
      assert.ok(questionBank.some((question) => question.id === id), id);
    }
  }
});

test("every full exam follows its domain blueprint", () => {
  for (const [key, definition] of Object.entries(testDefinitions)) {
    const selected = selectQuestions({ questions: questionBank, test: key, count: definition.questionCount, blueprint: definition.blueprint, rng: seeded(10) });
    assert.equal(selected.length, definition.questionCount);
    assert.equal(new Set(selected.map((question) => question.id)).size, selected.length);
    for (const [domain, quota] of Object.entries(definition.blueprint)) assert.equal(selected.filter((question) => question.domain === domain).length, quota, `${key}/${domain}`);
  }
});

test("a second full exam avoids every question from the first", () => {
  for (const [key, definition] of Object.entries(testDefinitions)) {
    const first = selectQuestions({ questions: questionBank, test: key, count: definition.questionCount, blueprint: definition.blueprint, rng: seeded(21) });
    const second = selectQuestions({ questions: questionBank, test: key, count: definition.questionCount, blueprint: definition.blueprint, history: [{ test: key, questionIds: first.map((question) => question.id) }], rng: seeded(22) });
    const firstIds = new Set(first.map((question) => question.id));
    assert.equal(second.filter((question) => firstIds.has(question.id)).length, 0, key);
  }
});

test("learn drills are balanced and third attempts fall back safely", () => {
  const definition = testDefinitions.school;
  const expected = scaledBlueprint(definition.blueprint, 10);
  const first = selectQuestions({ questions: questionBank, test: "school", count: 20, blueprint: definition.blueprint, rng: seeded(30) });
  const second = selectQuestions({ questions: questionBank, test: "school", count: 20, blueprint: definition.blueprint, history: [{ test: "school", questionIds: first.map((q) => q.id) }], rng: seeded(31) });
  const third = selectQuestions({ questions: questionBank, test: "school", count: 20, blueprint: definition.blueprint, history: [{ test: "school", questionIds: second.map((q) => q.id) }, { test: "school", questionIds: first.map((q) => q.id) }], rng: seeded(32) });
  const drill = selectQuestions({ questions: questionBank, test: "school", count: 10, blueprint: definition.blueprint, rng: seeded(33) });
  assert.equal(third.length, 20);
  assert.equal(new Set(third.map((q) => q.id)).size, 20);
  for (const [domain, quota] of Object.entries(expected)) assert.equal(drill.filter((q) => q.domain === domain).length, quota, domain);
});

test("passing boundaries remain exactly 80 percent", () => {
  const passed = (score, total) => score >= Math.ceil(total * 0.8);
  assert.equal(passed(39, 50), false); assert.equal(passed(40, 50), true);
  assert.equal(passed(19, 25), false); assert.equal(passed(20, 25), true);
  assert.equal(passed(15, 20), false); assert.equal(passed(16, 20), true);
});

test("GitHub Pages ships matching questions, selector, and offline assets", async () => {
  const [html, script, selector, worker, docsJson, publicJson] = await Promise.all([
    readFile(new URL("../docs/index.html", import.meta.url), "utf8"),
    readFile(new URL("../docs/practice.js", import.meta.url), "utf8"),
    readFile(new URL("../docs/selector.js", import.meta.url), "utf8"),
    readFile(new URL("../docs/service-worker.js", import.meta.url), "utf8"),
    readFile(new URL("../docs/questions.json", import.meta.url), "utf8"),
    readFile(new URL("../public/questions.json", import.meta.url), "utf8"),
  ]);
  assert.match(html, /270 manual-grounded questions/);
  assert.match(script, /selectQuestions/);
  assert.match(selector, /scaledBlueprint/);
  assert.match(worker, /roadwise-cdl-v4/);
  assert.match(worker, /selector\.js/);
  assert.equal(JSON.parse(docsJson).questions.length, 270);
  assert.equal(docsJson, publicJson);
});

