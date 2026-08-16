import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { questionBank, testDefinitions } from "../content/questions.mjs";

const expected = { general: 50, air: 25, combination: 20, passenger: 20, school: 20 };

test("question bank has the exact Nebraska practice-test lengths", () => {
  assert.equal(questionBank.length, 135);
  for (const [key, count] of Object.entries(expected)) {
    assert.equal(questionBank.filter((question) => question.test === key).length, count);
    assert.equal(testDefinitions[key].questionCount, count);
    assert.equal(testDefinitions[key].passCount, Math.ceil(count * 0.8));
  }
});

test("every question is complete and uniquely identified", () => {
  assert.equal(new Set(questionBank.map((question) => question.id)).size, questionBank.length);
  for (const question of questionBank) {
    assert.equal(question.choices.length, 4, question.id);
    assert.ok(Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < 4, question.id);
    assert.ok(question.prompt.length > 15, question.id);
    assert.ok(question.explanation.length > 20, question.id);
    assert.ok(question.sourceReference.length > 5, question.id);
    assert.equal(new Set(question.choices).size, 4, question.id);
  }
});

test("passing boundaries are exactly 80 percent", () => {
  const passed = (score, total) => score >= Math.ceil(total * 0.8);
  assert.equal(passed(39, 50), false);
  assert.equal(passed(40, 50), true);
  assert.equal(passed(19, 25), false);
  assert.equal(passed(20, 25), true);
  assert.equal(passed(15, 20), false);
  assert.equal(passed(16, 20), true);
});

test("GitHub Pages ships the practice UI and offline question bank", async () => {
  const [html, script, worker, json] = await Promise.all([
    readFile(new URL("../docs/index.html", import.meta.url), "utf8"),
    readFile(new URL("../docs/practice.js", import.meta.url), "utf8"),
    readFile(new URL("../docs/service-worker.js", import.meta.url), "utf8"),
    readFile(new URL("../docs/questions.json", import.meta.url), "utf8"),
  ]);
  assert.match(html, /id="practiceApp"/);
  assert.match(script, /roadwise-practice-session-v2/);
  assert.match(script, /data-action="submit"/);
  assert.match(worker, /questions\.json/);
  assert.equal(JSON.parse(json).questions.length, 135);
});

