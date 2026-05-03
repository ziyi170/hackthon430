const express = require("express");
const crypto = require("crypto");

const app = express();
const port = 3000;

const SESSION_DURATION_SECONDS = 300;
const CONTENTS_PER_TYPE = 14;
const MAX_EVENTS_PER_SESSION = 5000;
const INITIAL_FEED_SIZE = 6;
const FEED_SIZE = 16;
const TAVILY_MAX_RESULTS = 10;
const DISPLAY_RESULTS_COUNT = 5;

app.use(express.json({ limit: "512kb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

const topicWorlds = [
  { id: "future-tech", title: "How Is Future Tech Rewriting Daily Life?", seed: "Future Technology" },
  { id: "emotion-story", title: "Why Do Emotional Stories Shape Big Decisions?", seed: "Emotion and Life" },
  { id: "business-logic", title: "What Actually Builds a Strong Business Edge?", seed: "Business Logic" },
];

const PRESET_TOPIC_SOURCES = {
  "future-tech": [
    {
      id: "future-tech-yt-1",
      type: "knowledge",
      platform: "video",
      title: "14 Technologies Redefining the Future of Human Civilization",
      content: "Documentary style overview with authoritative narration on future technology shifts.",
      url: "https://www.youtube.com/watch?v=bQCtMzx8ndk",
    },
    {
      id: "future-tech-yt-2",
      type: "entertainment",
      platform: "video",
      title: "2026 Will Be Ruled by These 20 New Tech Trends",
      content: "Fast-paced countdown format with dramatic framing for broad audiences.",
      url: "https://www.youtube.com/watch?v=uUdDQSb5Jqo",
    },
    {
      id: "future-tech-yt-3",
      type: "entertainment",
      platform: "video",
      title: "The 20 Inventions That Will Change Your Life in 2026",
      content: "Curiosity-driven storytelling around emerging inventions and everyday impact.",
      url: "https://www.youtube.com/watch?v=spaANAN0U5s",
    },
    {
      id: "future-tech-yt-4",
      type: "knowledge",
      platform: "video",
      title: "9 Breakthrough Technologies That Will Change the World in 2025",
      content: "Serious explainer style aimed at technology enthusiasts and trend tracking.",
      url: "https://www.youtube.com/watch?v=4SzeWVaSNxE",
    },
    {
      id: "future-tech-yt-5",
      type: "entertainment",
      platform: "video",
      title: "The Rise of AI-Powered Robotics in 2025 (Your Life Will NOT Be The Same)",
      content: "Sensational framing focused on mainstream excitement around AI robotics.",
      url: "https://www.youtube.com/watch?v=OSwcP_FDNeo",
    },
    {
      id: "future-tech-media-6",
      type: "knowledge",
      platform: "media",
      title: "10 Breakthrough Technologies 2025",
      content: "MIT Technology Review annual list with high-authority editorial perspective.",
      url: "https://www.technologyreview.com/2025/01/03/1109178/10-breakthrough-technologies-2025/",
    },
    {
      id: "future-tech-media-7",
      type: "knowledge",
      platform: "media",
      title: "What's Next for AI in 2026",
      content: "Forward-looking analysis from MIT Technology Review on near-term AI direction.",
      url: "https://www.technologyreview.com/2026/01/05/1130662/whats-next-for-ai-in-2026/",
    },
    {
      id: "future-tech-media-8",
      type: "knowledge",
      platform: "media",
      title: "10 Things That Matter in AI Right Now (2026)",
      content: "Interactive long-form coverage of robotics, deepfakes, and military AI trends.",
      url: "https://www.technologyreview.com/2026/04/21/1135643/10-ai-artificial-intelligence-trends-technologies-research-2026/",
    },
    {
      id: "future-tech-media-9",
      type: "knowledge",
      platform: "media",
      title: "The Future of AI: How AI Is Changing the World",
      content: "Business and technology lens with enterprise examples and industry references.",
      url: "https://builtin.com/artificial-intelligence/artificial-intelligence-future",
    },
    {
      id: "future-tech-social-10",
      type: "social",
      platform: "social",
      title: "r/Futurology: technology future daily life (Top, Year)",
      content: "Community discussion feed capturing high-engagement public predictions.",
      url: "https://www.reddit.com/r/Futurology/search/?q=technology+future+daily+life&sort=top&t=year",
    },
  ],
  "emotion-story": [
    {
      id: "emotion-story-yt-1",
      type: "emotion",
      platform: "video",
      title: "The Psychology of Storytelling",
      content: "Provocative opener questioning why stories influence judgment so strongly.",
      url: "https://www.youtube.com/watch?v=LSbfYmwF7lo",
    },
    {
      id: "emotion-story-yt-2",
      type: "emotion",
      platform: "video",
      title: "Power of Emotional Storytelling",
      content: "Talk format emphasizing that audiences remember feelings more than facts.",
      url: "https://www.youtube.com/watch?v=CyoB6VVAW0Q",
    },
    {
      id: "emotion-story-yt-3",
      type: "emotion",
      platform: "video",
      title: "The Magical Science of Storytelling",
      content: "Widely cited TEDx style explanation linking storytelling to brain chemistry.",
      url: "https://www.youtube.com/watch?v=Nj-hdQMa3uA",
    },
    {
      id: "emotion-story-yt-4",
      type: "emotion",
      platform: "video",
      title: "The Psychology of Effective Storytelling",
      content: "Practical interview format focused on narrative structure and persuasion.",
      url: "https://www.youtube.com/watch?v=XfsrQDHp-LY",
    },
    {
      id: "emotion-story-media-5",
      type: "emotion",
      platform: "media",
      title: "Emotional Decision Making: Hardwired and Helpful",
      content: "Law and neuroscience crossover perspective on emotion in judgment.",
      url: "https://law.temple.edu/aer/2024/09/07/emotional-decision-making-hardwired-and-helpful/",
    },
    {
      id: "emotion-story-media-6",
      type: "emotion",
      platform: "media",
      title: "Why Your Brain Needs Stories",
      content: "Narrative neuroscience article discussing synchrony and cognitive engagement.",
      url: "https://medium.com/a-more-perfect-story/why-your-brain-needs-stories-93c9e267421d",
    },
    {
      id: "emotion-story-media-7",
      type: "emotion",
      platform: "media",
      title: "How Stories Change the Brain",
      content: "Classic Greater Good synthesis of research on storytelling and oxytocin.",
      url: "https://greatergood.berkeley.edu/article/item/how_stories_change_brain",
    },
    {
      id: "emotion-story-media-8",
      type: "emotion",
      platform: "media",
      title: "The Neuroscience of Storytelling: How Leaders Can Build Lasting Connections",
      content: "Leadership-focused interpretation of emotional storytelling impact.",
      url: "https://www.disrupts.com/news/the-neuroscience-of-storytelling-how-leaders-can-build-lasting-connections",
    },
    {
      id: "emotion-story-media-9",
      type: "knowledge",
      platform: "media",
      title: "Storytelling Statistics 2025: 94+ Stats and Insights",
      content: "Data-heavy source for persuasion, recall, and audience response benchmarks.",
      url: "https://marketingltb.com/blog/statistics/storytelling-statistics/",
    },
    {
      id: "emotion-story-social-10",
      type: "social",
      platform: "social",
      title: "r/marketing: emotional storytelling decisions (Top, Year)",
      content: "Practitioner discussion around emotional narrative in real campaigns.",
      url: "https://www.reddit.com/r/marketing/search/?q=emotional+storytelling+decisions&sort=top&t=year",
    },
  ],
  "business-logic": [
    {
      id: "business-logic-yt-1",
      type: "knowledge",
      platform: "video",
      title: "Warren Buffett: Competitive Advantage Analysis and Moat Investing",
      content: "Structured breakdown of moat categories and investment logic.",
      url: "https://www.youtube.com/watch?v=kn_XieEuvKM",
    },
    {
      id: "business-logic-yt-2",
      type: "knowledge",
      platform: "video",
      title: "Coca-Cola's Brand Power and Moat Explained",
      content: "Case-study narrative combining brand strategy with defensibility metrics.",
      url: "https://www.youtube.com/watch?v=dmoASUTVHhQ",
    },
    {
      id: "business-logic-yt-3",
      type: "knowledge",
      platform: "video",
      title: "Warren Buffett: How To Find Economic Moats",
      content: "Hands-on guidance for identifying durable competitive advantages.",
      url: "https://www.youtube.com/watch?v=bLq17MUD1Uo",
    },
    {
      id: "business-logic-media-4",
      type: "knowledge",
      platform: "media",
      title: "When Every Company Can Use the Same AI Models, Context Becomes a Competitive Advantage",
      content: "HBR argument that organizational context becomes the moat in AI parity.",
      url: "https://hbr.org/2026/02/when-every-company-can-use-the-same-ai-models-context-becomes-a-competitive-advantage",
    },
    {
      id: "business-logic-media-5",
      type: "knowledge",
      platform: "media",
      title: "The Key to Sustaining an Enduring Competitive Advantage",
      content: "Strategy podcast perspective on long-run advantage maintenance.",
      url: "https://hbr.org/podcast/2025/02/the-key-to-sustaining-an-enduring-competitive-advantage",
    },
    {
      id: "business-logic-media-6",
      type: "knowledge",
      platform: "media",
      title: "Strategy's Biggest Blind Spot: Erosion of Competitive Advantage",
      content: "McKinsey analysis highlighting moat decay and executive blind spots.",
      url: "https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/strategys-biggest-blind-spot-erosion-of-competitive-advantage",
    },
    {
      id: "business-logic-media-7",
      type: "knowledge",
      platform: "media",
      title: "How Top Economic Performers Lean into Their Competitive Advantage to Guide Their Strategy",
      content: "McKinsey report on using AI and data loops to scale strategic edge.",
      url: "https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/how-top-economic-performers-lean-into-their-competitive-advantage-to-guide-their-strategy",
    },
    {
      id: "business-logic-media-8",
      type: "knowledge",
      platform: "media",
      title: "How to Build Your Competitive Moat in 2025",
      content: "Startup-oriented framework with practical moat-building examples.",
      url: "https://waveup.com/blog/how-to-build-your-competitive-moat/",
    },
    {
      id: "business-logic-media-9",
      type: "knowledge",
      platform: "media",
      title: "Economic Moats: How To Build a Competitive Advantage",
      content: "Execution-focused guide comparing frameworks for defensibility.",
      url: "https://cxl.com/blog/economic-moats/",
    },
    {
      id: "business-logic-social-10",
      type: "social",
      platform: "social",
      title: "r/entrepreneur: competitive advantage moat (Top, Year)",
      content: "Ground-level founder discussion on real moat trade-offs and tactics.",
      url: "https://www.reddit.com/r/entrepreneur/search/?q=competitive+advantage+moat&sort=top&t=year",
    },
  ],
};

const typeConfig = [
  {
    type: "knowledge",
    label: "Knowledge",
    nouns: ["framework", "signal", "pattern", "system", "strategy", "method"],
    summaries: [
      "A concise breakdown of ideas and practical implications.",
      "A structured explanation with clear assumptions and trade-offs.",
      "An analytical perspective focused on evidence and logic.",
    ],
  },
  {
    type: "emotion",
    label: "Emotion",
    nouns: ["turning point", "conflict", "choice", "reflection", "bond", "healing"],
    summaries: [
      "A short narrative with emotional stakes and personal perspective.",
      "A story-first angle that highlights motives and empathy.",
      "A human-centered interpretation of tension and resolution.",
    ],
  },
  {
    type: "entertainment",
    label: "Entertainment",
    nouns: ["moment", "trend", "twist", "highlight", "scene", "remix"],
    summaries: [
      "A light read with fast pacing and memorable hooks.",
      "A quick recap designed for casual discovery and fun.",
      "A playful angle that surfaces surprising details.",
    ],
  },
  {
    type: "social",
    label: "Social",
    nouns: ["debate", "stance", "thread", "backlash", "consensus", "friction"],
    summaries: [
      "A multi-opinion thread with strong disagreement and context.",
      "A social discussion where values and identity collide.",
      "A viewpoint round-up with opposing arguments side by side.",
    ],
  },
];

const platformKinds = ["web", "video", "social", "media"];
const titleModes = ["statement", "suspense", "emphasis"];

const sessions = new Map();
const completedSessions = [];
const topicSourceCache = new Map();
const tavilyDebugState = {
  latest: null,
  history: [],
};
let sessionCounter = 0;

function toIsoNow() {
  return new Date().toISOString();
}

function sourceDebugPreview(sources) {
  return (Array.isArray(sources) ? sources : []).map((item, index) => ({
    index: index + 1,
    title: item.title || "",
    url: item.url || "",
    content: compactText(item.content || "", 240),
  }));
}

function recordTavilyDebug(debugEntry) {
  tavilyDebugState.latest = debugEntry;
  tavilyDebugState.history.push(debugEntry);
  if (tavilyDebugState.history.length > 24) {
    tavilyDebugState.history.splice(0, tavilyDebugState.history.length - 24);
  }
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function createSessionId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getTopic(topicId) {
  if (!topicId) {
    return pickRandom(topicWorlds);
  }
  const found = topicWorlds.find((item) => item.id === topicId);
  return found || pickRandom(topicWorlds);
}

function makeTitle(mode, seed, noun, index) {
  const prefix = seed.split(" ")[0];
  if (mode === "statement") {
    return `${prefix} trend ${index + 1} reveals a new ${noun}`;
  }
  if (mode === "suspense") {
    return `What if this ${noun} changes everything next?`;
  }
  return `The ${noun} everyone keeps missing right now`;
}

function platformByIndex(index) {
  return platformKinds[index % platformKinds.length];
}

function buildMediaUrl(platform, id, topicId) {
  const query = encodeURIComponent(`${topicId} ${id}`);
  if (platform === "video") {
    return `https://www.youtube.com/results?search_query=${query}`;
  }
  if (platform === "social") {
    return `https://www.reddit.com/search/?q=${query}`;
  }
  if (platform === "media") {
    return `https://news.google.com/search?q=${query}`;
  }
  return `https://www.bing.com/search?q=${query}`;
}

function compactText(value, maxLength) {
  if (!value) {
    return "";
  }
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, maxLength - 3) + "...";
}

function normalizeSourceText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sanitizeSourceUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  if (raw.startsWith("www.")) {
    return "https://" + raw;
  }
  return "";
}

function shuffledPick(list, count) {
  const pool = Array.isArray(list) ? list.slice() : [];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = pool[i];
    pool[i] = pool[j];
    pool[j] = temp;
  }
  return pool.slice(0, Math.max(0, count));
}

async function fetchTopicSources(topic) {
  const cacheKey = topic.id + "::" + topic.title;
  const debugEntry = {
    kind: "preset_topic_fetch",
    createdAt: toIsoNow(),
    sourceMode: "preset_template",
    topic: {
      id: topic.id,
      title: topic.title,
      seed: topic.seed,
    },
    cacheKey,
    cacheHit: false,
    templateReady: true,
    maxResults: TAVILY_MAX_RESULTS,
    selectedTemplate: topic.id,
    sourceCount: 0,
    sourcePreview: [],
    status: "pending",
  };

  if (topicSourceCache.has(cacheKey)) {
    const cached = topicSourceCache.get(cacheKey) || [];
    debugEntry.cacheHit = true;
    debugEntry.status = cached.length ? "cache_hit_with_results" : "cache_hit_empty";
    debugEntry.sourceCount = cached.length;
    debugEntry.sourcePreview = sourceDebugPreview(cached);
    debugEntry.finishedAt = toIsoNow();
    recordTavilyDebug(debugEntry);
    return {
      sources: cached,
      debug: debugEntry,
    };
  }

  const preset = Array.isArray(PRESET_TOPIC_SOURCES[topic.id]) ? PRESET_TOPIC_SOURCES[topic.id] : [];
  const normalized = preset
    .map((item, index) => {
      const url = sanitizeSourceUrl(item?.url);
      if (!url) {
        return null;
      }
      const type = typeof item?.type === "string" ? item.type : "knowledge";
      return {
        id: item?.id || `${topic.id}_preset_${index + 1}`,
        type: isValidType(type) ? type : "knowledge",
        title: normalizeSourceText(item?.title),
        content: normalizeSourceText(item?.content),
        url,
        favicon: sanitizeSourceUrl(item?.favicon || ""),
        platform: item?.platform || "web",
        depthLevel: 1 + (index % 5),
      };
    })
    .filter(Boolean)
    .slice(0, TAVILY_MAX_RESULTS);

  topicSourceCache.set(cacheKey, normalized);
  debugEntry.sourceCount = normalized.length;
  debugEntry.sourcePreview = sourceDebugPreview(normalized);
  debugEntry.status = normalized.length ? "ok_preset" : "missing_preset";
  debugEntry.finishedAt = toIsoNow();
  recordTavilyDebug(debugEntry);
  return {
    sources: normalized,
    debug: debugEntry,
  };
}

function enrichContentPoolWithSources(contentPool, topic, sourceList) {
  if (!Array.isArray(sourceList) || !sourceList.length) {
    return contentPool;
  }
  return contentPool.map((item, index) => {
    const source = sourceList[index % sourceList.length];
    return {
      ...item,
      sourceUrl: source.url || item.sourceUrl || buildMediaUrl(item.platform, item.id, topic.id),
      sourceTitle: source.title || item.title,
      sourceSnippet: source.content || item.summary,
      summary: source.content ? compactText(source.content, 140) : item.summary,
      sourceFavicon: source.favicon || "",
    };
  });
}

function generateContentPool(topic) {
  const pool = [];
  let cursor = 0;

  for (const config of typeConfig) {
    for (let i = 0; i < CONTENTS_PER_TYPE; i += 1) {
      const id = `${config.type}_${String(i + 1).padStart(2, "0")}`;
      const depthLevel = 1 + (i % 5);
      const mode = titleModes[(cursor + i) % titleModes.length];
      const noun = config.nouns[i % config.nouns.length];
      const summary = config.summaries[i % config.summaries.length];
      const platform = platformByIndex(cursor + i);
      const title = makeTitle(mode, topic.seed, noun, i);
      const body =
        `Context: ${topic.title}. ` +
        `This item focuses on a ${config.label.toLowerCase()} angle and is tuned for ${platform} style reading. ` +
        `Use this content to observe whether the user dives deeper, skims fast, or switches direction.`;

      pool.push({
        id,
        type: config.type,
        typeLabel: config.label,
        title,
        summary,
        depthLevel,
        titleMode: mode,
        platform,
        body,
        sourceUrl: buildMediaUrl(platform, id, topic.id),
      });
    }
    cursor += 1;
  }

  for (let i = 0; i < pool.length; i += 1) {
    const nextA = pool[(i + 3) % pool.length].id;
    const nextB = pool[(i + 9) % pool.length].id;
    const nextC = pool[(i + 17) % pool.length].id;
    pool[i].nextIds = [nextA, nextB, nextC];
  }

  return pool;
}

function defaultWeights() {
  return {
    knowledge: 1,
    emotion: 1,
    entertainment: 1,
    social: 1,
  };
}

function computeWeights(events) {
  const weights = defaultWeights();
  for (const event of events) {
    if (event.eventType === "click" && weights[event.contentType] !== undefined) {
      weights[event.contentType] += 0.35;
    }
    if (event.eventType === "dwell_end" && weights[event.contentType] !== undefined) {
      const duration = safeNumber(event.payload?.durationMs);
      if (duration > 14000) {
        weights[event.contentType] += 0.32;
      }
    }
    if ((event.eventType === "share" || event.eventType === "comment") && weights[event.contentType] !== undefined) {
      weights[event.contentType] += 0.22;
    }
    if (event.eventType === "interaction" && weights[event.contentType] !== undefined) {
      weights[event.contentType] += 0.18;
    }
    if (event.eventType === "bookmark" && weights[event.contentType] !== undefined) {
      weights[event.contentType] += 0.15;
    }
  }
  return weights;
}

function buildFeed(session, limit = FEED_SIZE, includeSeenPenalty = true) {
  const weights = computeWeights(session.events);
  const impressedIds = new Set(
    session.events.filter((item) => item.eventType === "impression").map((item) => item.contentId),
  );
  const scored = session.contentPool.map((content) => {
    const base = weights[content.type] || 1;
    const seenPenalty = includeSeenPenalty && impressedIds.has(content.id) ? -0.08 : 0.18;
    const depthBoost = content.depthLevel >= 4 ? 0.08 : 0;
    const platformVariance = content.platform === "video" ? 0.07 : content.platform === "social" ? 0.05 : 0.02;
    const noise = Math.random() * 0.15;
    return {
      content,
      score: base + seenPenalty + depthBoost + platformVariance + noise,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((item) => item.content);
}

function createSession(topicId) {
  const topic = getTopic(topicId);
  const sessionId = createSessionId();
  const contentPool = generateContentPool(topic);
  const startedAt = Date.now();
  const session = {
    sessionId,
    numericId: ++sessionCounter,
    topic,
    contentPool,
    startedAt,
    events: [],
    finished: false,
    result: null,
  };
  sessions.set(sessionId, session);
  return session;
}

function pushEvent(session, eventType, payload) {
  if (session.events.length >= MAX_EVENTS_PER_SESSION) {
    return;
  }
  session.events.push({
    ts: Date.now(),
    eventType,
    contentId: payload?.contentId || null,
    contentType: payload?.contentType || null,
    payload: payload || {},
  });
}

function average(arr) {
  if (!arr.length) {
    return 0;
  }
  return arr.reduce((sum, n) => sum + n, 0) / arr.length;
}

function normalize(value, min, max) {
  if (max <= min) {
    return 0;
  }
  return clamp((value - min) / (max - min), 0, 1);
}

function buildTrajectory(session) {
  const events = session.events.filter((item) => item && item.eventType && item.eventType !== "impression");
  const points = events.map((event, index) => {
    const elapsedSec = Math.max(0, (event.ts - session.startedAt) / 1000);
    return {
      index: index + 1,
      elapsedSec,
      eventType: event.eventType,
      contentId: event.contentId,
      contentType: event.contentType,
    };
  });
  return points;
}

function calculateMetrics(session) {
  const events = session.events;
  const clicks = events.filter((item) => item.eventType === "click");
  const impressions = events.filter((item) => item.eventType === "impression");
  const dwells = events.filter((item) => item.eventType === "dwell_end");
  const scrolls = events.filter((item) => item.eventType === "scroll");
  const shares = events.filter((item) => item.eventType === "share");
  const comments = events.filter((item) => item.eventType === "comment");
  const interactions = events.filter((item) => item.eventType === "interaction");
  const bookmarks = events.filter((item) => item.eventType === "bookmark");
  const backtracks = events.filter((item) => item.eventType === "backtrack");
  const searches = events.filter((item) => item.eventType === "search");
  const refreshes = events.filter((item) => item.eventType === "refresh");

  const avgDwellMs = average(dwells.map((item) => safeNumber(item.payload?.durationMs)));
  const avgScrollSpeed = average(scrolls.map((item) => safeNumber(item.payload?.speed)));
  const avgDwellSeconds = avgDwellMs / 1000;
  const clickRate = clicks.length && impressions.length ? clicks.length / impressions.length : 0;

  const typeClicks = {
    knowledge: 0,
    emotion: 0,
    entertainment: 0,
    social: 0,
  };
  for (const item of clicks) {
    if (typeClicks[item.contentType] !== undefined) {
      typeClicks[item.contentType] += 1;
    }
  }
  const browseEvents = impressions.length ? impressions : clicks;
  const totalBrowsed = browseEvents.length;
  const browseTypes = new Set();
  for (const item of browseEvents) {
    if (item && item.contentType && typeClicks[item.contentType] !== undefined) {
      browseTypes.add(item.contentType);
    }
  }

  const splitTs = session.startedAt + SESSION_DURATION_SECONDS * 1000 * 0.4;
  const firstPhaseClicks = clicks.filter((item) => item.ts <= splitTs).length;
  const secondPhaseClicks = clicks.length - firstPhaseClicks;
  const totalClicks = clicks.length;
  const differentTypesCount = browseTypes.size;
  const backtrackRate = totalClicks ? backtracks.length / totalClicks : 0;
  const hitRate = clamp(clickRate, 0, 1);
  const searchPerClick = searches.length / Math.max(totalClicks, 1);
  const shortPathScore = 1 - normalize(searchPerClick, 0, 3);
  const validReads = dwells.filter((item) => safeNumber(item.payload?.durationMs) > 2500).length;
  const depthScoreRaw = avgDwellSeconds * clickRate;
  const depthScore = clamp(depthScoreRaw * 25, 0, 100);

  const scrollSpeedNorm = normalize(avgScrollSpeed, 40, 1300);
  const invDwellNorm = avgDwellSeconds > 0 ? clamp((1 / avgDwellSeconds) / 1.2, 0, 1) : 1;
  const speedScoreRaw = scrollSpeedNorm + invDwellNorm;
  const speedScore = clamp((speedScoreRaw / 2) * 100, 0, 100);

  const explorationScoreBase = totalBrowsed ? (differentTypesCount / totalBrowsed) * 100 : 0;
  const emotionScoreBase = totalClicks ? (typeClicks.emotion / totalClicks) * 100 : 0;
  const refreshExploreBonus = refreshes.reduce(
    (sum, item) => sum + clamp(safeNumber(item.payload?.exploreBonus, 4), 0, 20),
    0,
  );
  const refreshEmotionBonus = refreshes.reduce(
    (sum, item) => sum + clamp(safeNumber(item.payload?.emotionBonus, 2), 0, 20),
    0,
  );
  const explorationScore = clamp(explorationScoreBase + refreshExploreBonus, 0, 100);
  const emotionScore = clamp(emotionScoreBase + refreshEmotionBonus, 0, 100);

  const socialInteractions = shares.length + comments.length + interactions.length;
  const socialScore = clamp(socialInteractions * 20, 0, 100);

  const goalScoreRaw = shortPathScore * 0.45 + (1 - backtrackRate) * 0.35 + hitRate * 0.2;
  const goalScore = clamp(goalScoreRaw * 100, 0, 100);

  const collectScore = clamp((bookmarks.length / Math.max(validReads, 1)) * 100, 0, 100);

  return {
    depthScore,
    speedScore,
    explorationScore,
    emotionScore,
    socialScore,
    goalScore,
    collectScore,
    stats: {
      totalEvents: events.length,
      totalClicks: totalClicks,
      totalImpressions: impressions.length,
      avgDwellMs,
      avgDwellSeconds,
      avgScrollSpeed,
      clickRate,
      totalBrowsed,
      differentTypesCount,
      searchCount: searches.length,
      backtrackCount: backtracks.length,
      refreshCount: refreshes.length,
      socialInteractions,
      depthScoreRaw,
      speedScoreRaw,
      explorationScoreBase,
      emotionScoreBase,
      refreshExploreBonus,
      refreshEmotionBonus,
      firstPhaseClicks,
      secondPhaseClicks,
      typeClicks,
    },
  };
}

function pickPersona(metrics) {
  const archetypes = [
    {
      key: "Deep Diver",
      weight: metrics.depthScore * 0.45 + (100 - metrics.speedScore) * 0.2 + metrics.goalScore * 0.2 + metrics.collectScore * 0.15,
    },
    {
      key: "Fast Scanner",
      weight: metrics.speedScore * 0.55 + (100 - metrics.depthScore) * 0.25 + metrics.explorationScore * 0.2,
    },
    {
      key: "Random Wanderer",
      weight: metrics.explorationScore * 0.6 + (100 - metrics.goalScore) * 0.25 + metrics.speedScore * 0.15,
    },
    {
      key: "Goal Hunter",
      weight: metrics.goalScore * 0.6 + metrics.depthScore * 0.2 + (100 - metrics.explorationScore) * 0.2,
    },
    {
      key: "Emotion Resonator",
      weight: metrics.emotionScore * 0.65 + metrics.depthScore * 0.15 + metrics.socialScore * 0.2,
    },
    {
      key: "Social Debater",
      weight: metrics.socialScore * 0.65 + metrics.explorationScore * 0.2 + metrics.speedScore * 0.15,
    },
  ];
  archetypes.sort((a, b) => b.weight - a.weight);
  const top = archetypes[0];
  const second = archetypes[1];
  const totalWeight = archetypes.reduce((sum, item) => sum + item.weight, 0) || 1;
  return {
    primary: top.key,
    secondary: second.key,
    secondaryPct: clamp((second.weight / totalWeight) * 100, 0, 99),
  };
}

function mbtiHint(metrics) {
  const ie = metrics.socialScore >= 30 || metrics.speedScore >= 65 ? "E" : "I";
  const sn = metrics.depthScore >= 55 ? "N" : "S";
  const tf = metrics.emotionScore >= 38 ? "F" : "T";
  const jp = metrics.goalScore >= 55 ? "J" : "P";
  return `${ie}${sn}${tf}${jp}`;
}

function buildExplanation(metrics) {
  const details = [];
  if (metrics.depthScore >= 60) {
    details.push("You spend longer on selected content and show a strong deep-read pattern.");
  }
  if (metrics.speedScore >= 65) {
    details.push("You move quickly through the feed and optimize for rapid signal collection.");
  }
  if (metrics.explorationScore >= 60) {
    details.push("You explore multiple categories and keep branching your information path.");
  }
  if (metrics.emotionScore >= 40) {
    details.push("You show a clear preference for emotional narratives and human-centered content.");
  }
  if (metrics.goalScore >= 60) {
    details.push("Your path has fewer reversals, suggesting focused intent during browsing.");
  }
  if (!details.length) {
    details.push("Your browsing is balanced, adapting speed and depth based on content value.");
  }
  return details.slice(0, 3);
}

function analyzeSession(session) {
  const endedAtMs = Date.now();
  const metrics = calculateMetrics(session);
  const persona = pickPersona(metrics);
  const timeline = {
    firstMinutes: "First 2 minutes: broad exploration and signal scanning.",
    lastMinutes: "Last 3 minutes: stronger focus and deeper reading.",
  };
  if (metrics.stats.firstPhaseClicks > metrics.stats.secondPhaseClicks * 1.2) {
    timeline.firstMinutes = "First 2 minutes: high click velocity and broad expansion.";
    timeline.lastMinutes = "Last 3 minutes: reduced switching and stronger concentration.";
  }

  return {
    sessionId: session.sessionId,
    recordId: session.numericId,
    topic: session.topic.title,
    endedAt: new Date(endedAtMs).toISOString(),
    actualDurationSeconds: Math.max(1, Number(((endedAtMs - session.startedAt) / 1000).toFixed(1))),
    metrics,
    persona,
    mbtiHint: mbtiHint(metrics),
    explanation: buildExplanation(metrics),
    timeline,
    trajectory: buildTrajectory(session),
  };
}

function isValidType(type) {
  return typeConfig.some((item) => item.type === type);
}

app.get("/", (req, res) => {
  res.send(renderWbtiPage());
});

app.get("/api/topics", (req, res) => {
  res.json({ topics: topicWorlds });
});

app.post("/api/session/start", async (req, res) => {
  const topicId = typeof req.body?.topicId === "string" ? req.body.topicId : "";
  const session = createSession(topicId);
  const sourceResult = await fetchTopicSources(session.topic);
  const sources = Array.isArray(sourceResult?.sources) ? sourceResult.sources : [];
  session.contentPool = enrichContentPoolWithSources(session.contentPool, session.topic, sources);
  const feed = buildFeed(session, INITIAL_FEED_SIZE, false);
  const searchKeyword = `i want to search ${session.topic.title}`;
  const limitedSources = sources.slice(0, TAVILY_MAX_RESULTS);
  res.json({
    ok: true,
    sessionId: session.sessionId,
    topic: session.topic,
    searchKeyword,
    sourceCount: limitedSources.length,
    searchResults: limitedSources,
    displayResults: shuffledPick(limitedSources, DISPLAY_RESULTS_COUNT),
    durationSeconds: SESSION_DURATION_SECONDS,
    contentPool: session.contentPool,
    feed,
    startedAt: session.startedAt,
    tavilyDebug: sourceResult?.debug || null,
  });
});

app.get("/api/debug/tavily", (req, res) => {
  res.json({
    ok: true,
    sourceMode: "preset_template",
    latest: tavilyDebugState.latest,
    history: tavilyDebugState.history.slice().reverse(),
    cacheKeys: Array.from(topicSourceCache.keys()),
    cacheSize: topicSourceCache.size,
    availableTopics: topicWorlds.map((item) => item.id),
  });
});

app.post("/api/debug/tavily/clear-cache", (req, res) => {
  topicSourceCache.clear();
  res.json({
    ok: true,
    message: "Topic source cache cleared.",
    cacheSize: topicSourceCache.size,
  });
});

app.post("/api/session/event", (req, res) => {
  const sessionId = req.body?.sessionId;
  const eventType = req.body?.eventType;
  const payload = req.body?.payload || {};
  const session = sessions.get(sessionId);
  if (!session || session.finished) {
    res.status(400).json({ error: "Session not found or already finished." });
    return;
  }

  const allowList = new Set([
    "impression",
    "click",
    "dwell_end",
    "scroll",
    "backtrack",
    "share",
    "comment",
    "bookmark",
    "interaction",
    "search",
    "refresh",
  ]);
  if (!allowList.has(eventType)) {
    res.status(400).json({ error: "Unsupported event type." });
    return;
  }

  if (payload.contentType && !isValidType(payload.contentType)) {
    res.status(400).json({ error: "Invalid content type." });
    return;
  }

  pushEvent(session, eventType, payload);
  if (eventType === "click" || eventType === "dwell_end" || eventType === "search") {
    const feed = buildFeed(session, FEED_SIZE, true);
    res.json({ ok: true, feed });
    return;
  }
  res.json({ ok: true });
});

app.post("/api/session/finish", (req, res) => {
  const sessionId = req.body?.sessionId;
  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found." });
    return;
  }

  if (session.finished && session.result) {
    res.json({ ok: true, result: session.result });
    return;
  }

  session.finished = true;
  session.result = analyzeSession(session);
  completedSessions.push({
    id: session.numericId,
    topic: session.topic.title,
    persona: session.result.persona.primary,
    mbtiHint: session.result.mbtiHint,
    createdAt: session.result.endedAt,
    metrics: session.result.metrics,
  });

  if (completedSessions.length > 250) {
    completedSessions.splice(0, completedSessions.length - 250);
  }

  res.json({ ok: true, result: session.result });
});

app.get("/api/stats", (req, res) => {
  const byType = {};
  let depthSum = 0;
  let speedSum = 0;
  let explorationSum = 0;

  for (const item of completedSessions) {
    byType[item.persona] = (byType[item.persona] || 0) + 1;
    depthSum += item.metrics.depthScore;
    speedSum += item.metrics.speedScore;
    explorationSum += item.metrics.explorationScore;
  }

  const total = completedSessions.length;
  res.json({
    total,
    byType,
    averages: {
      depth: total ? depthSum / total : 0,
      speed: total ? speedSum / total : 0,
      exploration: total ? explorationSum / total : 0,
    },
    recent: completedSessions
      .slice(-12)
      .reverse()
      .map((item) => ({
        id: item.id,
        topic: item.topic,
        persona: item.persona,
        mbti: item.mbtiHint,
        createdAt: item.createdAt,
      })),
  });
});

function renderWbtiPage() {
  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WBTI - Your Web Browsing Type Indicator</title>
  <style>
    :root {
      --bg: radial-gradient(circle at 15% 10%, #dff2ff 0, #f5f9ff 45%, #edf2ff 100%);
      --ink: #0f172a;
      --muted: #5b6475;
      --line: #d9e2ef;
      --brand: #2563eb;
      --brand-2: #0ea5e9;
      --panel: #ffffff;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      font-family: "Inter", "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--bg);
      min-height: 100vh;
    }
    .app {
      width: 100vw;
      min-height: 100vh;
      margin: 0;
      padding: 14px;
    }
    .stage {
      display: none;
      background: var(--panel);
      border: 1px solid rgba(37, 99, 235, 0.16);
      border-radius: 18px;
      box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
      padding: 18px;
      min-height: calc(100vh - 28px);
    }
    .stage.active {
      display: block;
    }
    h1, h2, h3, p {
      margin: 0;
    }
    .muted {
      color: var(--muted);
      font-size: 0.94rem;
      line-height: 1.5;
      margin-top: 8px;
    }
    .title-main {
      font-size: clamp(1.7rem, 2.8vw, 2.25rem);
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .topic-box {
      margin-top: 14px;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px;
      background: linear-gradient(180deg, #f8fbff, #f2f7ff);
    }
    .topic-options {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    .topic-pill {
      border: 1px solid #bfdbfe;
      border-radius: 999px;
      background: #eff6ff;
      color: #1e40af;
      padding: 8px 12px;
      font-size: 0.86rem;
      cursor: pointer;
      font-weight: 600;
    }
    .topic-pill.active {
      background: linear-gradient(120deg, #2563eb, #3b82f6);
      color: white;
      border-color: #2563eb;
    }
    .btn-row {
      margin-top: 14px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    button {
      border: none;
      border-radius: 10px;
      padding: 9px 15px;
      font-weight: 700;
      font-size: 0.92rem;
      cursor: pointer;
      background: linear-gradient(120deg, var(--brand), var(--brand-2));
      color: #fff;
    }
    .ghost {
      background: #fff;
      border: 1px solid var(--line);
      color: #0f172a;
    }
    button:disabled,
    .ghost:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .loading-shell {
      min-height: 320px;
      display: grid;
      place-items: center;
      text-align: center;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #dbeafe;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .search-layout {
      min-height: 520px;
      display: flex;
      flex-direction: column;
    }
    .search-hero {
      text-align: center;
      padding-top: 12px;
    }
    .search-box-wrap {
      margin: 16px auto 0;
      width: min(760px, 100%);
      border: 1px solid #cfe0ff;
      border-radius: 12px;
      background: white;
      box-shadow: 0 8px 26px rgba(37, 99, 235, 0.08);
      padding: 8px;
    }
    .timer-row {
      flex: 1;
      width: 100%;
    }
    .timer-track {
      width: 100%;
      height: 10px;
      border-radius: 999px;
      border: 1px solid #dbe7ff;
      background: #f1f5ff;
      overflow: hidden;
    }
    .timer-fill {
      height: 100%;
      width: 0%;
      background: linear-gradient(120deg, #2563eb, #0ea5e9);
      transition: width 0.4s linear;
    }
    .timer-text {
      margin-top: 6px;
      font-size: 0.85rem;
      color: #64748b;
      text-align: right;
    }
    .search-bottom {
      margin-top: auto;
      padding-top: 14px;
      border-top: 1px dashed var(--line);
      display: flex;
      gap: 12px;
      align-items: flex-end;
    }
    .search-bottom button {
      white-space: nowrap;
    }
    .search-row {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: center;
    }
    .search-input {
      flex: 1;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 0.95rem;
      outline: none;
      background: #f8fbff;
    }
    .cards-wrap {
      margin-top: 20px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #f8fbff;
      padding: 12px;
    }
    .cards-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }
    .debug-shell {
      margin-top: 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #ffffff;
      padding: 10px;
    }
    .debug-shell summary {
      cursor: pointer;
      font-weight: 700;
      color: #334155;
    }
    .debug-actions {
      margin-top: 10px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .debug-mini-btn {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
      color: #0f172a;
      font-size: 0.82rem;
      padding: 6px 10px;
      cursor: pointer;
    }
    .debug-mini-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .debug-json {
      margin-top: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #0f172a;
      color: #e2e8f0;
      font-size: 0.78rem;
      line-height: 1.45;
      padding: 10px;
      max-height: 280px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .cards-grid {
      margin-top: 8px;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .result-card {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: white;
      padding: 12px;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .result-card:hover {
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.07);
    }
    .result-card h3 {
      font-size: 0.98rem;
      line-height: 1.35;
    }
    .result-card p {
      margin-top: 7px;
      color: #475569;
      font-size: 0.9rem;
      line-height: 1.45;
    }
    .result-meta {
      margin-top: 8px;
      font-size: 0.8rem;
      color: #64748b;
    }
    .empty {
      text-align: center;
      color: #64748b;
      padding: 18px;
      border: 1px dashed var(--line);
      border-radius: 12px;
    }
    .modal {
      position: fixed;
      inset: 0;
      background: rgba(2, 6, 23, 0.55);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 14px;
      z-index: 50;
    }
    .modal.active {
      display: flex;
    }
    .modal-body {
      width: min(920px, 100%);
      max-height: 86vh;
      overflow: auto;
      background: white;
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 20px 38px rgba(15, 23, 42, 0.22);
    }
    .modal-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
    }
    .modal-content {
      margin-top: 12px;
      color: #334155;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .modal-preview-shell {
      margin-top: 12px;
    }
    .modal-preview {
      width: 100%;
      height: 420px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #f8fbff;
    }
    .source-link {
      margin-top: 12px;
      word-break: break-all;
      font-size: 0.9rem;
    }
    .modal-actions {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .mini-btn {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 7px 10px;
      background: #f8fafc;
      color: #0f172a;
      font-size: 0.82rem;
      cursor: pointer;
    }
    .mini-btn.active {
      background: #dcfce7;
      border-color: #22c55e;
      color: #14532d;
      font-weight: 700;
    }
    .related-links {
      margin-top: 12px;
      border-top: 1px dashed var(--line);
      padding-top: 10px;
      display: grid;
      gap: 6px;
    }
    .related-links a {
      color: #2563eb;
      text-decoration: none;
      font-size: 0.92rem;
    }
    .related-links a:hover {
      text-decoration: underline;
    }
    .report-grid {
      margin-top: 14px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .report-card {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: white;
      padding: 12px;
    }
    .metric-bar {
      margin-top: 8px;
    }
    .metric-label {
      font-size: 0.84rem;
      color: #334155;
    }
    .metric-track {
      margin-top: 4px;
      height: 10px;
      border-radius: 999px;
      background: #e5edff;
      overflow: hidden;
    }
    .metric-fill {
      height: 100%;
      background: linear-gradient(120deg, #2563eb, #0ea5e9);
    }
    #trajectorySvg {
      margin-top: 10px;
      width: 100%;
      min-height: 220px;
      border: 1px dashed var(--line);
      border-radius: 10px;
      background: #f8fbff;
    }
    #radarSvg {
      margin-top: 10px;
      width: 100%;
      min-height: 240px;
      border: 1px dashed var(--line);
      border-radius: 10px;
      background: #f8fbff;
    }
    .poster-shell {
      margin-top: 12px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #f8fbff;
      padding: 10px;
    }
    #posterCanvas {
      width: 100%;
      max-width: 360px;
      border: 1px solid #dbe4f7;
      border-radius: 8px;
      background: #fff;
      margin-top: 8px;
      display: block;
    }
    @media (max-width: 990px) {
      .cards-grid {
        grid-template-columns: 1fr;
      }
      .report-grid {
        grid-template-columns: 1fr;
      }
      .search-bottom {
        flex-direction: column;
        align-items: stretch;
      }
      .search-bottom button {
        align-self: flex-end;
      }
    }
  </style>
</head>
<body>
  <main class="app">
    <section id="landingStage" class="stage active">
      <h1 class="title-main">WBTI-your web browsing type indicator</h1>
      <p class="muted">A browser-native behavior test powered by real web sources.</p>
      <div class="topic-box">
        <p class="muted" style="margin-top:0;">Start with this topic</p>
        <h2 id="selectedTopicTitle" style="margin-top:6px;">Loading topic...</h2>
        <div id="topicOptions" class="topic-options"></div>
      </div>
      <div class="btn-row">
        <button id="startBtn" type="button">Start</button>
        <button id="shuffleBtn" class="ghost" type="button">Try Another Topic</button>
      </div>
    </section>

    <section id="loadingStage" class="stage">
      <div class="loading-shell">
        <div>
          <div class="spinner"></div>
          <h2 style="margin-top:14px;">Gathering Real Sources...</h2>
          <p id="loadingText" class="muted">Loading preset source pack.</p>
        </div>
      </div>
    </section>

    <section id="searchStage" class="stage">
      <div class="search-layout">
        <div class="search-hero">
          <h2 id="searchTopicTitle">Topic</h2>
          <p class="muted">Bing-style start page. Search within fetched sources.</p>
          <div class="search-box-wrap">
            <div class="search-row">
              <input id="searchInput" class="search-input" type="text" placeholder="Search inside current source pack..." />
              <button id="searchBtn" class="ghost" type="button">Search</button>
              <button id="backBtn" class="ghost" type="button">Back</button>
            </div>
          </div>
        </div>
        <div class="cards-wrap">
          <div class="cards-head">
            <p class="muted" style="margin-top:0;">Random 5 from 10 preset sources</p>
            <button id="refreshCardsBtn" class="debug-mini-btn" type="button">Refresh 5 Cards</button>
          </div>
          <div id="cardsGrid" class="cards-grid"></div>
          <details id="tavilyDebugShell" class="debug-shell">
            <summary>Source Debug</summary>
            <div class="debug-actions">
              <button id="refreshDebugBtn" class="debug-mini-btn" type="button">Refresh Debug</button>
              <button id="clearCacheDebugBtn" class="debug-mini-btn" type="button">Clear Cache</button>
            </div>
            <p id="debugStatus" class="muted">No debug data yet.</p>
            <pre id="debugJson" class="debug-json">{}</pre>
          </details>
        </div>
        <div class="search-bottom">
          <div class="timer-row">
            <div class="timer-track"><div id="timerFill" class="timer-fill"></div></div>
            <div id="timerText" class="timer-text">Time left: 05:00</div>
          </div>
          <button id="endTestBtn" type="button">End Test</button>
        </div>
      </div>
    </section>
    <section id="reportStage" class="stage">
      <h2>WBTI Report</h2>
      <p id="reportHeader" class="muted">Analyzing...</p>
      <div class="report-grid">
        <article class="report-card">
          <h3>Personality Summary</h3>
          <img id="personaImage" src="" alt="Persona" style="width:100%;max-width:300px;margin:12px 0;border-radius:8px;" />
          <p id="personaText" class="muted"></p>
          <p id="explainText" class="muted"></p>
          <div id="metricsPanel"></div>
        </article>
        <article class="report-card">
          <h3>Radar Profile</h3>
          <p id="mbtiText" class="muted"></p>
          <svg id="radarSvg" viewBox="0 0 320 240"></svg>
          <h3 style="margin-top:12px;">Operation Timeline</h3>
          <svg id="trajectorySvg" viewBox="0 0 640 240" preserveAspectRatio="none"></svg>
          <div class="poster-shell">
            <h3>Share Poster</h3>
            <p class="muted">Generate a shareable image for your WBTI result.</p>
            <canvas id="posterCanvas" width="720" height="920"></canvas>
            <div class="btn-row">
              <button id="downloadPosterBtn" type="button">Download Poster</button>
              <button id="copyShareBtn" class="ghost" type="button">Copy Share Text</button>
            </div>
          </div>
        </article>
      </div>
      <div class="btn-row">
        <button id="restartBtn" type="button">Run Again</button>
      </div>
    </section>
  </main>

  <div id="resultModal" class="modal">
    <div class="modal-body">
      <div class="modal-head">
        <h3 id="modalTitle">Result</h3>
        <button id="closeModalBtn" class="ghost" type="button">Close</button>
      </div>
      <p id="modalMeta" class="muted"></p>
      <div id="modalContent" class="modal-content"></div>
      <div class="modal-preview-shell">
        <iframe id="modalPreview" class="modal-preview" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts allow-forms allow-popups"></iframe>
      </div>
      <div class="source-link">
        Source:
        <a id="modalLink" href="#" target="_blank" rel="noreferrer">Open original page</a>
      </div>
      <div class="modal-actions">
        <button id="bookmarkBtn" class="mini-btn" type="button">Bookmark</button>
        <button id="shareBtn" class="mini-btn" type="button">Share</button>
        <button id="commentBtn" class="mini-btn" type="button">Comment</button>
        <button id="interactBtn" class="mini-btn" type="button">Interact</button>
      </div>
      <div id="modalRelated" class="related-links"></div>
    </div>
  </div>

  <script>
    (() => {
      const landingStage = document.getElementById("landingStage");
      const loadingStage = document.getElementById("loadingStage");
      const searchStage = document.getElementById("searchStage");
      const reportStage = document.getElementById("reportStage");
      const selectedTopicTitle = document.getElementById("selectedTopicTitle");
      const topicOptions = document.getElementById("topicOptions");
      const startBtn = document.getElementById("startBtn");
      const shuffleBtn = document.getElementById("shuffleBtn");
      const loadingText = document.getElementById("loadingText");
      const searchTopicTitle = document.getElementById("searchTopicTitle");
      const searchInput = document.getElementById("searchInput");
      const searchBtn = document.getElementById("searchBtn");
      const refreshCardsBtn = document.getElementById("refreshCardsBtn");
      const endTestBtn = document.getElementById("endTestBtn");
      const backBtn = document.getElementById("backBtn");
      const timerFill = document.getElementById("timerFill");
      const timerText = document.getElementById("timerText");
      const cardsGrid = document.getElementById("cardsGrid");
      const tavilyDebugShell = document.getElementById("tavilyDebugShell");
      const refreshDebugBtn = document.getElementById("refreshDebugBtn");
      const clearCacheDebugBtn = document.getElementById("clearCacheDebugBtn");
      const debugStatus = document.getElementById("debugStatus");
      const debugJson = document.getElementById("debugJson");
      const reportHeader = document.getElementById("reportHeader");
      const personaText = document.getElementById("personaText");
      const explainText = document.getElementById("explainText");
      const metricsPanel = document.getElementById("metricsPanel");
      const mbtiText = document.getElementById("mbtiText");
      const radarSvg = document.getElementById("radarSvg");
      const trajectorySvg = document.getElementById("trajectorySvg");
      const posterCanvas = document.getElementById("posterCanvas");
      const downloadPosterBtn = document.getElementById("downloadPosterBtn");
      const copyShareBtn = document.getElementById("copyShareBtn");
      const restartBtn = document.getElementById("restartBtn");
      const resultModal = document.getElementById("resultModal");
      const modalTitle = document.getElementById("modalTitle");
      const modalMeta = document.getElementById("modalMeta");
      const modalContent = document.getElementById("modalContent");
      const modalPreview = document.getElementById("modalPreview");
      const modalLink = document.getElementById("modalLink");
      const bookmarkBtn = document.getElementById("bookmarkBtn");
      const shareBtn = document.getElementById("shareBtn");
      const commentBtn = document.getElementById("commentBtn");
      const interactBtn = document.getElementById("interactBtn");
      const modalRelated = document.getElementById("modalRelated");
      const closeModalBtn = document.getElementById("closeModalBtn");

      const state = {
        topics: [],
        topic: null,
        sessionId: "",
        startedAt: 0,
        durationSeconds: 300,
        timerId: null,
        finishing: false,
        result: null,
        tavilyDebug: null,
        allCards: [],
        cards: [],
        visibleCards: [],
        impressedIds: new Set(),
        bookmarkedIds: new Set(),
        modalVisit: null,
        modalItem: null,
        scrollSample: {
          lastTs: 0,
          lastEmitTs: 0,
        },
      };

      function setStage(stage) {
        landingStage.classList.remove("active");
        loadingStage.classList.remove("active");
        searchStage.classList.remove("active");
        reportStage.classList.remove("active");
        stage.classList.add("active");
      }

      async function request(url, options) {
        const response = await fetch(url, options);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Request failed.");
        }
        return payload;
      }

      async function trackSessionEvent(eventType, payload) {
        if (!state.sessionId) return;
        try {
          await request("/api/session/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: state.sessionId,
              eventType,
              payload: payload || {},
            }),
          });
        } catch (error) {
          console.warn(eventType + " event failed:", error.message || error);
        }
      }

      function updateBookmarkButton() {
        if (!state.modalItem || !state.modalItem.id) {
          bookmarkBtn.classList.remove("active");
          bookmarkBtn.textContent = "Bookmark";
          return;
        }
        if (state.bookmarkedIds.has(state.modalItem.id)) {
          bookmarkBtn.classList.add("active");
          bookmarkBtn.textContent = "Bookmarked";
        } else {
          bookmarkBtn.classList.remove("active");
          bookmarkBtn.textContent = "Bookmark";
        }
      }

      function stringifyDebug(value) {
        try {
          return JSON.stringify(value, null, 2);
        } catch (error) {
          return String(value);
        }
      }

      function renderTavilyDebug(payload, sourceLabel) {
        state.tavilyDebug = payload || null;
        const latest = payload && payload.latest ? payload.latest : payload;
        const sourceCount = latest && typeof latest.sourceCount === "number" ? latest.sourceCount : 0;
        const status = latest && latest.status ? latest.status : "unknown";
        const from = sourceLabel ? sourceLabel + " " : "";
        const detail =
          latest && latest.selectedTemplate
            ? " | template: " + latest.selectedTemplate
            : latest && latest.selectedQuery
              ? " | query: " + latest.selectedQuery
              : "";
        debugStatus.textContent = from + "status: " + status + " | sources: " + sourceCount + detail;
        debugJson.textContent = stringifyDebug(payload || {});
      }

      async function refreshTavilyDebug() {
        refreshDebugBtn.disabled = true;
        const original = refreshDebugBtn.textContent;
        refreshDebugBtn.textContent = "Refreshing...";
        try {
          const payload = await request("/api/debug/tavily?ts=" + Date.now());
          renderTavilyDebug(payload, "Live");
        } catch (error) {
          debugStatus.textContent = "Live debug fetch failed: " + String(error.message || error);
        } finally {
          refreshDebugBtn.disabled = false;
          refreshDebugBtn.textContent = original;
        }
      }

      async function clearTavilyCache() {
        clearCacheDebugBtn.disabled = true;
        const original = clearCacheDebugBtn.textContent;
        clearCacheDebugBtn.textContent = "Clearing...";
        try {
          await request("/api/debug/tavily/clear-cache", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });
          await refreshTavilyDebug();
        } catch (error) {
          debugStatus.textContent = "Clear cache failed: " + String(error.message || error);
        } finally {
          clearCacheDebugBtn.disabled = false;
          clearCacheDebugBtn.textContent = original;
        }
      }

      async function loadTopics() {
        const payload = await request("/api/topics");
        state.topics = payload.topics || [];
        if (!state.topics.length) {
          selectedTopicTitle.textContent = "No topic available.";
          startBtn.disabled = true;
          shuffleBtn.disabled = true;
          return;
        }
        state.topic = state.topics[0];
        selectedTopicTitle.textContent = state.topic.title;
        renderTopicOptions();
      }

      function shuffledPickLocal(list, count) {
        const pool = Array.isArray(list) ? list.slice() : [];
        for (let i = pool.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = pool[i];
          pool[i] = pool[j];
          pool[j] = temp;
        }
        return pool.slice(0, Math.max(0, count));
      }

      function toCard(item) {
        const url = sanitizeExternalUrl(item && item.url);
        if (!url) return null;
        const rawType = String((item && item.type) || "knowledge");
        const validType = ["knowledge", "emotion", "entertainment", "social"].includes(rawType)
          ? rawType
          : "knowledge";
        return {
          id: String((item && item.id) || url),
          title: String(item && item.title ? item.title : "").trim() || "Untitled source",
          content: String(item && item.content ? item.content : "").trim() || "No content snippet available.",
          url,
          favicon: sanitizeExternalUrl(item && item.favicon),
          source: "preset",
          type: validType,
          depthLevel: Math.max(1, Math.round(Number(item && item.depthLevel) || 1)),
        };
      }

      function applyTavilyResults(searchResults, displayResults) {
        const allCards = (Array.isArray(searchResults) ? searchResults : [])
          .map((item) => toCard(item))
          .filter(Boolean);
        const fallbackDisplay = shuffledPickLocal(allCards, 5);
        const targetDisplaySource =
          Array.isArray(displayResults) && displayResults.length ? displayResults : fallbackDisplay;
        const visibleCards = targetDisplaySource
          .map((item) => toCard(item))
          .filter(Boolean)
          .slice(0, 5);

        state.allCards = allCards;
        state.cards = visibleCards;
        state.visibleCards = visibleCards.slice();
      }

      function renderTopicOptions() {
        topicOptions.innerHTML = state.topics
          .map((topic) => {
            const active = state.topic && state.topic.id === topic.id ? " active" : "";
            return "<button class='topic-pill" + active + "' data-topic-id='" + topic.id + "' type='button'>" + escapeHtml(topic.title) + "</button>";
          })
          .join("");

        topicOptions.querySelectorAll(".topic-pill").forEach((button) => {
          button.addEventListener("click", () => {
            const id = button.getAttribute("data-topic-id");
            const found = state.topics.find((item) => item.id === id);
            if (!found) return;
            state.topic = found;
            selectedTopicTitle.textContent = found.title;
            renderTopicOptions();
          });
        });
      }

      async function startSession() {
        if (!state.topic) {
          return;
        }
        setStage(loadingStage);
        loadingText.textContent = "Loading preset sources for: " + state.topic.title;

        const payload = await request("/api/session/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicId: state.topic && state.topic.id }),
        });

        state.sessionId = payload.sessionId;
        state.result = null;
        state.impressedIds = new Set();
        state.bookmarkedIds = new Set();
        state.modalVisit = null;
        state.modalItem = null;
        state.scrollSample.lastTs = 0;
        state.scrollSample.lastEmitTs = 0;
        state.startedAt = payload.startedAt || Date.now();
        state.durationSeconds = payload.durationSeconds || 300;
        searchTopicTitle.textContent = payload.topic.title;
        applyTavilyResults(payload.searchResults, payload.displayResults);
        if (payload.tavilyDebug) {
          renderTavilyDebug(payload.tavilyDebug, "Start");
          if (!state.allCards.length) {
            tavilyDebugShell.open = true;
          }
        }

        if (payload.searchKeyword) {
          searchInput.value = payload.searchKeyword;
        } else {
          searchInput.value = "i want to search " + payload.topic.title;
        }
        renderCards();
        setStage(searchStage);
        startTimer();
      }

      function renderCards() {
        if (!state.visibleCards.length) {
          if (!state.allCards.length) {
            cardsGrid.innerHTML = "<div class='empty'>No preset sources available for this topic.</div>";
          } else {
            cardsGrid.innerHTML = "<div class='empty'>No matching result in current source pack.</div>";
          }
          return;
        }
        cardsGrid.innerHTML = state.visibleCards
          .map((item) => {
            return (
              "<article class='result-card' data-card-id='" + escapeHtml(item.id) + "'>" +
              "<h3>" + escapeHtml(item.title) + "</h3>" +
              "<p>" + escapeHtml(item.content) + "</p>" +
              "<div class='result-meta'>" + escapeHtml(hostnameOf(item.url)) + "</div>" +
              "</article>"
            );
          })
          .join("");

        const cards = cardsGrid.querySelectorAll(".result-card");
        cards.forEach((card) => {
          const id = card.getAttribute("data-card-id");
          const hit = state.visibleCards.find((item) => item.id === id);
          if (!hit) return;
          card.addEventListener("click", () => openModal(hit));
        });
        trackImpressionsForVisible();
      }

      function escapeHtml(str) {
        return String(str || "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function hostnameOf(url) {
        try {
          return new URL(url).hostname;
        } catch (error) {
          return url || "unknown";
        }
      }

      function sanitizeExternalUrl(value) {
        const raw = String(value || "").trim();
        if (!raw) return "";
        if (raw.startsWith("http://") || raw.startsWith("https://")) {
          return raw;
        }
        if (raw.startsWith("www.")) {
          return "https://" + raw;
        }
        return "";
      }

      function renderRelatedLinks(currentId) {
        const related = shuffledPickLocal(
          state.allCards.filter((item) => item.id !== currentId && sanitizeExternalUrl(item.url)),
          3,
        );
        if (!related.length) {
          modalRelated.innerHTML = "<div class='muted' style='margin-top:0;'>No related preset links.</div>";
          return;
        }
        modalRelated.innerHTML =
          "<div class='muted' style='margin-top:0;'>Related from source pack</div>" +
          related
            .map((item) => {
              return "<a href='" + escapeHtml(item.url) + "' target='_blank' rel='noreferrer'>" + escapeHtml(item.title) + "</a>";
            })
            .join("");
      }

      function applyKeywordFilter(keyword) {
        const cleanKeyword = String(keyword || "").trim().toLowerCase();
        if (!cleanKeyword) {
          state.visibleCards = state.cards.slice();
          renderCards();
          return;
        }
        state.visibleCards = state.allCards.filter((item) => {
          const haystack = (item.title + " " + item.content + " " + item.url).toLowerCase();
          return haystack.includes(cleanKeyword);
        });
        renderCards();
      }

      function refreshVisibleCards() {
        if (!state.allCards.length) {
          return;
        }
        state.visibleCards = shuffledPickLocal(state.allCards, 5);
        renderCards();
        trackSessionEvent("refresh", {
          exploreBonus: 4,
          emotionBonus: 2,
          selectedCount: state.visibleCards.length,
        });
      }

      function trackScrollSample(deltaY) {
        if (!state.sessionId || !searchStage.classList.contains("active")) return;
        const now = Date.now();
        const lastTs = state.scrollSample.lastTs || now;
        const dt = Math.max(1, now - lastTs);
        state.scrollSample.lastTs = now;
        const delta = Number(deltaY) || 0;
        const speed = Math.abs(delta) / (dt / 1000);
        if (now - state.scrollSample.lastEmitTs < 650) {
          return;
        }
        state.scrollSample.lastEmitTs = now;
        trackSessionEvent("scroll", {
          speed,
          deltaY: delta,
        });
      }

      function trackImpressionsForVisible() {
        if (!state.sessionId) return;
        for (const item of state.visibleCards) {
          if (!item || !item.id || state.impressedIds.has(item.id)) continue;
          state.impressedIds.add(item.id);
          trackSessionEvent("impression", {
            contentId: item.id,
            contentType: item.type || "knowledge",
            depthLevel: item.depthLevel || 1,
          });
        }
      }

      async function trackSearch(keyword) {
        if (!state.sessionId) return;
        await trackSessionEvent("search", { keyword });
      }

      function closeResultModal(trackBacktrack = true) {
        if (state.modalVisit && state.sessionId) {
          const durationMs = Math.max(200, Date.now() - state.modalVisit.startedAt);
          trackSessionEvent("dwell_end", {
            contentId: state.modalVisit.contentId,
            contentType: state.modalVisit.contentType,
            depthLevel: state.modalVisit.depthLevel,
            durationMs,
          });
          if (trackBacktrack) {
            trackSessionEvent("backtrack", {
              contentId: state.modalVisit.contentId,
              contentType: state.modalVisit.contentType,
              depthLevel: state.modalVisit.depthLevel,
              durationMs,
            });
          }
        }
        state.modalVisit = null;
        state.modalItem = null;
        shareBtn.textContent = "Share";
        interactBtn.textContent = "Interact";
        resultModal.classList.remove("active");
        modalPreview.removeAttribute("src");
        modalRelated.innerHTML = "";
        updateBookmarkButton();
      }

      async function openModal(item) {
        if (!item) return;
        if (state.modalVisit) {
          closeResultModal(false);
        }
        state.modalItem = item;
        modalTitle.textContent = item.title || "Untitled source";
        modalMeta.textContent = hostnameOf(item.url);
        modalContent.textContent = item.content || "No content snippet available.";
        const safeUrl = sanitizeExternalUrl(item.url);
        modalLink.href = safeUrl || "#";
        if (safeUrl) {
          modalPreview.src = safeUrl;
        } else {
          modalPreview.removeAttribute("src");
        }
        renderRelatedLinks(item.id);
        updateBookmarkButton();
        resultModal.classList.add("active");
        state.modalVisit = {
          contentId: item.id,
          contentType: item.type || "knowledge",
          depthLevel: item.depthLevel || 1,
          startedAt: Date.now(),
        };

        await trackSessionEvent("click", {
          contentId: item.id,
          contentType: item.type || "knowledge",
          depthLevel: item.depthLevel || 1,
        });
      }

      function modalPayload(extra) {
        if (!state.modalItem) return null;
        return {
          contentId: state.modalItem.id,
          contentType: state.modalItem.type || "knowledge",
          depthLevel: state.modalItem.depthLevel || 1,
          ...(extra || {}),
        };
      }

      function clearTimer() {
        if (state.timerId) {
          clearInterval(state.timerId);
          state.timerId = null;
        }
      }

      function formatLeft(totalSeconds) {
        const safe = Math.max(0, Math.floor(totalSeconds));
        const mm = String(Math.floor(safe / 60)).padStart(2, "0");
        const ss = String(safe % 60).padStart(2, "0");
        return mm + ":" + ss;
      }

      function startTimer() {
        clearTimer();
        const endTs = state.startedAt + state.durationSeconds * 1000;
        const tick = () => {
          const now = Date.now();
          const elapsed = Math.max(0, now - state.startedAt);
          const ratio = Math.min(1, elapsed / (state.durationSeconds * 1000));
          timerFill.style.width = (ratio * 100).toFixed(2) + "%";
          const leftSec = (endTs - now) / 1000;
          timerText.textContent = "Time left: " + formatLeft(leftSec);
          if (now >= endTs) {
            clearTimer();
            finishSession("timeup");
          }
        };
        tick();
        state.timerId = setInterval(tick, 500);
      }

      function renderMetrics(result) {
        const rows = [
          ["Depth Score", result.metrics.depthScore],
          ["Speed Score", result.metrics.speedScore],
          ["Exploration Score", result.metrics.explorationScore],
          ["Emotion Score", result.metrics.emotionScore],
          ["Social Score", result.metrics.socialScore],
          ["Goal Score", result.metrics.goalScore],
          ["Collect Score", result.metrics.collectScore],
        ];
        metricsPanel.innerHTML = rows
          .map((row) => {
            const name = row[0];
            const val = Number(row[1] || 0);
            return (
              "<div class='metric-bar'>" +
              "<div class='metric-label'>" + name + ": " + val.toFixed(1) + "</div>" +
              "<div class='metric-track'><div class='metric-fill' style='width:" + Math.max(0, Math.min(100, val)).toFixed(2) + "%'></div></div>" +
              "</div>"
            );
          })
          .join("");
      }

      function drawRadar(metrics) {
        const labels = [
          ["Depth", Number(metrics.depthScore || 0)],
          ["Speed", Number(metrics.speedScore || 0)],
          ["Explore", Number(metrics.explorationScore || 0)],
          ["Emotion", Number(metrics.emotionScore || 0)],
          ["Social", Number(metrics.socialScore || 0)],
        ];
        const cx = 160;
        const cy = 120;
        const maxR = 78;
        const start = -90;
        const step = 360 / labels.length;

        function point(radius, deg) {
          const rad = (deg * Math.PI) / 180;
          return {
            x: cx + radius * Math.cos(rad),
            y: cy + radius * Math.sin(rad),
          };
        }

        const grid = [];
        for (let layer = 1; layer <= 5; layer += 1) {
          const r = (maxR / 5) * layer;
          const poly = labels
            .map((_, idx) => {
              const p = point(r, start + idx * step);
              return p.x.toFixed(1) + "," + p.y.toFixed(1);
            })
            .join(" ");
          grid.push("<polygon points='" + poly + "' fill='none' stroke='#d9e2ef'/>");
        }

        const axes = labels
          .map((item, idx) => {
            const p = point(maxR, start + idx * step);
            const textP = point(maxR + 16, start + idx * step);
            return (
              "<line x1='" + cx + "' y1='" + cy + "' x2='" + p.x.toFixed(1) + "' y2='" + p.y.toFixed(1) + "' stroke='#d9e2ef'/>" +
              "<text x='" + textP.x.toFixed(1) + "' y='" + textP.y.toFixed(1) + "' fill='#64748b' font-size='11' text-anchor='middle'>" +
              item[0] +
              "</text>"
            );
          })
          .join("");

        const dataPoly = labels
          .map((item, idx) => {
            const score = Math.max(0, Math.min(100, item[1]));
            const p = point((score / 100) * maxR, start + idx * step);
            return p.x.toFixed(1) + "," + p.y.toFixed(1);
          })
          .join(" ");

        radarSvg.innerHTML =
          "<rect x='0' y='0' width='320' height='240' fill='#f8fbff'/>" +
          grid.join("") +
          axes +
          "<polygon points='" + dataPoly + "' fill='rgba(37,99,235,0.22)' stroke='#2563eb' stroke-width='2'/>";
      }

      function drawTrajectory(points, durationSeconds) {
        const width = 640;
        const height = 240;
        const padX = 36;
        const padY = 22;
        const plotW = width - padX * 2;
        const timelineY = 94;
        const eventStyles = {
          click: { label: "Click", color: "#2563eb" },
          search: { label: "Search", color: "#0ea5e9" },
          dwell_end: { label: "Read End", color: "#14b8a6" },
          scroll: { label: "Scroll", color: "#f59e0b" },
          share: { label: "Share", color: "#ec4899" },
          comment: { label: "Comment", color: "#9333ea" },
          interaction: { label: "Interact", color: "#8b5cf6" },
          bookmark: { label: "Bookmark", color: "#22c55e" },
          backtrack: { label: "Backtrack", color: "#ef4444" },
          refresh: { label: "Refresh", color: "#f97316" },
        };
        const base =
          "<rect x='0' y='0' width='" + width + "' height='" + height + "' fill='#f8fbff'/>" +
          "<line x1='" + padX + "' y1='" + timelineY + "' x2='" + (width - padX) + "' y2='" + timelineY + "' stroke='#d9e2ef'/>";
        if (!Array.isArray(points) || points.length < 1) {
          trajectorySvg.innerHTML = base + "<text x='320' y='120' text-anchor='middle' fill='#64748b' font-size='13'>No operation data in this session.</text>";
          return;
        }

        const maxPointSec = points.reduce((max, item) => {
          const elapsedSec = Number(item && item.elapsedSec);
          return Math.max(max, Number.isFinite(elapsedSec) ? elapsedSec : 0);
        }, 0);
        const safeDuration = Math.max(1, Number(durationSeconds || 300), maxPointSec);
        const ticks = 6;
        const tickMarks = [];
        for (let i = 0; i < ticks; i += 1) {
          const ratio = i / (ticks - 1);
          const elapsed = ratio * safeDuration;
          const x = padX + ratio * plotW;
          const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
          const seconds = String(Math.floor(elapsed % 60)).padStart(2, "0");
          tickMarks.push(
            "<line x1='" + x.toFixed(1) + "' y1='" + (timelineY + 2) + "' x2='" + x.toFixed(1) + "' y2='" + (timelineY + 9) + "' stroke='#cbd5e1'/>" +
              "<text x='" + x.toFixed(1) + "' y='" + (timelineY + 24) + "' fill='#64748b' font-size='10.5' text-anchor='middle'>" +
              minutes +
              ":" +
              seconds +
              "</text>",
          );
        }

        const stackedBySecond = new Map();
        const offsets = [0, -8, 8, -16, 16, -24, 24];
        const timelinePoints = points
          .map((item) => {
            const elapsed = Math.max(0, Math.min(safeDuration, Number(item.elapsedSec || 0)));
            const secondKey = Math.round(elapsed * 2) / 2;
            const stackIndex = stackedBySecond.get(secondKey) || 0;
            stackedBySecond.set(secondKey, stackIndex + 1);
            const style = eventStyles[item.eventType] || { label: item.eventType || "Event", color: "#64748b" };
            const x = padX + (elapsed / safeDuration) * plotW;
            const offset = offsets[stackIndex % offsets.length] - Math.floor(stackIndex / offsets.length) * 4;
            const y = timelineY + offset;
            const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
            const seconds = String(Math.floor(elapsed % 60)).padStart(2, "0");
            return {
              x,
              y,
              color: style.color,
              label: style.label,
              hover: style.label + " @ " + minutes + ":" + seconds,
              eventType: item.eventType || "unknown",
            };
          })
          .sort((a, b) => a.x - b.x);

        const dots = timelinePoints
          .map((point) => {
            return (
              "<circle cx='" +
              point.x.toFixed(1) +
              "' cy='" +
              point.y.toFixed(1) +
              "' r='2.6' fill='" +
              point.color +
              "'><title>" +
              escapeHtml(point.hover) +
              "</title></circle>"
            );
          })
          .join("");

        const usedTypes = [];
        for (const point of timelinePoints) {
          if (!usedTypes.includes(point.eventType)) {
            usedTypes.push(point.eventType);
          }
        }
        const legendHeight = Math.max(36, usedTypes.length * 16 + 14);
        const legendY = height - padY - legendHeight;
        const legendItems = usedTypes
          .map((type, index) => {
            const style = eventStyles[type] || { label: type, color: "#64748b" };
            const y = legendY + 12 + index * 16;
            return (
              "<circle cx='478' cy='" +
              y +
              "' r='4' fill='" +
              style.color +
              "'/>" +
              "<text x='488' y='" +
              (y + 3) +
              "' fill='#334155' font-size='11'>" +
              escapeHtml(style.label) +
              "</text>"
            );
          })
          .join("");

        trajectorySvg.innerHTML =
          base +
          tickMarks.join("") +
          dots +
          "<text x='" + padX + "' y='18' fill='#64748b' font-size='11'>Each colored dot is an operation over time</text>" +
          "<text x='" + (width - padX) + "' y='" + (timelineY + 24) + "' text-anchor='end' fill='#64748b' font-size='11'>Time</text>" +
          "<g>" +
          "<rect x='466' y='" +
          legendY +
          "' width='144' height='" +
          legendHeight +
          "' rx='8' fill='rgba(255,255,255,0.92)' stroke='#d9e2ef'/>" +
          legendItems +
          "</g>";
      }

      function drawPoster(result) {
        const canvas = posterCanvas;
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, "#e8f2ff");
        grad.addColorStop(1, "#f2f7ff");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Load and draw persona image
        const personaImagePath = getPersonaImagePath(result.persona.primary);
        const img = new Image();
        img.onload = () => {
          // Draw image with aspect ratio preservation
          const imgWidth = 200;
          const imgHeight = 200;
          const imgX = (w - imgWidth) / 2;
          const imgY = 220;
          ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);
          drawPosterText(ctx, w, h, result);
        };
        img.onerror = () => {
          drawPosterText(ctx, w, h, result);
        };
        img.src = personaImagePath;
      }

      function drawPosterText(ctx, w, h, result) {
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 44px Inter, Segoe UI, sans-serif";
        ctx.fillText("WBTI Report", 40, 82);
        ctx.font = "26px Inter, Segoe UI, sans-serif";
        ctx.fillText(result.persona.primary, 40, 128);
        ctx.fillStyle = "#334155";
        ctx.font = "21px Inter, Segoe UI, sans-serif";
        ctx.fillText("Secondary: " + result.persona.secondary + " (" + result.persona.secondaryPct.toFixed(0) + "%)", 40, 162);
        ctx.fillText("MBTI tendency: " + result.mbtiHint, 40, 194);

        const rows = [
          ["Depth", result.metrics.depthScore],
          ["Speed", result.metrics.speedScore],
          ["Explore", result.metrics.explorationScore],
          ["Emotion", result.metrics.emotionScore],
          ["Social", result.metrics.socialScore],
        ];
        let y = 480;
        for (const row of rows) {
          const name = row[0];
          const score = Number(row[1] || 0);
          ctx.fillStyle = "#0f172a";
          ctx.font = "20px Inter, Segoe UI, sans-serif";
          ctx.fillText(name, 42, y);
          ctx.fillStyle = "#dbe7ff";
          ctx.fillRect(180, y - 16, 430, 14);
          ctx.fillStyle = "#2563eb";
          ctx.fillRect(180, y - 16, (430 * Math.max(0, Math.min(100, score))) / 100, 14);
          ctx.fillStyle = "#334155";
          ctx.fillText(score.toFixed(1), 626, y);
          y += 54;
        }

        ctx.fillStyle = "#334155";
        ctx.font = "18px Inter, Segoe UI, sans-serif";
        const desc = (result.explanation || []).join(" ");
        wrapText(ctx, desc, 42, 750, 636, 28);
        ctx.fillText("Topic: " + (result.topic || ""), 42, 870);
      }

      function getPersonaImagePath(personaName) {
        // Map persona names to image file names
        const imageMap = {
          "Analyzer": "https://raw.githubusercontent.com/ziyi170/hackthon430/refs/heads/WBTI/public/analyzer.png",
          "Collector": "https://raw.githubusercontent.com/ziyi170/hackthon430/refs/heads/WBTI/public/collector.png",
          "Deep Diver": "https://raw.githubusercontent.com/ziyi170/hackthon430/refs/heads/WBTI/public/deepdiver.png",
          "Emotional Drifter": "https://raw.githubusercontent.com/ziyi170/hackthon430/refs/heads/WBTI/public/emotionaldrifter.png",
          "Goal Hunter": "https://raw.githubusercontent.com/ziyi170/hackthon430/refs/heads/WBTI/public/goalhunter.png",
          "Rapid Scroller": "https://raw.githubusercontent.com/ziyi170/hackthon430/refs/heads/WBTI/public/rapidscroller.png",
          "Social Radar": "https://raw.githubusercontent.com/ziyi170/hackthon430/refs/heads/WBTI/public/socialradar.png",
          "Wanderer": "https://raw.githubusercontent.com/ziyi170/hackthon430/refs/heads/WBTI/public/wanderer.png",
        };
        return imageMap[personaName] || "https://raw.githubusercontent.com/ziyi170/hackthon430/refs/heads/WBTI/public/analyzer.png";
      }

      function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = String(text || "").split(" ");
        let line = "";
        let cursorY = y;
        for (const word of words) {
          const test = line ? line + " " + word : word;
          if (ctx.measureText(test).width > maxWidth && line) {
            ctx.fillText(line, x, cursorY);
            line = word;
            cursorY += lineHeight;
          } else {
            line = test;
          }
        }
        if (line) {
          ctx.fillText(line, x, cursorY);
        }
      }

      function toBlob(canvas) {
        return new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob), "image/png");
        });
      }

      async function finishSession(reason) {
        if (!state.sessionId || state.finishing) return;
        state.finishing = true;
        if (state.modalVisit) {
          closeResultModal(false);
        }
        clearTimer();
        setStage(reportStage);
        reportHeader.textContent = reason === "manual" ? "Finishing test by user action..." : "5-minute limit reached. Generating report...";
        personaText.textContent = "";
        explainText.textContent = "";
        mbtiText.textContent = "";
        metricsPanel.innerHTML = "";
        radarSvg.innerHTML = "";
        trajectorySvg.innerHTML = "";
        try {
          const payload = await request("/api/session/finish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: state.sessionId }),
          });
          const result = payload.result;
          reportHeader.textContent = "WBTI report generated for topic: " + (result.topic || "");
          state.result = result;
          // Set persona image
          const personaImageElement = document.getElementById("personaImage");
          if (personaImageElement) {
            personaImageElement.src = getPersonaImagePath(result.persona.primary);
            personaImageElement.alt = result.persona.primary;
          }
          personaText.textContent =
            "Primary: " + result.persona.primary + " | Secondary: " + result.persona.secondary + " (" + result.persona.secondaryPct.toFixed(0) + "%)";
          explainText.textContent = (result.explanation || []).join(" ");
          mbtiText.textContent = "MBTI tendency: " + result.mbtiHint;
          renderMetrics(result);
          drawRadar(result.metrics || {});
          drawTrajectory(result.trajectory || [], result.actualDurationSeconds || state.durationSeconds || 300);
          drawPoster(result);
        } catch (error) {
          reportHeader.textContent = "Failed to generate report.";
          explainText.textContent = String(error.message || error);
        } finally {
          state.finishing = false;
        }
      }

      startBtn.addEventListener("click", async () => {
        startBtn.disabled = true;
        try {
          await startSession();
        } catch (error) {
          setStage(landingStage);
          selectedTopicTitle.textContent = "Failed: " + error.message;
        } finally {
          startBtn.disabled = false;
        }
      });

      shuffleBtn.addEventListener("click", () => {
        if (!state.topics.length) return;
        state.topic = state.topics[Math.floor(Math.random() * state.topics.length)];
        selectedTopicTitle.textContent = state.topic.title;
        renderTopicOptions();
      });

      searchBtn.addEventListener("click", () => {
        const keyword = searchInput.value.trim();
        applyKeywordFilter(keyword);
        trackSearch(keyword);
      });
      refreshCardsBtn.addEventListener("click", () => {
        refreshCardsBtn.disabled = true;
        const original = refreshCardsBtn.textContent;
        refreshCardsBtn.textContent = "Refreshed";
        refreshVisibleCards();
        setTimeout(() => {
          refreshCardsBtn.disabled = false;
          refreshCardsBtn.textContent = original;
        }, 450);
      });
      refreshDebugBtn.addEventListener("click", () => {
        refreshTavilyDebug().catch((error) => {
          debugStatus.textContent = "Live debug fetch failed: " + String(error.message || error);
        });
      });
      clearCacheDebugBtn.addEventListener("click", () => {
        clearTavilyCache().catch((error) => {
          debugStatus.textContent = "Clear cache failed: " + String(error.message || error);
        });
      });
      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          searchBtn.click();
        }
      });
      document.addEventListener(
        "wheel",
        (event) => {
          trackScrollSample(event.deltaY);
        },
        { passive: true },
      );

      backBtn.addEventListener("click", () => {
        if (state.modalVisit) {
          closeResultModal(true);
        }
        clearTimer();
        setStage(landingStage);
      });
      endTestBtn.addEventListener("click", () => finishSession("manual"));
      restartBtn.addEventListener("click", () => {
        if (state.modalVisit) {
          closeResultModal(false);
        }
        clearTimer();
        state.sessionId = "";
        state.result = null;
        state.tavilyDebug = null;
        state.allCards = [];
        state.cards = [];
        state.visibleCards = [];
        state.impressedIds = new Set();
        state.bookmarkedIds = new Set();
        state.modalItem = null;
        state.modalVisit = null;
        debugStatus.textContent = "No debug data yet.";
        debugJson.textContent = "{}";
        tavilyDebugShell.open = false;
        setStage(landingStage);
      });

      downloadPosterBtn.addEventListener("click", async () => {
        if (!state.result) return;
        const blob = await toBlob(posterCanvas);
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "wbti-share-poster.png";
        a.click();
        URL.revokeObjectURL(url);
      });

      copyShareBtn.addEventListener("click", async () => {
        if (!state.result) return;
        const text =
          "My WBTI type is " +
          state.result.persona.primary +
          ", MBTI tendency " +
          state.result.mbtiHint +
          ", topic: " +
          state.result.topic;
        try {
          await navigator.clipboard.writeText(text);
          copyShareBtn.textContent = "Copied";
          setTimeout(() => {
            copyShareBtn.textContent = "Copy Share Text";
          }, 1200);
        } catch (error) {
          console.warn("Copy failed:", error.message);
        }
      });

      bookmarkBtn.addEventListener("click", () => {
        if (!state.modalItem || state.bookmarkedIds.has(state.modalItem.id)) return;
        state.bookmarkedIds.add(state.modalItem.id);
        updateBookmarkButton();
        const payload = modalPayload();
        if (payload) {
          trackSessionEvent("bookmark", payload);
        }
      });

      shareBtn.addEventListener("click", async () => {
        if (!state.modalItem) return;
        const payload = modalPayload();
        if (!payload) return;
        try {
          await navigator.clipboard.writeText(state.modalItem.url || "");
          shareBtn.textContent = "Shared";
          setTimeout(() => {
            shareBtn.textContent = "Share";
          }, 900);
        } catch (error) {
          console.warn("Share copy failed:", error.message || error);
        }
        trackSessionEvent("share", payload);
      });

      commentBtn.addEventListener("click", () => {
        if (!state.modalItem) return;
        const text = window.prompt("Leave a quick comment on this source:");
        const commentText = String(text || "").trim();
        if (!commentText) return;
        const payload = modalPayload({ length: commentText.length });
        if (payload) {
          trackSessionEvent("comment", payload);
        }
      });

      interactBtn.addEventListener("click", () => {
        if (!state.modalItem) return;
        const payload = modalPayload({ kind: "reaction" });
        if (payload) {
          trackSessionEvent("interaction", payload);
        }
        interactBtn.textContent = "Interacted";
        setTimeout(() => {
          interactBtn.textContent = "Interact";
        }, 850);
      });

      closeModalBtn.addEventListener("click", () => {
        closeResultModal(true);
      });

      resultModal.addEventListener("click", (event) => {
        if (event.target === resultModal) {
          closeResultModal(true);
        }
      });

      loadTopics().catch((error) => {
        selectedTopicTitle.textContent = "Topic loading failed: " + error.message;
        startBtn.disabled = true;
        shuffleBtn.disabled = true;
      });
    })();
  </script>
</body>
</html>
  `;
}

app.listen(port, () => {
  console.log("WBTI behavior server listening on port " + port);
});
