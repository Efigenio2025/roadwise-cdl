import assert from "node:assert/strict";
import test from "node:test";
import { questionBank, testDefinitions } from "../content/questions.mjs";
import { DAY_MS, domainPerformance, dueReviewIds, nextRecommendation, readinessForTest, reviewQuestion, routeTests, selectAdaptiveQuestions } from "../content/study-engine.mjs";

const seeded=(seed=1)=>()=>((seed=seed*1664525+1013904223>>>0)/4294967296);
const byId=new Map(questionBank.map(question=>[question.id,question]));

test("study routes respect the Air Brakes preference",()=>{
  assert.deepEqual(routeTests({route:"class-a",airBrakes:true}),["general","air","combination"]);
  assert.deepEqual(routeTests({route:"class-a",airBrakes:false}),["general","combination"]);
  assert.deepEqual(routeTests({route:"school",airBrakes:false}),["general","passenger","school"]);
});

test("review scheduling advances and resets at fixed intervals",()=>{
  const now=1_700_000_000_000;
  let schedule=reviewQuestion({},"GEN-001",true,now);
  assert.equal(schedule["GEN-001"].stage,1);
  assert.equal(schedule["GEN-001"].dueAt,now+DAY_MS);
  schedule=reviewQuestion(schedule,"GEN-001",true,now+DAY_MS);
  assert.equal(schedule["GEN-001"].stage,2);
  assert.equal(schedule["GEN-001"].dueAt,now+DAY_MS+3*DAY_MS);
  schedule=reviewQuestion(schedule,"GEN-001",false,now+2*DAY_MS);
  assert.equal(schedule["GEN-001"].stage,0);
  assert.equal(schedule["GEN-001"].dueAt,now+2*DAY_MS);
  assert.deepEqual(dueReviewIds(schedule,byId,"general",now+2*DAY_MS),["GEN-001"]);
});

test("adaptive drills include due material without duplicates",()=>{
  const now=1_700_000_000_000;
  const schedule={"GEN-001":{stage:0,dueAt:now-1,correctStreak:0,lastAnsweredAt:now-1000}};
  const selected=selectAdaptiveQuestions({questions:questionBank,test:"general",count:10,reviewSchedule:schedule,now,rng:seeded(4)});
  assert.equal(selected.length,10);
  assert.equal(new Set(selected.map(question=>question.id)).size,10);
  assert.ok(selected.some(question=>question.id==="GEN-001"));
  assert.ok(selected.filter(question=>question.difficulty==="technical").length>=2);
});

test("readiness requires two passing exams and no weak domain",()=>{
  const selected=questionBank.filter(question=>question.test==="air").slice(0,25);
  const answers=Object.fromEntries(selected.map(question=>[question.id,question.correctIndex]));
  const attempts=[1,2].map(index=>({id:String(index),test:"air",mode:"exam",score:25,total:25,passed:true,answers,questionIds:selected.map(question=>question.id)}));
  const ready=readinessForTest({attempts,questionsById:byId,test:"air"});
  assert.equal(ready.ready,true);
  const performance=domainPerformance({attempts,questionsById:byId,test:"air"});
  assert.ok(Object.values(performance).every(domain=>domain.percent===100));
});

test("recommendations prefer saved work, then due review",()=>{
  const definitions=testDefinitions;
  const profile={route:"school",airBrakes:false};
  const activeSession={test:"general"};
  assert.equal(nextRecommendation({profile,attempts:[],activeSession,reviewSchedule:{},questionsById:byId,definitions}).kind,"resume");
  const now=1_700_000_000_000;
  const reviewSchedule={"PAS-001":{stage:0,dueAt:now-1,correctStreak:0,lastAnsweredAt:now-100}};
  const next=nextRecommendation({profile,attempts:[],activeSession:null,reviewSchedule,questionsById:byId,definitions,now});
  assert.equal(next.kind,"review");
  assert.equal(next.test,"passenger");
});

