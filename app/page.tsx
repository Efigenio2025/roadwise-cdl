"use client";

import { useEffect, useMemo, useState } from "react";
// @ts-expect-error Shared browser-safe selector is emitted as JavaScript for GitHub Pages.
import { selectQuestions } from "../content/selector.mjs";

type TestKey = "general" | "air" | "combination" | "passenger" | "school";
type Mode = "learn" | "exam";
type Question = { id:string; test:TestKey; domain:string; topic:string; prompt:string; choices:string[]; correctIndex:number; explanation:string; sourceReference:string };
type TestDefinition = { title:string; code:string; questionCount:number; poolSize:number; passCount:number; manual:string; blueprint:Record<string,number> };
type Bank = { version:number; tests:Record<TestKey,TestDefinition>; questions:Question[] };
type Session = { test:TestKey; mode:Mode; questionIds:string[]; orders:Record<string,number[]>; answers:Record<string,number>; flagged:string[]; current:number; startedAt:number };
type Attempt = { id:string; test:TestKey; mode:Mode; score:number; total:number; passed:boolean; elapsed:number; completedAt:number; answers:Record<string,number>; questionIds:string[] };

const TEST_ORDER: TestKey[] = ["general","air","combination","passenger","school"];
const SESSION_KEY = "roadwise-practice-session-v2";
const HISTORY_KEY = "roadwise-practice-history-v2";
const shuffle = <T,>(items:T[]) => { const copy=[...items]; for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];} return copy; };
const formatTime = (seconds:number) => `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`;
const percent = (attempt:Attempt) => Math.round(attempt.score/attempt.total*100);

const steps = [
  ["Choose class + work","Match Class A, B, or C and the endorsements to the Nebraska job you want."],
  ["Earn your CLP","Pass every applicable Nebraska knowledge test and receive your learner's permit."],
  ["Train + hold","Complete required ELDT and hold your Nebraska CLP for at least 14 days."],
  ["Pass in sequence","Complete inspection, basic control, then road testing in that order."],
];

function Brand(){return <a className="brand" href="#top"><span>RW</span><strong>ROADWISE<small>CDL</small></strong></a>}

export default function Home(){
  const [bank,setBank]=useState<Bank|null>(null);
  const [done,setDone]=useState<number[]>([]);
  const [history,setHistory]=useState<Attempt[]>([]);
  const [session,setSession]=useState<Session|null>(null);
  const [result,setResult]=useState<Attempt|null>(null);
  const [elapsed,setElapsed]=useState(0);
  const [hasSavedSession,setHasSavedSession]=useState(false);

  useEffect(()=>{
    fetch("/questions.json").then(r=>{if(!r.ok)throw new Error("Question bank unavailable");return r.json()}).then(setBank).catch(()=>setBank(null));
    try{setDone(JSON.parse(localStorage.getItem("roadwise-progress")||"[]"));setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]"));setHasSavedSession(Boolean(localStorage.getItem(SESSION_KEY)));}catch{}
  },[]);
  useEffect(()=>{if(!session)return;localStorage.setItem(SESSION_KEY,JSON.stringify(session));setElapsed(Math.floor((Date.now()-session.startedAt)/1000));const id=window.setInterval(()=>setElapsed(Math.floor((Date.now()-session.startedAt)/1000)),1000);return()=>clearInterval(id)},[session]);

  const questionsById=useMemo(()=>new Map((bank?.questions||[]).map(q=>[q.id,q])),[bank]);
  const current=session?questionsById.get(session.questionIds[session.current]):null;
  const average=history.length?Math.round(history.reduce((sum,item)=>sum+percent(item),0)/history.length):null;
  const recent=history[0]||null;

  const toggleStep=(index:number)=>{const next=done.includes(index)?done.filter(x=>x!==index):[...done,index];setDone(next);localStorage.setItem("roadwise-progress",JSON.stringify(next))};
  const start=(test:TestKey,mode:Mode)=>{if(!bank)return;const definition=bank.tests[test];const chosen=selectQuestions({questions:bank.questions,test,count:mode==="learn"?10:definition.questionCount,history,blueprint:definition.blueprint}) as Question[];const orders=Object.fromEntries(chosen.map(q=>[q.id,shuffle([0,1,2,3])])) as Record<string,number[]>;setResult(null);setHasSavedSession(true);setSession({test,mode,questionIds:chosen.map(q=>q.id),orders,answers:{},flagged:[],current:0,startedAt:Date.now()});window.location.hash="practice"};
  const resume=()=>{try{const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||"null");if(saved){setResult(null);setSession(saved)}}catch{}};
  const select=(originalIndex:number)=>{if(!session||!current)return;if(session.mode==="learn"&&session.answers[current.id]!==undefined)return;setSession({...session,answers:{...session.answers,[current.id]:originalIndex}})};
  const move=(currentIndex:number)=>session&&setSession({...session,current:Math.max(0,Math.min(session.questionIds.length-1,currentIndex))});
  const toggleFlag=()=>{if(!session||!current)return;const flagged=session.flagged.includes(current.id)?session.flagged.filter(x=>x!==current.id):[...session.flagged,current.id];setSession({...session,flagged})};
  const submit=()=>{if(!session||!bank)return;const unanswered=session.questionIds.length-Object.keys(session.answers).length;if(unanswered&&!window.confirm(`${unanswered} question${unanswered===1?" is":"s are"} unanswered. Submit anyway?`))return;const score=session.questionIds.filter(id=>session.answers[id]===questionsById.get(id)?.correctIndex).length;const attempt:Attempt={id:`${Date.now()}`,test:session.test,mode:session.mode,score,total:session.questionIds.length,passed:score>=Math.ceil(session.questionIds.length*.8),elapsed:Math.floor((Date.now()-session.startedAt)/1000),completedAt:Date.now(),answers:session.answers,questionIds:session.questionIds};const next=[attempt,...history].slice(0,50);setHistory(next);localStorage.setItem(HISTORY_KEY,JSON.stringify(next));localStorage.removeItem(SESSION_KEY);setHasSavedSession(false);setResult(attempt);setSession(null)};
  const quit=()=>{if(window.confirm("Leave this test? Your answers will stay saved so you can resume later.")){setHasSavedSession(true);setSession(null)}};
  const clearHistory=()=>{if(window.confirm("Clear saved test scores? Your CDL roadmap progress will not be erased.")){setHistory([]);localStorage.removeItem(HISTORY_KEY)}};

  return <main className="siteCanvas" id="top"><div className={`appFrame ${session||result?"focusMode":""}`}>
    <aside className="sideRail">
      <Brand/>
      <nav aria-label="Primary navigation"><a className="active" href="#top"><i/>My dashboard</a><a href="#practice">Practice tests</a><a href="#roadmap">Study roadmap</a><a href="#scores">Score history</a><a href="#endorsements">Endorsements</a></nav>
      <section className="railGoal"><p>CURRENT GOAL</p><h2>Class B + P/S</h2><span>School bus route</span><div className="railBar"><i style={{width:`${done.length*25}%`}}/></div><small>{done.length} of 4 steps</small></section>
      <section className="railStatus"><b>NEBRASKA 2026</b><span>405 questions</span><small>Works offline</small></section>
    </aside>

    <div className="workspace">
      <header className="topBar"><div>GOOD MORNING, JOSHUA</div><nav><a href="#sources">Manual</a><a href="#roadmap">Nebraska roadmap</a></nav><a className="orangeButton" href="#practice">TAKE A TEST</a><span className="avatar">JE</span></header>

      {!session&&!result&&<>
        <section className="routeHero">
          <div className="routeIntro"><p>YOUR ROAD TO A NEBRASKA CDL</p><h1>PICK YOUR ROUTE.<br/><em>BUILD YOUR SCORE.</em></h1><span>A clear path from permit study to skills testing.</span><div>{hasSavedSession?<button className="orangeButton" onClick={resume}>RESUME EXAM</button>:<button className="orangeButton" onClick={()=>start("general","learn")}>START A DRILL</button>}<small>{hasSavedSession?"Saved session ready":"405 questions ready"}</small></div></div>
          <div className="routeTrack" aria-label="CDL roadmap summary">{steps.map((step,index)=><div className={done.includes(index)?"complete":index===done.length?"current":""} key={step[0]}><span>{index+1}</span><b>{["CHOOSE","CLP TESTS","TRAIN","SKILLS"][index]}</b></div>)}</div>
          <div className="scoreSign"><small>YOUR SCORE ROUTE</small><strong>{average===null?"--":`${average}%`}</strong><span>AVERAGE SCORE</span><i><b style={{width:`${average||0}%`}}/></i></div>
        </section>

        <section className="dashboardGrid" id="practice">
          <div className="primaryColumn">
            <h2>Recommended next step</h2>
            <article className="recommendCard"><span className="roundCode">GK</span><div><small>STEP 2 OF 4</small><h3>Pass General Knowledge</h3><p>Your drills build toward the full 50-question exam. Review weak topics, then test when ready.</p></div><button onClick={()=>start("general","learn")}>CONTINUE ROUTE</button></article>
            <div className="laneHeading"><h2>Choose a test lane</h2><span>Balanced pools with fewer repeats</span></div>
            {!bank?<div className="loadingCard" role="status">Loading the CDL question bank...</div>:<div className="testLaneGrid">{TEST_ORDER.map((key,index)=>{const d=bank.tests[key];const attempts=history.filter(h=>h.test===key&&h.mode==="exam");const best=attempts.length?Math.max(...attempts.map(percent)):null;return <article className={`testLane ${index<2?"core":"compact"}`} key={key}>{index<2&&<div className="laneBand">LANE 0{index+1} | {index===0?"CORE LICENSE":"VEHICLE SYSTEMS"}</div>}<div className="laneBody"><span className="roundCode">{d.code}</span><div><h3>{d.title}</h3><p>{d.questionCount}-question exam from a pool of {d.poolSize}</p></div></div><div className="laneMeta">{best===null?`Pass with ${d.passCount}`:`Best score ${best}%`}</div><div className="laneActions"><button className="exam" onClick={()=>start(key,"exam")}>FULL EXAM</button><button onClick={()=>start(key,"learn")}>LEARN 10</button></div></article>})}</div>}
            <div className="testingNote">General Knowledge comes before the other Nebraska written CDL tests. These are original practice questions, not official DMV exam items.</div>
          </div>

          <aside className="insights" id="roadmap">
            <h2>Your progress</h2>
            <section className="progressCard"><small>NEBRASKA ROADMAP</small><h3>{done.length} of 4 milestones complete</h3><div className="progressDots">{steps.map((step,index)=><button key={step[0]} className={done.includes(index)?"complete":index===done.length?"current":""} onClick={()=>toggleStep(index)} aria-label={`${step[0]}: ${done.includes(index)?"complete":"not complete"}`}>{index+1}</button>)}</div><p>Current: {steps[Math.min(done.length,3)][0]}</p></section>
            <div className="statPair"><section><small>THIS WEEK</small><strong>{history.length}</strong><span>saved attempts</span></section><section><small>AVERAGE SCORE</small><strong>{average===null?"--":`${average}%`}</strong><span className={average!==null&&average>=80?"good":""}>{average===null?"Complete a test":average>=80?"Above passing target":"Keep studying"}</span></section></div>
            <section className="latestReport" id="scores"><h2>Latest road report</h2>{recent?<div><small>{bank?.tests[recent.test]?.title||recent.test}</small><p>{recent.score} of {recent.total} correct</p><strong className={recent.passed?"good":""}>{percent(recent)}%</strong><b>{recent.passed?"PASS":"REVIEW"}</b></div>:<p className="emptyReport">Your latest completed test will appear here.</p>}{history.length>0&&<><details className="historyPanel"><summary>View recent scores</summary>{history.slice(0,5).map(item=><p key={item.id}><span>{bank?.tests[item.test]?.title}</span><b>{percent(item)}%</b></p>)}</details><button className="clearButton" onClick={clearHistory}>Clear score history</button></>}</section>
            <section className="sourceDesk" id="sources"><small>PRIMARY SOURCE</small><p>Nebraska Modified CDL Driver's Manual - March 2026</p><small>SUPPLEMENTAL</small><p>Nebraska Pupil Transportation Guide - August 2019</p></section>
          </aside>
        </section>
      </>}

      {session&&current&&bank&&<section className="focusPanel" id="practice"><section className="runner" aria-labelledby="question-title"><header><button className="plain" onClick={quit}>← Exit</button><div><b>{bank.tests[session.test].title}</b><span>{session.mode==="exam"?"FULL EXAM":"LEARN MODE"} · {formatTime(elapsed)}</span></div><button className={`flag ${session.flagged.includes(current.id)?"active":""}`} onClick={toggleFlag}>{session.flagged.includes(current.id)?"★ Flagged":"☆ Flag"}</button></header><div className="runnerProgress"><span style={{width:`${Object.keys(session.answers).length/session.questionIds.length*100}%`}}/><b>{Object.keys(session.answers).length} of {session.questionIds.length} answered</b></div><div className="questionLayout"><aside aria-label="Question navigator">{session.questionIds.map((id,i)=><button key={id} aria-label={`Question ${i+1}${session.answers[id]!==undefined?", answered":""}${session.flagged.includes(id)?", flagged":""}`} className={`${i===session.current?"current":""} ${session.answers[id]!==undefined?"answered":""} ${session.flagged.includes(id)?"marked":""}`} onClick={()=>move(i)}>{i+1}</button>)}</aside><article className="questionCard"><p className="questionMeta">QUESTION {session.current+1} OF {session.questionIds.length} · {current.topic}</p><h2 id="question-title">{current.prompt}</h2><div className="answerList">{session.orders[current.id].map((originalIndex,displayIndex)=>{const chosen=session.answers[current.id]===originalIndex;const revealed=session.mode==="learn"&&session.answers[current.id]!==undefined;const correct=revealed&&originalIndex===current.correctIndex;const wrong=revealed&&chosen&&!correct;return <button key={originalIndex} className={`${chosen?"selected":""} ${correct?"correct":""} ${wrong?"wrong":""}`} onClick={()=>select(originalIndex)}><span>{String.fromCharCode(65+displayIndex)}</span>{current.choices[originalIndex]}</button>})}</div>{session.mode==="learn"&&session.answers[current.id]!==undefined&&<div className="explanation"><b>{session.answers[current.id]===current.correctIndex?"Correct":"Review this one"}</b><p>{current.explanation}</p><small>Source: {current.sourceReference}</small></div>}<footer className="questionFooter"><button disabled={session.current===0} onClick={()=>move(session.current-1)}>← Previous</button>{session.current===session.questionIds.length-1?<button className="submit" onClick={submit}>Submit {session.mode==="exam"?"exam":"drill"} →</button>:<button className="nextQuestion" onClick={()=>move(session.current+1)}>Next →</button>}</footer></article></div></section></section>}

      {result&&bank&&<section className="focusPanel"><section className="resultPanel"><p className="eyebrow blue">{result.mode==="exam"?"EXAM RESULTS":"LEARN RESULTS"}</p><div className={`scoreSeal ${result.passed?"passed":""}`}><strong>{percent(result)}%</strong><span>{result.passed?"PASS":"KEEP STUDYING"}</span></div><h2>{bank.tests[result.test].title}</h2><p>{result.score} of {result.total} correct · {formatTime(result.elapsed)}</p><div className="resultActions"><button className="orangeButton" onClick={()=>start(result.test,result.mode)}>Try again →</button><button onClick={()=>setResult(null)}>All practice tests</button></div>{result.questionIds.some(id=>result.answers[id]!==questionsById.get(id)?.correctIndex)&&<div className="review"><h3>Review missed questions</h3>{result.questionIds.filter(id=>result.answers[id]!==questionsById.get(id)?.correctIndex).map(id=>{const q=questionsById.get(id)!;return <article key={id}><b>{q.topic}</b><h4>{q.prompt}</h4><p><span>Correct answer:</span> {q.choices[q.correctIndex]}</p><p>{q.explanation}</p><small>Source: {q.sourceReference}</small></article>})}</div>}</section></section>}

      <footer className="appFooter"><span>Educational practice - not official DMV exam questions.</span><a href="#top">Back to top</a></footer>
    </div>
  </div></main>
}

