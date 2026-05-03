import { BehaviorTracker } from './behaviorTracker.js';
import qrcode from 'qrcode-generator';

// ─── State ─────────────────────────────────────────────────────────────────────
const tracker       = new BehaviorTracker();
let selectedContext = null;
let activeQuestions = [];
let currentQuestion = 0;
let questionStart   = 0;
let aiToneLevel     = 0;   // 0 neutral · 1 curious · 2 judgmental
let revealStarted   = false;
let lastHoveredId   = null;
let hoverTimer      = null;   // long-hover reaction timer

const randomFrom = arr => arr[Math.floor(Math.random() * arr.length)];
const cap        = s  => s.charAt(0).toUpperCase() + s.slice(1);

// ─── Contexts ──────────────────────────────────────────────────────────────────
const CONTEXTS = {
  gaming:    { label: 'Gaming Mindset',             icon: '⚔' },
  sports:    { label: 'Sports & Physical Activity', icon: '◎' },
  tech:      { label: 'Tech Thinker',               icon: '⌨' },
  emotional: { label: 'Emotional Companion',        icon: '♡' },
};

// ─── Question Sets (5 per context) ────────────────────────────────────────────
// gaming → T vs F  |  sports → J vs P  |  tech → N vs S  |  emotional → F vs T
const QUESTION_SETS = {
  gaming: [
    {
      scenario: 'Scenario 01 — Tainted Win',
      prompt: 'You win a close match, then realize your opponent\'s mic was bugged — they missed a critical call. The win stands officially. What do you do?',
      options: [
        { id: 'g1-a', label: 'Accept it — competition is competition' },
        { id: 'g1-b', label: 'Offer a rematch privately' },
        { id: 'g1-c', label: 'Report the issue, keep the result' },
        { id: 'g1-d', label: 'Say nothing, but feel uneasy about it' },
      ],
    },
    {
      scenario: 'Scenario 02 — Teammate Off-Day',
      prompt: 'Your teammate is hurting your results. They just told you they\'ve had a rough personal day. You...',
      options: [
        { id: 'g2-a', label: 'Adjust tactics to work around their performance' },
        { id: 'g2-b', label: 'Encourage them but continue playing to win' },
        { id: 'g2-c', label: 'Ask if they want to sit this one out' },
        { id: 'g2-d', label: 'Carry quietly — don\'t make it about them' },
      ],
    },
    {
      scenario: 'Scenario 03 — The Rematch',
      prompt: 'You lost to someone who gloated and trash-talked you. You face them again. Your priority?',
      options: [
        { id: 'g3-a', label: 'Win cleanly and say nothing' },
        { id: 'g3-b', label: 'Match their energy — they started it' },
        { id: 'g3-c', label: 'Outperform them, then show sportsmanship' },
        { id: 'g3-d', label: 'Focus purely on my own game regardless' },
      ],
    },
    {
      scenario: 'Scenario 04 — The Better Offer',
      prompt: 'You\'re offered a spot on a stronger team mid-tournament — but it means leaving your current team at a critical moment.',
      options: [
        { id: 'g4-a', label: 'Decline — I made a commitment' },
        { id: 'g4-b', label: 'Accept — it\'s the better opportunity' },
        { id: 'g4-c', label: 'Talk to my current team first and be honest' },
        { id: 'g4-d', label: 'Delay the decision until after this tournament' },
      ],
    },
    {
      scenario: 'Scenario 05 — Grey Zone Tactic',
      prompt: 'A teammate suggests a strategy that\'s technically legal but most players consider unsporting. It gives a real edge. Do you use it?',
      options: [
        { id: 'g5-a', label: 'Yes — if it\'s legal, it\'s fair' },
        { id: 'g5-b', label: 'No — winning this way feels hollow' },
        { id: 'g5-c', label: 'Use it once, see how it feels' },
        { id: 'g5-d', label: 'Let the team decide together' },
      ],
    },
  ],

  sports: [
    {
      scenario: 'Scenario 01 — Exhausted Morning',
      prompt: 'You\'ve committed to a 6 AM training routine. You wake up genuinely exhausted. What do you do?',
      options: [
        { id: 's1-a', label: 'Push through — consistency is how progress is made' },
        { id: 's1-b', label: 'Skip today and adjust this week\'s plan' },
        { id: 's1-c', label: 'Do a lighter version — something beats nothing' },
        { id: 's1-d', label: 'Decide after 10 minutes how the body feels' },
      ],
    },
    {
      scenario: 'Scenario 02 — Spontaneous Game',
      prompt: 'You had a planned solo workout. A group is starting a pickup game right now. You...',
      options: [
        { id: 's2-a', label: 'Stick to my plan — I made a commitment to myself' },
        { id: 's2-b', label: 'Join the game — social activity counts too' },
        { id: 's2-c', label: 'Finish my workout first, then join if still going' },
        { id: 's2-d', label: 'Skip both — now I\'m indecisive and annoyed' },
      ],
    },
    {
      scenario: 'Scenario 03 — Race Mid-Point',
      prompt: 'You\'re deep into a long run and your planned pace is no longer sustainable. You...',
      options: [
        { id: 's3-a', label: 'Slow down — finishing the session is what matters' },
        { id: 's3-b', label: 'Push through to the original target — mental toughness' },
        { id: 's3-c', label: 'Stop, reassess, and adjust the remaining plan' },
        { id: 's3-d', label: 'Drop targets, let the body guide the rest' },
      ],
    },
    {
      scenario: 'Scenario 04 — Competition Prep',
      prompt: 'You have a competition in four weeks. How do you prepare?',
      options: [
        { id: 's4-a', label: 'Build a day-by-day training plan and follow it strictly' },
        { id: 's4-b', label: 'Set a general goal and train based on how I feel' },
        { id: 's4-c', label: 'Copy a structured program from a trusted source' },
        { id: 's4-d', label: 'Alternate intense weeks with flexible recovery weeks' },
      ],
    },
    {
      scenario: 'Scenario 05 — Unfinished Session',
      prompt: 'You finish a workout but feel you didn\'t hit your targets. It\'s late and you have work tomorrow. What do you do?',
      options: [
        { id: 's5-a', label: 'Log it, accept it, plan tomorrow accordingly' },
        { id: 's5-b', label: 'Do a short extra set — I can\'t leave incomplete' },
        { id: 's5-c', label: 'Reassess my targets — maybe they\'re too ambitious' },
        { id: 's5-d', label: 'Let it go — one session doesn\'t define progress' },
      ],
    },
  ],

  tech: [
    {
      scenario: 'Scenario 01 — "Feels Slow"',
      prompt: 'A user reports your app "feels slow" but all performance metrics look normal. You...',
      options: [
        { id: 't1-a', label: 'Trust the metrics — if data is fine, it\'s perception' },
        { id: 't1-b', label: 'Investigate further — user feel often reveals what metrics miss' },
        { id: 't1-c', label: 'Run deeper profiling to get concrete numbers first' },
        { id: 't1-d', label: 'Ask the user for a specific reproducible case' },
      ],
    },
    {
      scenario: 'Scenario 02 — The Vague Ask',
      prompt: 'A stakeholder asks: "Can we add AI-powered recommendations?" You don\'t know the scope yet. Your response?',
      options: [
        { id: 't2-a', label: 'Ask a series of clarifying questions before committing' },
        { id: 't2-b', label: 'Give a rough estimate based on gut read of the complexity' },
        { id: 't2-c', label: 'Explain the key unknowns that need resolving first' },
        { id: 't2-d', label: 'Break it into phases and estimate each one separately' },
      ],
    },
    {
      scenario: 'Scenario 03 — New Codebase',
      prompt: 'You\'re dropped into an unfamiliar codebase and need to understand it quickly. You...',
      options: [
        { id: 't3-a', label: 'Start at the entry point and trace execution flow' },
        { id: 't3-b', label: 'Find the architecture diagram or README overview first' },
        { id: 't3-c', label: 'Identify the core domain model and understand its shape' },
        { id: 't3-d', label: 'Read recent commits to see what\'s been actively changing' },
      ],
    },
    {
      scenario: 'Scenario 04 — Requirement: "More Human"',
      prompt: 'Product sends a one-liner: "Make the onboarding feel more human." No further detail. You...',
      options: [
        { id: 't4-a', label: 'Ask for specific, measurable criteria before starting' },
        { id: 't4-b', label: 'Prototype a few ideas based on intuition' },
        { id: 't4-c', label: 'Research patterns from similar successful products' },
        { id: 't4-d', label: 'Propose a user research session before building anything' },
      ],
    },
    {
      scenario: 'Scenario 05 — New Framework, One Week',
      prompt: 'You need to get productive in a framework you\'ve never used — in one week. Your approach?',
      options: [
        { id: 't5-a', label: 'Follow the official tutorial step by step' },
        { id: 't5-b', label: 'Build something real immediately and learn by doing' },
        { id: 't5-c', label: 'Scan the docs for core concepts, then build' },
        { id: 't5-d', label: 'Find someone who knows it and pair with them' },
      ],
    },
  ],

  emotional: [
    {
      scenario: 'Scenario 01 — Distance',
      prompt: 'A close friend suddenly goes quiet and seems to be avoiding you. No explanation. You...',
      options: [
        { id: 'e1-a', label: 'Send a direct message asking what\'s wrong' },
        { id: 'e1-b', label: 'Give them space and wait' },
        { id: 'e1-c', label: 'Ask a mutual friend what happened' },
        { id: 'e1-d', label: 'Assume the worst and pull back too' },
      ],
    },
    {
      scenario: 'Scenario 02 — Criticism',
      prompt: 'You receive harsh but accurate criticism about your work, delivered bluntly. Your reaction?',
      options: [
        { id: 'e2-a', label: 'Defend yourself — the delivery was unfair' },
        { id: 'e2-b', label: 'Accept it and start improving immediately' },
        { id: 'e2-c', label: 'Feel hurt inside, but show nothing' },
        { id: 'e2-d', label: 'Withdraw and process it alone first' },
      ],
    },
    {
      scenario: 'Scenario 03 — Overwhelm',
      prompt: 'You\'re in an important meeting and suddenly feel overwhelmed and unable to focus.',
      options: [
        { id: 'e3-a', label: 'Power through — show nothing' },
        { id: 'e3-b', label: 'Step out briefly to compose yourself' },
        { id: 'e3-c', label: 'Admit openly that you need a moment' },
        { id: 'e3-d', label: 'Channel the feeling into sharp focus' },
      ],
    },
    {
      scenario: 'Scenario 04 — Betrayal',
      prompt: 'Someone you trusted deeply shares your private secret without consent. You...',
      options: [
        { id: 'e4-a', label: 'Confront them directly and immediately' },
        { id: 'e4-b', label: 'Cut them off silently, no explanation' },
        { id: 'e4-c', label: 'Try to understand why they did it' },
        { id: 'e4-d', label: 'Forgive eventually, but never fully trust again' },
      ],
    },
    {
      scenario: 'Scenario 05 — Contentment',
      prompt: 'You feel genuinely, deeply content. What does that state look like in your life?',
      options: [
        { id: 'e5-a', label: 'I\'m surrounded by people I love' },
        { id: 'e5-b', label: 'I\'m alone doing what I truly enjoy' },
        { id: 'e5-c', label: 'I\'ve just accomplished something meaningful' },
        { id: 'e5-d', label: 'I feel completely understood by someone' },
      ],
    },
  ],
};

// ─── AI Response Generator (rule-based) ───────────────────────────────────────
function generateAIResponse(events, stats, ctx) {
  const { phase, decisionMs, qIndex = 0 } = ctx;

  if (phase === 'idle')    return 'Choose your context.\n\nI am already watching.';

  if (phase === 'ctx-hover') return 'You\'re considering this.\n\nEvery hesitation is recorded.';

  if (phase === 'ctx-selected') return 'Context noted.\n\nMy observation begins.';

  if (phase === 'hovering') {
    const recentHovers = events.filter(e => e.type === 'hover').slice(-4);
    const longHover    = recentHovers.some(e => e.metadata.duration > 2000);
    const revisiting   = recentHovers.length >= 3;
    if (longHover)   return 'You are hesitating.\n\nSomething about that option holds your attention.';
    if (revisiting)  return 'You keep returning to the same choices.\n\nYou\'re not sure, are you?';
    return 'You\'re scanning the options.\n\nI notice the order in which you look.';
  }

  if (phase === 'after-decision') {
    if (decisionMs < 600)  return 'That was fast.\n\nToo fast to have genuinely considered the alternatives.';
    if (decisionMs > 3000) return `${(decisionMs / 1000).toFixed(1)} seconds of deliberation.\n\nNot what one would call instinctive.`;
    if (stats.hesitationCount > 1) return 'You hovered over several options before committing.\n\nThat pattern is not random.';
    return 'Choice logged.\n\nThe interesting part isn\'t what you chose — it\'s how long it took.';
  }

  if (phase === 'between') {
    // Gentle for Q4 onward
    if (qIndex >= 3) return randomFrom([
      'Take your time with this one.\n\nThere is no right answer here.',
      'No right answer here.\n\nOnly patterns.',
      'Almost there.\n\nTake your time.',
    ]);
    return randomFrom([
      'One response tells me little.\n\nBut the way you responded tells me considerably more.',
      'The data is accumulating.\n\nYou may not like what it says.',
    ]);
  }

  if (phase === 'pre-reveal') return 'I have enough now.\n\nYou should see what I found.';

  return 'Processing...';
}

// ─── DOM Builder ──────────────────────────────────────────────────────────────
function buildLayout() {
  document.body.innerHTML = `
    <div id="app">

      <div id="left-panel">
        <div id="ai-status">
          <div id="ai-avatar-wrap">
            <div class="ai-eye cute" id="ai-eye">◕</div>
            <div id="ai-tone" class="tone-neutral">● NEUTRAL</div>
          </div>
          <div id="ai-text">Choose your context.

I am already watching.</div>
        </div>
      </div>

      <div id="center-panel">

        <div id="context-screen">
          <div id="ctx-heading">Choose a context where you want to be observed</div>
          <div id="ctx-sub">The scenarios will match your choice.<br>My observation will not change.</div>
          <div id="ctx-grid"></div>
        </div>

        <div id="question-card" style="display:none;opacity:0;">
          <div id="scenario-text"></div>
          <div id="prompt-text"></div>
          <div id="options-grid"></div>
          <div id="progress-dots"></div>
        </div>

        <div id="reveal-panel">
          <div class="reveal-line" id="rl-0"></div>
          <div class="reveal-line" id="rl-1"></div>
          <div class="reveal-line" id="rl-2"></div>
          <div id="evidence-section"></div>
          <div class="stats-grid"       id="stats-grid"></div>
          <div class="analysis-section" id="analysis-section"></div>
          <div id="radar-section"></div>
          <div class="personality-card" id="personality-card"></div>
          <div id="summary-card"></div>
          <div class="reflection-card"  id="reflection-card"></div>
          <div id="download-wrap"><button id="download-btn">↓ Download Report</button></div>
        </div>

      </div>

    </div>
  `;
}

// ─── Context Screen ───────────────────────────────────────────────────────────
function renderContextScreen() {
  const grid = document.getElementById('ctx-grid');
  Object.entries(CONTEXTS).forEach(([key, ctx]) => {
    const btn = document.createElement('button');
    btn.className = 'ctx-btn';
    btn.innerHTML = `<span class="ctx-icon">${ctx.icon}</span><span class="ctx-label-text">${ctx.label}</span>`;

    btn.addEventListener('mouseenter', () => {
      tracker.hoverStart(`ctx-${key}`);
      setAIText(generateAIResponse(tracker.events, tracker.getStats(), { phase: 'ctx-hover' }), 0);
    });
    btn.addEventListener('mouseleave', () => {
      tracker.hoverEnd(`ctx-${key}`, ctx.label);
    });
    btn.addEventListener('click', () => selectContext(key));
    grid.appendChild(btn);
  });

  // QR code pointing to current URL
  try {
    const qr = qrcode(0, 'M');
    qr.addData(window.location.href);
    qr.make();
    const qrWrap = document.createElement('div');
    qrWrap.id = 'qr-section';
    qrWrap.innerHTML = `
      <div class="qr-label">Scan to experience on your phone</div>
      ${qr.createSvgTag(3, 0)}
    `;
    document.getElementById('context-screen').appendChild(qrWrap);
  } catch (_) { /* QR generation failed silently */ }
}

function selectContext(key) {
  selectedContext = key;
  activeQuestions = QUESTION_SETS[key];

  setAIText(generateAIResponse([], {}, { phase: 'ctx-selected' }), 1);

  // Switch avatar from cute to observing
  const eye = document.getElementById('ai-eye');
  eye.textContent = '◉';
  eye.classList.remove('cute');

  const screen = document.getElementById('context-screen');
  screen.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
  screen.style.opacity    = '0';
  screen.style.transform  = 'translateY(-10px)';

  setTimeout(() => {
    screen.style.display = 'none';
    const card = document.getElementById('question-card');
    card.style.display = 'block';

    // Build 5 progress dots
    document.getElementById('progress-dots').innerHTML = activeQuestions
      .map((_, i) => `<div class="dot${i === 0 ? ' active' : ''}" id="dot-${i}"></div>`)
      .join('');

    renderQuestion(0);
  }, 450);
}

// ─── Render Question ──────────────────────────────────────────────────────────
function renderQuestion(index) {
  const q    = activeQuestions[index];
  const card = document.getElementById('question-card');

  activeQuestions.forEach((_, i) => {
    const dot = document.getElementById(`dot-${i}`);
    if (dot) dot.className = 'dot' + (i === index ? ' active' : i < index ? ' done' : '');
  });

  card.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
  card.style.opacity    = '0';
  card.style.transform  = 'translateY(10px)';

  setTimeout(() => {
    document.getElementById('scenario-text').textContent = q.scenario;
    document.getElementById('prompt-text').textContent   = q.prompt;

    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className     = 'option-btn';
      btn.textContent   = opt.label;
      btn.dataset.id    = opt.id;
      btn.dataset.label = opt.label;
      btn.addEventListener('mouseenter', () => { tracker.hoverStart(opt.id); onHover(opt); });
      btn.addEventListener('mouseleave', () => {
        tracker.hoverEnd(opt.id, opt.label);
      });
      btn.addEventListener('click', () => { if (!btn.classList.contains('disabled')) onChoice(opt, index); });
      grid.appendChild(btn);
    });

    card.style.opacity   = '1';
    card.style.transform = 'translateY(0)';
    questionStart        = Date.now();
    lastHoveredId        = null;
  }, 260);
}

// ─── Interaction Handlers ─────────────────────────────────────────────────────
function onHover(opt) {
  // Cancel any pending long-hover reaction
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }

  const isRevisit = lastHoveredId !== null && opt.id !== lastHoveredId;
  lastHoveredId = opt.id;

  const recentHovers = tracker.events.filter(e => e.type === 'hover').length;

  // Occasional instant reaction — not every hover
  if (isRevisit && recentHovers % 3 === 0) {
    setAIText('You\'re exploring multiple options.\nI notice the order in which you look.', 1);
  } else if (!isRevisit) {
    setAIText(generateAIResponse(tracker.events, tracker.getStats(), { phase: 'hovering' }), 1);
  }

  // Long-hover reaction after 2.5s on the same option
  hoverTimer = setTimeout(() => {
    hoverTimer = null;
    setAIText('You\'re taking your time here…\nSomething about this option holds your attention.', 1);
  }, 2500);
}

function onChoice(opt, qIndex) {
  // Cancel pending long-hover timer
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }

  const decisionMs = Date.now() - questionStart;
  tracker.recordDecision(opt.label, decisionMs);

  document.querySelectorAll('.option-btn').forEach(b => {
    b.classList.add('disabled');
    if (b.dataset.id === opt.id) b.classList.add('selected');
  });

  const stats = tracker.getStats();
  // Fast-click reaction
  let afterText, tone;
  if (decisionMs < 500) {
    afterText = 'That was quick.\nYou didn\'t need to deliberate.';
    tone = 2;
  } else if (decisionMs > 4500) {
    afterText = `${(decisionMs / 1000).toFixed(1)} seconds.\nSomething about this one made you pause.`;
    tone = 1;
  } else {
    afterText = generateAIResponse(tracker.events, stats, { phase: 'after-decision', decisionMs });
    tone = decisionMs < 600 || stats.hesitationCount > 1 ? 2 : 1;
  }
  setAIText(afterText, tone);

  if (qIndex < activeQuestions.length - 1) {
    setTimeout(() => {
      currentQuestion++;
      // gentle tone for later questions — don't escalate further
      const betweenText = generateAIResponse(tracker.events, stats, { phase: 'between', qIndex: currentQuestion });
      setAIText(betweenText, qIndex >= 2 ? 0 : 1);
      renderQuestion(currentQuestion);
    }, 2200);
  } else {
    setTimeout(() => setAIText(generateAIResponse(tracker.events, stats, { phase: 'pre-reveal' }), 2), 1200);
    setTimeout(triggerReveal, 4000);
  }
}

// ─── AI Panel ─────────────────────────────────────────────────────────────────
function setAIText(text, tone = 0) {
  const el     = document.getElementById('ai-text');
  const toneEl = document.getElementById('ai-tone');
  const eyeEl  = document.getElementById('ai-eye');

  el.style.opacity = '0';
  setTimeout(() => { el.textContent = text; el.style.opacity = '1'; }, 220);

  if (tone > aiToneLevel) aiToneLevel = tone;

  if (aiToneLevel >= 2) {
    toneEl.className = 'tone-judgmental'; toneEl.textContent = '● JUDGMENTAL';
    if (!eyeEl.classList.contains('serious')) { eyeEl.style.color = '#ff4a6a'; eyeEl.style.animationDuration = '0.7s'; }
  } else if (aiToneLevel >= 1) {
    toneEl.className = 'tone-curious'; toneEl.textContent = '● CURIOUS';
    eyeEl.style.color = '#f0a030'; eyeEl.style.animationDuration = '1.3s';
  }
}

// ─── Reveal Helpers ───────────────────────────────────────────────────────────
function buildInsights(stats) {
  const s     = stats;
  const total = Math.max(1, s.decisions.length);
  const hesRate       = Math.round((s.slowDecisions / total) * 100);
  const totalHoverEvt = Object.values(s.hoverFreq).reduce((sum, n) => sum + n, 0);
  const avgHoversPerQ = (totalHoverEvt / total).toFixed(1);

  const items = [
    {
      label: 'Average Decision Time',
      value: `${(s.avgDecisionMs / 1000).toFixed(1)}s`,
      note: s.avgDecisionMs < 800
        ? 'You made most decisions quickly. This suggests instinctive processing — you trusted your first impulse.'
        : s.avgDecisionMs > 2500
        ? 'You deliberated significantly before choosing. This indicates careful internal evaluation before action.'
        : 'Your decision pace was measured — neither impulsive nor paralyzed. A balance of thought and action.',
    },
    {
      label: 'Hesitation Rate',
      value: `${hesRate}% of decisions`,
      note: hesRate > 60
        ? 'You paused before most decisions, suggesting careful evaluation and internal processing before committing.'
        : hesRate > 30
        ? 'You hesitated on some decisions — moments where your instinct and reasoning came into conflict.'
        : 'Minimal hesitation detected. You committed without visible internal conflict.',
    },
    {
      label: 'Hover Frequency',
      value: `${avgHoversPerQ}× per question`,
      note: parseFloat(avgHoversPerQ) > 2.5
        ? 'High hover frequency — you explored multiple options before committing. Thorough, deliberate evaluation style.'
        : parseFloat(avgHoversPerQ) > 1.2
        ? 'Moderate option exploration — balanced between evaluation and decisiveness.'
        : 'Low hover frequency — you navigated options directly, suggesting high decision confidence.',
    },
    {
      label: 'Reconsideration Count',
      value: `${s.maxRevisits}× max revisits on one option`,
      note: s.maxRevisits >= 3
        ? 'Returning to the same option multiple times often signals emotional pull conflicting with rational preference.'
        : s.maxRevisits >= 2
        ? 'Occasional revisiting suggests mild uncertainty or a double-checking habit.'
        : 'Minimal revisiting — you moved through options in a relatively direct, confident path.',
    },
    {
      label: 'Total Exploration Time',
      value: `${(s.totalHoverMs / 1000).toFixed(1)}s hovering`,
      note: s.totalHoverMs > 6000
        ? 'Extended hover time suggests you weighed options deliberately, sensitive to the weight of each choice.'
        : s.totalHoverMs > 2000
        ? 'Moderate hover patterns indicate considered but efficient evaluation.'
        : 'Minimal hover time — you moved through options without much lingering.',
    },
  ];

  return `
    <div class="analysis-header">BEHAVIOR METRICS</div>
    ${items.map(item => `
      <div class="analysis-item">
        <div class="analysis-top">
          <span class="analysis-label">${item.label}</span>
          <span class="analysis-value">${item.value}</span>
        </div>
        <div class="analysis-note">${item.note}</div>
      </div>
    `).join('')}
  `;
}

function buildMBTICard(p, scores) {
  const { ie, ns, tf, jp } = scores;

  // Balance bar: score 0→1 means lo→hi; fill represents "how far toward hi"
  const bar = (score, loLabel, hiLabel, dominant) => {
    const fillPct = Math.round(score * 100);
    return `
      <div class="dim-row">
        <span class="dim-pole ${dominant === loLabel ? 'dim-active' : ''}">${loLabel}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${fillPct}%"></div></div>
        <span class="dim-pole ${dominant === hiLabel ? 'dim-active' : ''}">${hiLabel}</span>
      </div>`;
  };

  const dims = [
    { barHTML: bar(ie, 'I', 'E', p.ie), dim: `${p.ie} — ${p.ie === 'I' ? 'Introvert' : 'Extrovert'}`, reason: p.ieReason },
    { barHTML: bar(ns, 'N', 'S', p.ns), dim: `${p.ns} — ${p.ns === 'N' ? 'Intuitive' : 'Sensing'}`,   reason: p.nsReason },
    { barHTML: bar(tf, 'T', 'F', p.tf), dim: `${p.tf} — ${p.tf === 'T' ? 'Thinking'  : 'Feeling'}`,   reason: p.tfReason },
    { barHTML: bar(jp, 'J', 'P', p.jp), dim: `${p.jp} — ${p.jp === 'J' ? 'Judging'   : 'Perceiving'}`,reason: p.jpReason },
  ];

  return `
    <div class="analysis-header">MBTI INFERENCE — <span class="mbti-result">${p.mbti}</span></div>
    <div class="dim-bars">${dims.map(d => d.barHTML).join('')}</div>
    ${dims.map(d => `
      <div class="analysis-item">
        <div class="analysis-top"><span class="analysis-label">${d.dim}</span></div>
        <div class="analysis-note">${d.reason}</div>
      </div>
    `).join('')}
    <div class="mbti-disclaimer">Based on behavioral patterns only. Not a clinical assessment.</div>
  `;
}

// ─── Scores & Visualization ───────────────────────────────────────────────────
function computeScores(stats) {
  const total = Math.max(1, stats.decisions.length);
  // IE: 0 = fully I, 1 = fully E
  const ie = Math.min(1, Math.max(0,
    (stats.fastDecisions / total) * 0.6 +
    (1 - Math.min(1, stats.hesitationCount / total)) * 0.4
  ));
  // NS: 0 = fully N (pattern-seeker), 1 = fully S (concrete)
  const ns = Math.min(1, Math.max(0, 1 - Math.min(1, stats.maxRevisits / 5)));
  // TF: 0 = fully T (low hover), 1 = fully F (high hover)
  const tf = Math.min(1, Math.max(0, (stats.totalHoverMs / total) / 4000));
  // JP: 0 = fully J (consistent timing), 1 = fully P (variable)
  const times   = stats.decisions.map(d => d.metadata.timeMs);
  const variance = times.length > 1
    ? Math.sqrt(times.reduce((a, t) => a + Math.pow(t - stats.avgDecisionMs, 2), 0) / times.length)
    : 500;
  const jp = Math.min(1, Math.max(0, variance / 3000));
  return { ie, ns, tf, jp };
}

function buildRadarSVG(scores) {
  const { ie, ns, tf, jp } = scores;
  const cx = 130, cy = 130, r = 90;

  // 4 axes: top=IE(E-end), right=NS(S-end), bottom=TF(F-end), left=JP(P-end)
  const axes = [
    { angle: -90, score: ie, hi: 'E', lo: 'I' },
    { angle:   0, score: ns, hi: 'S', lo: 'N' },
    { angle:  90, score: tf, hi: 'F', lo: 'T' },
    { angle: 180, score: jp, hi: 'P', lo: 'J' },
  ];
  const pt = (ang, dist) => {
    const rad = ang * Math.PI / 180;
    return [cx + Math.cos(rad) * dist, cy + Math.sin(rad) * dist];
  };
  const poly = pts => pts.map(([x, y]) => `${x},${y}`).join(' ');

  const rings = [0.3, 0.6, 1.0].map(f => {
    const pts = poly(axes.map(a => pt(a.angle, r * f)));
    return `<polygon points="${pts}" fill="none" stroke="#1e2a3a" stroke-width="${f === 1 ? 1.2 : 0.6}" stroke-dasharray="${f < 1 ? '4 3' : ''}"/>`;
  }).join('');

  const axLines = axes.map(a => {
    const [x2, y2] = pt(a.angle, r);
    return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#1e2a3a" stroke-width="0.8"/>`;
  }).join('');

  const userPts = poly(axes.map(a => pt(a.angle, r * Math.max(0.05, a.score))));
  const userPoly = `<polygon points="${userPts}" fill="rgba(58,143,232,0.15)" stroke="#3a8fe8" stroke-width="2" stroke-linejoin="round"/>`;

  const dots = axes.map(a => {
    const [x, y] = pt(a.angle, r * Math.max(0.05, a.score));
    return `<circle cx="${x}" cy="${y}" r="4" fill="#3a8fe8" stroke="#07070f" stroke-width="1.5"/>`;
  }).join('');

  const labels = axes.map(a => {
    const [hx, hy] = pt(a.angle, r + 20);
    const [lx, ly] = pt(a.angle, 22);
    return `<text x="${hx}" y="${hy}" text-anchor="middle" dominant-baseline="middle" fill="#d4b84a" font-size="13" font-weight="bold" font-family="monospace">${a.hi}</text>
<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="#3a4a5a" font-size="10" font-family="monospace">${a.lo}</text>`;
  }).join('');

  return `
    <div class="radar-wrap">
      <svg width="260" height="260" viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
        ${rings}${axLines}${userPoly}${dots}${labels}
      </svg>
      <div class="radar-legend">Axis tips = dominant tendency &nbsp;·&nbsp; Inner labels = opposite pole</div>
    </div>`;
}

function buildSummaryCard(personality, stats) {
  const styleDesc = {
    impulsive:  'You are a decisive and action-oriented thinker.',
    analytical: 'You are a reflective and exploratory thinker.',
    emotional:  'You are a sensitive and emotionally-aware thinker.',
    balanced:   'You are a balanced and adaptable thinker.',
  };
  const riskDesc = {
    'risk-tolerant': 'You lean into uncertainty and move quickly.',
    'risk-averse':   'You evaluate before acting, preferring caution over speed.',
    'uncertain':     'Your relationship with risk is complex and situational.',
    'risk-neutral':  'You weigh risk without strong bias in either direction.',
  };
  const procDesc = personality.ie === 'I'
    ? 'Internal processing guides your decisions.'
    : 'You act more on instinct and external cues.';
  const flexDesc = personality.jp === 'P'
    ? 'You prefer flexibility over rigid structure.'
    : 'You prefer consistent, structured approaches.';

  return `
    <div class="analysis-header" style="margin-bottom:0.8rem">BEHAVIORAL SUMMARY</div>
    <div class="summary-text">${styleDesc[personality.style]} ${riskDesc[personality.risk]} ${procDesc} ${flexDesc}</div>
  `;
}

function showRevealLine(id, text, extraClass, delay) {
  setTimeout(() => {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className   = `reveal-line ${extraClass}`.trim();
    void el.offsetWidth;
    el.classList.add('shown');
  }, delay);
}

// ─── Report Export ────────────────────────────────────────────────────────────
function buildReportText(personality, stats) {
  const s = stats;
  const line = '─'.repeat(43);
  const rows = [
    '═'.repeat(43),
    '  PERSONAL MIRROR — BEHAVIORAL REPORT',
    '═'.repeat(43),
    '',
    `MBTI TENDENCY : ${personality.mbti}`,
    `Decision Style: ${cap(personality.style)}`,
    `Risk Profile  : ${cap(personality.risk)}`,
    '',
    line,
    ' BEHAVIOR METRICS',
    line,
    `Total Clicks       ${s.totalClicks}`,
    `Total Hover Time   ${(s.totalHoverMs / 1000).toFixed(1)}s`,
    `Avg Decision Time  ${(s.avgDecisionMs / 1000).toFixed(1)}s`,
    `Hesitation Count   ${s.hesitationCount}`,
    `Max Revisits       ${s.maxRevisits}×`,
    `Fast Decisions     ${s.fastDecisions}`,
    `Slow Decisions     ${s.slowDecisions}`,
    '',
    line,
    ' DIMENSION ANALYSIS',
    line,
    `${personality.ie} — ${personality.ie === 'I' ? 'Introvert' : 'Extrovert'}`,
    personality.ieReason,
    '',
    `${personality.ns} — ${personality.ns === 'N' ? 'Intuitive' : 'Sensing'}`,
    personality.nsReason,
    '',
    `${personality.tf} — ${personality.tf === 'T' ? 'Thinking' : 'Feeling'}`,
    personality.tfReason,
    '',
    `${personality.jp} — ${personality.jp === 'J' ? 'Judging' : 'Perceiving'}`,
    personality.jpReason,
    '',
    line,
    ' SUMMARY',
    line,
  ];

  // Inline summary text (reuse logic from buildSummaryCard)
  const styleDesc = { impulsive: 'Decisive and action-oriented.', analytical: 'Reflective and exploratory.', emotional: 'Sensitive and emotionally aware.', balanced: 'Balanced and adaptable.' };
  const riskDesc  = { 'risk-tolerant': 'Leans into uncertainty and moves quickly.', 'risk-averse': 'Evaluates before acting, preferring caution.', 'uncertain': 'Complex, situational relationship with risk.', 'risk-neutral': 'Weighs risk without strong bias.' };
  rows.push(
    `${styleDesc[personality.style]} ${riskDesc[personality.risk]}`,
    `${personality.ie === 'I' ? 'Internal processing guides decisions.' : 'Acts on instinct and external cues.'}`,
    `${personality.jp === 'P' ? 'Prefers flexibility over rigid structure.' : 'Prefers consistent, structured approaches.'}`,
    '',
    '═'.repeat(43),
    '"The way you decide reveals more than what you decide."',
    '═'.repeat(43),
    '',
    `Generated: ${new Date().toLocaleString()}`,
  );
  return rows.join('\n');
}

function downloadReport(personality, stats) {
  const text = buildReportText(personality, stats);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'personality-report.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Evidence Log Builder ─────────────────────────────────────────────────────
function buildEvidence(events, stats) {
  const sessionStart = events.length > 0 ? events[0].timestamp : Date.now();
  const relTime = ts => {
    const s = Math.round((ts - sessionStart) / 1000);
    return `+${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const entries = [];

  // First hover
  const firstHover = events.find(e => e.type === 'hover');
  if (firstHover) {
    entries.push({ ts: firstHover.timestamp, text: `First hover: "${firstHover.metadata.label}" — ${firstHover.metadata.duration}ms` });
  }

  // All decisions with timing flags
  events.filter(e => e.type === 'decision').forEach(e => {
    const flag = e.metadata.timeMs < 600 ? ' · instant' : e.metadata.timeMs > 3000 ? ' · prolonged' : '';
    entries.push({ ts: e.timestamp, text: `Chose: "${e.metadata.label}" — ${e.metadata.timeMs}ms${flag}` });
  });

  // Hesitation moments
  events.filter(e => e.type === 'hover' && e.metadata.duration > 1500).forEach(e => {
    entries.push({ ts: e.timestamp, text: `Hesitation on "${e.metadata.label}" — ${e.metadata.duration}ms` });
  });

  // Revisited options
  Object.entries(stats.hoverFreq).filter(([, n]) => n >= 2).forEach(([id]) => {
    const related = events.filter(e => e.type === 'hover' && e.metadata.id === id);
    if (related.length >= 2) {
      entries.push({
        ts: related[related.length - 1].timestamp,
        text: `Revisited "${related[0].metadata.label}" ${related.length}× — uncertainty signal`,
      });
    }
  });

  entries.sort((a, b) => a.ts - b.ts);

  // Deduplicate consecutive identical text
  const rows = entries.filter((e, i) => i === 0 || e.text !== entries[i - 1].text);

  return `
    <div class="analysis-header">OBSERVATION LOG <span class="ev-expose">— I logged everything.</span></div>
    <div class="evidence-list">
      ${rows.map(e => `
        <div class="ev-row">
          <span class="ev-time">${relTime(e.ts)}</span>
          <span class="ev-text">${e.text}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ─── REVEAL SEQUENCE ──────────────────────────────────────────────────────────
function triggerReveal() {
  if (revealStarted) return;
  revealStarted = true;

  const stats       = tracker.getStats();
  const personality = tracker.inferPersonality();
  const card        = document.getElementById('question-card');
  const revealPanel = document.getElementById('reveal-panel');

  // Darken the entire UI
  document.getElementById('app').classList.add('revealing');

  // Switch avatar to serious mode
  const eye = document.getElementById('ai-eye');
  eye.textContent = '◈';
  eye.classList.add('serious');
  eye.style.removeProperty('color');
  eye.style.removeProperty('animation-duration');

  card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  card.style.opacity    = '0';
  card.style.transform  = 'translateY(-12px)';

  setAIText('You thought I was analyzing\nyour answers.', 2);

  setTimeout(() => {
    card.style.display        = 'none';
    revealPanel.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => revealPanel.classList.add('visible')));

    showRevealLine('rl-0', 'You thought I was analyzing your answers.', '',          200);

    setTimeout(() => setAIText('But I was analyzing\nyour behavior.', 2), 1800);

    showRevealLine('rl-1', 'But I was analyzing your behavior.',          'highlight', 2200);
    showRevealLine('rl-2', 'Here is what I found.',                       'key',       3600);

    const scores = computeScores(stats);

    // Evidence log — sudden exposure of hidden observation
    setTimeout(() => {
      const ev = document.getElementById('evidence-section');
      ev.innerHTML = buildEvidence(tracker.events, stats);
      ev.classList.add('shown');
      setAIText('I logged everything.\n\nEvery hesitation. Every revisit.', 2);
    }, 4200);

    // Quick stats snapshot
    setTimeout(() => {
      document.getElementById('stats-grid').innerHTML = [
        ['Total Clicks', stats.totalClicks],
        ['Hover Time',   `${(stats.totalHoverMs / 1000).toFixed(1)}s`],
        ['Avg Decision', `${(stats.avgDecisionMs / 1000).toFixed(1)}s`],
        ['Hesitations',  stats.hesitationCount],
      ].map(([l, v]) => `<div class="stat-item"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`).join('');
      document.getElementById('stats-grid').classList.add('shown');
    }, 5600);

    // Detailed behavior metrics
    setTimeout(() => {
      const s = document.getElementById('analysis-section');
      s.innerHTML = buildInsights(stats);
      s.classList.add('shown');
    }, 6600);

    // Radar chart
    setTimeout(() => {
      const rs = document.getElementById('radar-section');
      rs.innerHTML = buildRadarSVG(scores);
      rs.classList.add('shown');
    }, 7800);

    // MBTI breakdown with balance bars
    setTimeout(() => {
      const pCard = document.getElementById('personality-card');
      pCard.innerHTML = buildMBTICard(personality, scores);
      pCard.classList.add('shown');
      setAIText(`${cap(personality.style)} decision-making.\n${cap(personality.risk)}.\n\n${personality.mbti}.`, 2);
    }, 9000);

    // Behavioral summary
    setTimeout(() => {
      const sc = document.getElementById('summary-card');
      sc.innerHTML = buildSummaryCard(personality, stats);
      sc.classList.add('shown');
    }, 10400);

    // Final reflection
    setTimeout(() => {
      const rCard = document.getElementById('reflection-card');
      rCard.innerHTML = `<div class="reflection-text">"The way you decide reveals more than what you decide."</div>`;
      rCard.classList.add('shown');
      setAIText('The mirror shows what was always there.\n\nNow you know what I see.', 2);
    }, 11400);

    // Download button
    setTimeout(() => {
      const wrap = document.getElementById('download-wrap');
      wrap.classList.add('shown');
      document.getElementById('download-btn').addEventListener('click', () => {
        downloadReport(personality, stats);
      });
    }, 12600);

  }, 600);
}

// ─── Boot ──────────────────────────────────────────────────────────────────────
buildLayout();
tracker.startTracking();
renderContextScreen();
