import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { manualCatalog, questionBank, reviewCoverage, sourceCatalog, testDefinitions } from "../content/questions.mjs";
import { scaledBlueprint, selectQuestions } from "../content/selector.mjs";

const pools = { general: 200, air: 100, combination: 80, passenger: 80, school: 80 };
const exams = { general: 50, air: 25, combination: 20, passenger: 20, school: 20 };
const seeded = (seed = 1) => () => ((seed = seed * 1664525 + 1013904223 >>> 0) / 4294967296);

test("question pools contain four official-length practice tests", () => {
  assert.equal(questionBank.length, 540);
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
    assert.ok(["standard","technical"].includes(question.difficulty), question.id);
    assert.ok(Array.isArray(question.reviewRefs), question.id);
    assert.ok(Array.isArray(question.sourceIds) && question.sourceIds.length > 0, question.id);
    assert.ok(question.sourceIds.every((sourceId)=>sourceCatalog[sourceId]), question.id);
    assert.ok(question.domain in testDefinitions[question.test].blueprint, `${question.id}/${question.domain}`);
  }
});

test("every manual reference resolves to a precise official page", () => {
  assert.deepEqual(Object.keys(manualCatalog).sort(), ["cdl-2026", "pupil-2019"]);
  assert.equal(manualCatalog["cdl-2026"].totalPages, 176);
  assert.equal(manualCatalog["pupil-2019"].totalPages, 51);
  assert.ok(Object.keys(sourceCatalog).length >= 289);
  for (const [sourceId, source] of Object.entries(sourceCatalog)) {
    const manual = manualCatalog[source.manualId];
    assert.ok(manual, sourceId);
    assert.ok(source.section.length > 2, sourceId);
    assert.ok(source.printedPage.length > 0, sourceId);
    assert.ok(source.studySummary.length > 40, sourceId);
    assert.ok(Number.isInteger(source.pdfPage) && source.pdfPage >= 1 && source.pdfPage <= manual.totalPages, sourceId);
    assert.match(manual.officialUrl, /^https:\/\/(dmv\.nebraska\.gov|cdn\.education\.ne\.gov)\//);
  }
  assert.ok(questionBank.some((question) => question.sourceIds.length > 1), "compound references are preserved");
  assert.doesNotMatch(JSON.stringify({ manualCatalog, sourceCatalog, questionBank }), /(?:Â|Ã|â(?:œ|€™|€)|�)/, "reference data has no encoding artifacts");
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

test("the third-set IDs and domain allocations are exact", () => {
  const ranges = { GEN: [101, 150, "general"], AIR: [51, 75, "air"], COM: [41, 60, "combination"], PAS: [41, 60, "passenger"], SCH: [41, 60, "school"] };
  for (const [prefix, [start, end, subject]] of Object.entries(ranges)) {
    for (let number = start; number <= end; number += 1) assert.ok(questionBank.some((q) => q.id === `${prefix}-${String(number).padStart(3, "0")}`), `${prefix}-${number}`);
    for (const [domain, quota] of Object.entries(testDefinitions[subject].blueprint)) {
      const thirdSet = questionBank.filter((q) => q.test === subject && q.id.startsWith(`${prefix}-`) && Number(q.id.slice(-3)) >= start && Number(q.id.slice(-3)) <= end);
      assert.equal(thirdSet.filter((q) => q.domain === domain).length, quota, `${subject}/${domain}`);
    }
  }
});

test("the fourth set has stable IDs, exact domains, and technical tags", () => {
  const ranges = { GEN: [151, 200, "general"], AIR: [76, 100, "air"], COM: [61, 80, "combination"], PAS: [61, 80, "passenger"], SCH: [61, 80, "school"] };
  for (const [prefix, [start, end, subject]] of Object.entries(ranges)) {
    const fourthSet = questionBank.filter((q) => q.test === subject && q.id.startsWith(`${prefix}-`) && Number(q.id.slice(-3)) >= start);
    assert.equal(fourthSet.length, end-start+1, subject);
    for (let number = start; number <= end; number += 1) assert.ok(fourthSet.some((q) => q.id === `${prefix}-${String(number).padStart(3, "0")}`), `${prefix}-${number}`);
    assert.ok(fourthSet.every((q)=>q.difficulty==="technical"), subject);
    for (const [domain, quota] of Object.entries(testDefinitions[subject].blueprint)) {
      assert.equal(fourthSet.filter((q) => q.domain === domain).length, quota, `${subject}/${domain}`);
    }
  }
});

test("manual-review coverage catalog maps every concept to a valid question", () => {
  assert.ok(reviewCoverage.length >= 100);
  const ids = new Set(questionBank.map((q)=>q.id));
  const mapped = new Set(questionBank.flatMap((q)=>q.reviewRefs));
  for (const item of reviewCoverage) {
    assert.ok(mapped.has(item.id), item.id);
    assert.ok(item.questionIds.length > 0, item.id);
    assert.ok(item.questionIds.every((id)=>ids.has(id)), item.id);
  }
});

test("every full exam follows its domain blueprint", () => {
  for (const [key, definition] of Object.entries(testDefinitions)) {
    const selected = selectQuestions({ questions: questionBank, test: key, count: definition.questionCount, blueprint: definition.blueprint, rng: seeded(10) });
    assert.equal(selected.length, definition.questionCount);
    assert.equal(new Set(selected.map((question) => question.id)).size, selected.length);
    assert.equal(selected.filter((q)=>q.difficulty==="technical").length, Math.round(definition.questionCount*.25), key);
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

test("four consecutive full exams do not repeat questions", () => {
  for (const [key, definition] of Object.entries(testDefinitions)) {
    const attempts=[]; const seen=new Set();
    for(let index=0;index<4;index++){
      const selected=selectQuestions({questions:questionBank,test:key,count:definition.questionCount,blueprint:definition.blueprint,history:attempts,rng:seeded(41+index)});
      assert.equal(selected.filter((q)=>seen.has(q.id)).length,0,`${key}/attempt-${index+1}`);
      selected.forEach((q)=>seen.add(q.id));
      attempts.unshift({test:key,questionIds:selected.map((q)=>q.id)});
      for (const [domain, quota] of Object.entries(definition.blueprint)) assert.equal(selected.filter((q) => q.domain === domain).length, quota, `${key}/${domain}`);
    }
  }
});

test("fifth attempts fall back without internal duplicates", () => {
  for (const [key, definition] of Object.entries(testDefinitions)) {
    const attempts=[];
    for(let index=0;index<4;index++) attempts.unshift({test:key,questionIds:selectQuestions({questions:questionBank,test:key,count:definition.questionCount,blueprint:definition.blueprint,history:attempts,rng:seeded(50+index)}).map((q)=>q.id)});
    const fifth=selectQuestions({questions:questionBank,test:key,count:definition.questionCount,blueprint:definition.blueprint,history:attempts,rng:seeded(55)});
    assert.equal(fifth.length,definition.questionCount,key);
    assert.equal(new Set(fifth.map((q)=>q.id)).size,fifth.length,key);
    assert.equal(fifth.filter((q)=>q.difficulty==="technical").length,Math.round(definition.questionCount*.25),key);
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
  assert.ok([2,3].includes(drill.filter((q)=>q.difficulty==="technical").length));
});

test("passing boundaries remain exactly 80 percent", () => {
  const passed = (score, total) => score >= Math.ceil(total * 0.8);
  assert.equal(passed(39, 50), false); assert.equal(passed(40, 50), true);
  assert.equal(passed(19, 25), false); assert.equal(passed(20, 25), true);
  assert.equal(passed(15, 20), false); assert.equal(passed(16, 20), true);
});

test("GitHub Pages ships matching questions, selector, and offline assets", async () => {
  const html = await readFile(new URL("../docs/index.html", import.meta.url), "utf8");
  const scriptPath = html.match(/src="\.\/(assets\/index-[^"]+\.js)"/)?.[1];
  const stylePath = html.match(/href="\.\/(assets\/index-[^"]+\.css)"/)?.[1];
  assert.ok(scriptPath && stylePath, "Pages must reference its generated React assets");
  const [script, styles, selector, worker, manifest, docsJson, publicJson] = await Promise.all([
    readFile(new URL(`../docs/${scriptPath}`, import.meta.url), "utf8"),
    readFile(new URL(`../docs/${stylePath}`, import.meta.url), "utf8"),
    readFile(new URL("../docs/selector.js", import.meta.url), "utf8"),
    readFile(new URL("../docs/service-worker.js", import.meta.url), "utf8"),
    readFile(new URL("../docs/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../docs/questions.json", import.meta.url), "utf8"),
    readFile(new URL("../public/questions.json", import.meta.url), "utf8"),
  ]);
  assert.match(html, /Roadwise CDL \| Know the Route/);
  assert.match(script, /BUILD MY STUDY PLAN/);
  assert.match(script, /QUICK 5/);
  assert.match(script, /LEARN 10/);
  assert.match(script, /roadwise-state-v3/);
  assert.match(styles, /\.bottomNav/);
  assert.doesNotMatch(`${html}\n${script}`, /Â|â(?:œ|†|˜|€)|Ã|�/);
  assert.match(selector, /selectQuestions/);
  assert.match(script, /questions\.json/);
  assert.match(script, /READ THE MANUAL REFERENCE/);
  assert.match(script, /MISSED/);
  assert.match(styles, /\.sourceDialog/);
  for (const screen of ["Home", "Study", "Tests", "Progress", "Settings"]) assert.match(script, new RegExp(screen));
  assert.match(script, /quiz/);
  assert.match(script, /results/);
  assert.match(script, /Mistake review/i);
  assert.match(selector, /scaledBlueprint/);
  assert.match(worker, /self\.registration\.scope/);
  const parsedManifest=JSON.parse(manifest);
  assert.equal(parsedManifest.start_url, "./#home");
  assert.equal(parsedManifest.prefer_related_applications, false);
  assert.ok(parsedManifest.icons.some((icon)=>icon.sizes==="192x192"&&icon.purpose==="any"));
  assert.ok(parsedManifest.icons.some((icon)=>icon.sizes==="512x512"&&icon.purpose==="any"));
  assert.ok(parsedManifest.icons.some((icon)=>icon.sizes==="512x512"&&icon.purpose==="maskable"));
  assert.match(script,/beforeinstallprompt/);
  assert.match(script,/INSTALL ROADWISE/);
  assert.match(worker,/roadwise-sites-v16/);
  assert.equal(JSON.parse(docsJson).questions.length, 540);
  assert.equal(JSON.parse(docsJson).version, 6);
  assert.equal(Object.keys(JSON.parse(docsJson).sources).length, Object.keys(sourceCatalog).length);
  assert.equal(docsJson, publicJson);
});

