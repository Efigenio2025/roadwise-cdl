"use client";

import { useEffect, useState } from "react";

const steps = [
  { tag: "01", title: "Choose your class", copy: "Match Class A, B, or C to the vehicle and work you want." },
  { tag: "02", title: "Get your CLP", copy: "Study your state manual, pass knowledge tests, and receive your permit." },
  { tag: "03", title: "Practice safely", copy: "Complete required training and build behind-the-wheel confidence." },
  { tag: "04", title: "Pass the skills test", copy: "Prepare for inspection, basic control, and the road test." },
];

const endorsements = [
  { code: "T", title: "Double / Triple", icon: "Ⅱ", note: "Combination vehicle handling" },
  { code: "N", title: "Tank Vehicle", icon: "◉", note: "Liquid surge and safe control" },
  { code: "H", title: "Hazardous Materials", icon: "!", note: "Knowledge test + security check" },
  { code: "X", title: "Tank + HazMat", icon: "✦", note: "Combined N and H qualification" },
  { code: "P", title: "Passenger", icon: "●", note: "Passenger safety and procedures" },
  { code: "S", title: "School Bus", icon: "◆", note: "School bus and student safety" },
];

const questions = [
  { q: "Which CDL class generally covers combination vehicles at 26,001+ lbs when the towed unit is over 10,000 lbs?", options: ["Class A", "Class B", "Class C"], answer: 0 },
  { q: "A Commercial Learner’s Permit is commonly shortened to…", options: ["CLP", "MVR", "ELDT"], answer: 0 },
  { q: "Which endorsement combines tank vehicle and hazardous materials qualifications?", options: ["T", "X", "P"], answer: 1 },
];

export default function Home() {
  const [done, setDone] = useState<number[]>([]);
  const [quizOpen, setQuizOpen] = useState(false);
  const [question, setQuestion] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const saved = window.localStorage.getItem("roadwise-progress");
    if (saved) setDone(JSON.parse(saved));
  }, []);

  const toggleStep = (index: number) => {
    const next = done.includes(index) ? done.filter((item) => item !== index) : [...done, index];
    setDone(next);
    window.localStorage.setItem("roadwise-progress", JSON.stringify(next));
  };

  const answer = (index: number) => {
    if (selected !== null) return;
    setSelected(index);
    if (index === questions[question].answer) setScore((value) => value + 1);
  };

  const nextQuestion = () => {
    setQuestion((value) => value + 1);
    setSelected(null);
  };

  const resetQuiz = () => {
    setQuestion(0);
    setSelected(null);
    setScore(0);
  };

  return (
    <main>
      <header className="nav wrap">
        <a className="brand" href="#top" aria-label="Roadwise CDL home"><span>RW</span> ROADWISE <b>CDL</b></a>
        <nav aria-label="Main navigation"><a href="#roadmap">Roadmap</a><a href="#endorsements">Endorsements</a><a href="#quiz">Practice</a></nav>
        <button className="navButton" onClick={() => setQuizOpen(true)}>Quick quiz <span>→</span></button>
      </header>

      <section className="hero" id="top">
        <div className="wrap heroGrid">
          <div className="heroCopy">
            <p className="eyebrow">YOUR ROAD TO A COMMERCIAL LICENSE</p>
            <h1>KNOW THE ROUTE.<br /><em>OWN THE ROAD.</em></h1>
            <p className="intro">A clear, no-nonsense guide to earning your CDL and the endorsements that move your career forward.</p>
            <div className="heroActions">
              <a className="primary" href="#roadmap">Build my roadmap <span>→</span></a>
              <button className="textButton" onClick={() => setQuizOpen(true)}><span className="play">▶</span> Test what you know</button>
            </div>
            <div className="trust"><span>✓ Progress saved on this device</span><span>✓ Built around the federal CDL path</span></div>
          </div>
          <div className="signBoard" aria-label="Your CDL route at a glance">
            <div className="signTop"><span>CDL</span><small>CAREER ROUTE</small></div>
            <div className="signLine"><b>1</b><span>PERMIT</span><i>→</i></div>
            <div className="signLine"><b>2</b><span>TRAINING</span><i>→</i></div>
            <div className="signLine"><b>3</b><span>SKILLS TEST</span><i>→</i></div>
            <div className="signLine final"><b>4</b><span>LICENSED</span><i>★</i></div>
          </div>
        </div>
      </section>

      <section className="stats">
        <div className="wrap statsGrid"><div><strong>3</strong><span>CDL classes</span></div><div><strong>6+</strong><span>Endorsement paths</span></div><div><strong>4</strong><span>Core milestones</span></div><p>ONE CLEAR<br /><b>ROADMAP</b></p></div>
      </section>

      <section className="section wrap" id="roadmap">
        <div className="sectionHeading"><div><p className="eyebrow dark">THE ROADMAP</p><h2>YOUR CDL, STEP BY STEP.</h2></div><p>Start with the federal path, then use your state CDL manual for exact fees, forms, testing, and eligibility rules.</p></div>
        <div className="roadmap">
          {steps.map((step, index) => <button key={step.title} className={`step ${done.includes(index) ? "complete" : ""}`} onClick={() => toggleStep(index)} aria-pressed={done.includes(index)}><span className="stepNo">{done.includes(index) ? "✓" : step.tag}</span><span><b>{step.title}</b><small>{step.copy}</small></span><i>{done.includes(index) ? "DONE" : "MARK DONE"}</i></button>)}
        </div>
        <div className="progress"><span style={{ width: `${done.length * 25}%` }} /><b>{done.length} of 4 milestones complete</b></div>
      </section>

      <section className="endorsementSection" id="endorsements">
        <div className="wrap sectionHeading light"><div><p className="eyebrow">ADD TO YOUR LICENSE</p><h2>ENDORSEMENTS OPEN DOORS.</h2></div><p>Explore what each endorsement covers. Your state may require additional checks, training, applications, or skills testing.</p></div>
        <div className="wrap cardGrid">{endorsements.map((item) => <article className="card" key={item.code}><div className="cardIcon">{item.icon}</div><span className="code">{item.code}</span><h3>{item.title}</h3><p>{item.note}</p><button onClick={() => setQuizOpen(true)}>Practice basics <span>↗</span></button></article>)}</div>
      </section>

      <section className="callout" id="quiz">
        <div className="wrap calloutInner"><div><p className="eyebrow">READY CHECK</p><h2>THINK YOU KNOW<br />THE BASICS?</h2><p>Take a three-question warm-up. No sign-up, no pressure.</p></div><button className="primary navy" onClick={() => setQuizOpen(true)}>Start quick quiz <span>→</span></button></div>
      </section>

      <footer className="wrap"><div className="brand"><span>RW</span> ROADWISE <b>CDL</b></div><p>Educational guidance—not a replacement for your state CDL manual or licensing agency.</p><a href="#top">Back to top ↑</a></footer>

      {quizOpen && <div className="modalBackdrop" role="presentation" onMouseDown={() => setQuizOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="quiz-title" onMouseDown={(e) => e.stopPropagation()}><button className="close" onClick={() => setQuizOpen(false)} aria-label="Close quiz">×</button>{question < questions.length ? <><p className="eyebrow dark">QUESTION {question + 1} OF {questions.length}</p><h2 id="quiz-title">{questions[question].q}</h2><div className="answers">{questions[question].options.map((option, index) => <button key={option} className={selected === null ? "" : index === questions[question].answer ? "correct" : selected === index ? "wrong" : ""} onClick={() => answer(index)}>{option}</button>)}</div>{selected !== null && <button className="primary modalNext" onClick={nextQuestion}>{question === questions.length - 1 ? "See my score" : "Next question"} →</button>}</> : <div className="results"><span>{score}/{questions.length}</span><h2 id="quiz-title">Nice start.</h2><p>{score === 3 ? "You nailed the warm-up." : "Review the roadmap and try again when you’re ready."}</p><button className="primary" onClick={resetQuiz}>Try again →</button></div>}</section></div>}
    </main>
  );
}
