const express = require("express");
const crypto = require("crypto");
const { tavily } = require("@tavily/core");

const app = express();
const port = 3000;

const SESSION_DURATION_SECONDS = 300;
const CONTENTS_PER_TYPE = 14;
const MAX_EVENTS_PER_SESSION = 5000;
const INITIAL_FEED_SIZE = 6;
const FEED_SIZE = 16;
const TAVILY_DEFAULT_KEY = "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";
const tavilyApiKey = process.env.TAVILY_API_KEY || TAVILY_DEFAULT_KEY;
const tavilyClient = tavilyApiKey ? tavily({ apiKey: tavilyApiKey }) : null;

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
  { id: "media-culture", title: "Why Do Media Narratives Spread So Fast?", seed: "Media and Culture" },
];

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
let sessionCounter = 0;

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

function sanitizeSourceUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  return "";
}

async function fetchTopicSources(topic) {
  const cacheKey = topic.id;
  if (topicSourceCache.has(cacheKey)) {
    return topicSourceCache.get(cacheKey);
  }

  if (!tavilyClient) {
    topicSourceCache.set(cacheKey, []);
    return [];
  }

  const query = `i want to seach ${topic.title}`;
  try {
    const response = await tavilyClient.search(query, {
      searchDepth: "advanced",
      maxResults: 8,
      chunksPerSource: 1,
    });
    const normalized = Array.isArray(response?.results)
      ? response.results
          .map((item) => {
            return {
              url: sanitizeSourceUrl(item?.url),
              title: compactText(item?.title || "", 120),
              content: compactText(item?.content || "", 220),
              favicon: sanitizeSourceUrl(item?.favicon),
            };
          })
          .filter((item) => item.url)
      : [];

    topicSourceCache.set(cacheKey, normalized);
    return normalized;
  } catch (error) {
    console.warn("Tavily fetch failed:", topic.title, error?.message || error);
    topicSourceCache.set(cacheKey, []);
    return [];
  }
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
  const clicks = session.events.filter((item) => item.eventType === "click");
  const typeAxis = {
    knowledge: 15,
    emotion: 45,
    entertainment: 70,
    social: 90,
  };
  const points = clicks.map((click, index) => {
    const elapsedSec = Math.max(0, (click.ts - session.startedAt) / 1000);
    return {
      index: index + 1,
      elapsedSec,
      y: typeAxis[click.contentType] || 50,
      contentId: click.contentId,
      contentType: click.contentType,
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
  const bookmarks = events.filter((item) => item.eventType === "bookmark");
  const backtracks = events.filter((item) => item.eventType === "backtrack");

  const avgDwellMs = average(dwells.map((item) => safeNumber(item.payload?.durationMs)));
  const avgScrollSpeed = average(scrolls.map((item) => safeNumber(item.payload?.speed)));
  const shortDwellRate = dwells.length
    ? dwells.filter((item) => safeNumber(item.payload?.durationMs) <= 5000).length / dwells.length
    : 0;
  const deepClickRate = clicks.length
    ? clicks.filter((item) => safeNumber(item.payload?.depthLevel) >= 4).length / clicks.length
    : 0;
  const clickRate = impressions.length ? clicks.length / impressions.length : 0;

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

  const totalClicks = clicks.length || 1;
  const typeValues = Object.values(typeClicks);
  const nonZeroTypes = typeValues.filter((item) => item > 0).length;
  const probabilities = typeValues.map((n) => n / totalClicks).filter((p) => p > 0);
  const entropy = probabilities.length
    ? -probabilities.reduce((sum, p) => sum + p * Math.log2(p), 0) / Math.log2(4)
    : 0;

  const splitTs = session.startedAt + SESSION_DURATION_SECONDS * 1000 * 0.4;
  const firstPhaseClicks = clicks.filter((item) => item.ts <= splitTs).length;
  const secondPhaseClicks = clicks.length - firstPhaseClicks;
  const pathTransitions = clicks.length > 1 ? clicks.length - 1 : 0;
  const backtrackRate = pathTransitions ? backtracks.length / pathTransitions : 0;
  const firstClickHitRate = clickRate > 0.25 ? 1 : clickRate / 0.25;
  const validReads = dwells.filter((item) => safeNumber(item.payload?.durationMs) > 2500).length;

  const depthScore =
    (normalize(avgDwellMs, 2000, 42000) * 0.55 + normalize(clickRate, 0.05, 0.8) * 0.2 + deepClickRate * 0.25) * 100;
  const speedScore = (normalize(avgScrollSpeed, 0.2, 6) * 0.6 + shortDwellRate * 0.4) * 100;
  const explorationScore = ((nonZeroTypes / 4) * 0.5 + entropy * 0.5) * 100;
  const emotionScore = (typeClicks.emotion / totalClicks) * 100;
  const socialScore = ((shares.length + comments.length) / Math.max(events.length, 1)) * 360;
  const goalScore = ((1 - backtrackRate) * 0.5 + clamp(firstClickHitRate, 0, 1) * 0.5) * 100;
  const collectScore = (bookmarks.length / Math.max(validReads, 1)) * 100;

  return {
    depthScore: clamp(depthScore, 0, 100),
    speedScore: clamp(speedScore, 0, 100),
    explorationScore: clamp(explorationScore, 0, 100),
    emotionScore: clamp(emotionScore, 0, 100),
    socialScore: clamp(socialScore, 0, 100),
    goalScore: clamp(goalScore, 0, 100),
    collectScore: clamp(collectScore, 0, 100),
    stats: {
      totalEvents: events.length,
      totalClicks: clicks.length,
      totalImpressions: impressions.length,
      avgDwellMs,
      avgScrollSpeed,
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
    endedAt: new Date().toISOString(),
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
  const sources = await fetchTopicSources(session.topic);
  session.contentPool = enrichContentPoolWithSources(session.contentPool, session.topic, sources);
  const feed = buildFeed(session, INITIAL_FEED_SIZE, false);
  const searchKeyword = `i want to seach ${session.topic.title}`;
  res.json({
    ok: true,
    sessionId: session.sessionId,
    topic: session.topic,
    searchKeyword,
    sourceCount: sources.length,
    searchResults: sources.slice(0, 5),
    durationSeconds: SESSION_DURATION_SECONDS,
    contentPool: session.contentPool,
    feed,
    startedAt: session.startedAt,
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

  const allowList = new Set(["impression", "click", "dwell_end", "scroll", "backtrack", "share", "comment", "bookmark", "search"]);
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
      display: grid;
      align-content: start;
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
      margin: 10px auto 0;
      width: min(760px, 100%);
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
    .source-link {
      margin-top: 12px;
      word-break: break-all;
      font-size: 0.9rem;
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
          <p id="loadingText" class="muted">Running Tavily search.</p>
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
              <input id="searchInput" class="search-input" type="text" placeholder="Search in current Tavily results..." />
              <button id="searchBtn" class="ghost" type="button">Search</button>
              <button id="endTestBtn" type="button">End Test</button>
              <button id="backBtn" class="ghost" type="button">Back</button>
            </div>
          </div>
          <div class="timer-row">
            <div class="timer-track"><div id="timerFill" class="timer-fill"></div></div>
            <div id="timerText" class="timer-text">Time left: 05:00</div>
          </div>
        </div>
        <div class="cards-wrap">
          <p class="muted" style="margin-top:0;">Top 5 Tavily results</p>
          <div id="cardsGrid" class="cards-grid"></div>
        </div>
      </div>
    </section>
    <section id="reportStage" class="stage">
      <h2>WBTI Report</h2>
      <p id="reportHeader" class="muted">Analyzing...</p>
      <div class="report-grid">
        <article class="report-card">
          <h3>Personality Summary</h3>
          <p id="personaText" class="muted"></p>
          <p id="explainText" class="muted"></p>
          <div id="metricsPanel"></div>
        </article>
        <article class="report-card">
          <h3>Radar Profile</h3>
          <p id="mbtiText" class="muted"></p>
          <svg id="radarSvg" viewBox="0 0 320 240"></svg>
          <h3 style="margin-top:12px;">Click Frequency Timeline</h3>
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
      <div class="source-link">
        Source:
        <a id="modalLink" href="#" target="_blank" rel="noreferrer">Open original page</a>
      </div>
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
      const endTestBtn = document.getElementById("endTestBtn");
      const backBtn = document.getElementById("backBtn");
      const timerFill = document.getElementById("timerFill");
      const timerText = document.getElementById("timerText");
      const cardsGrid = document.getElementById("cardsGrid");
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
      const modalLink = document.getElementById("modalLink");
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
        cards: [],
        visibleCards: [],
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
        loadingText.textContent = "Running Tavily search for: i want to seach " + state.topic.title;

        const payload = await request("/api/session/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicId: state.topic && state.topic.id }),
        });

        state.sessionId = payload.sessionId;
        state.result = null;
        state.startedAt = payload.startedAt || Date.now();
        state.durationSeconds = payload.durationSeconds || 300;
        searchTopicTitle.textContent = payload.topic.title;

        const bySource = new Map();
        const topFromTavily = Array.isArray(payload.searchResults) ? payload.searchResults : [];
        for (const item of topFromTavily) {
          const url = String(item.url || "").trim();
          if (!url || bySource.has(url)) continue;
          bySource.set(url, {
            id: url,
            title: item.title || "Untitled source",
            content: item.content || "No content snippet available.",
            url,
            favicon: item.favicon || "",
            source: "tavily",
          });
        }

        if (bySource.size < 5 && Array.isArray(payload.contentPool)) {
          for (const content of payload.contentPool) {
            const url = String(content.sourceUrl || "").trim();
            if (!url || bySource.has(url)) continue;
            bySource.set(url, {
              id: content.id,
              title: content.sourceTitle || content.title || "Untitled source",
              content: content.sourceSnippet || content.summary || "No content snippet available.",
              url,
              favicon: content.sourceFavicon || "",
              source: "pool",
              type: content.type || "",
              depthLevel: content.depthLevel || 1,
            });
            if (bySource.size >= 5) break;
          }
        }

        state.cards = Array.from(bySource.values()).slice(0, 5);
        state.visibleCards = state.cards.slice();

        if (payload.searchKeyword) {
          searchInput.value = payload.searchKeyword;
        } else {
          searchInput.value = "i want to seach " + payload.topic.title;
        }
        renderCards();
        setStage(searchStage);
        startTimer();
      }

      function renderCards() {
        if (!state.visibleCards.length) {
          cardsGrid.innerHTML = "<div class='empty'>No matching result. Try another keyword.</div>";
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

      function applyKeywordFilter() {
        const keyword = searchInput.value.trim().toLowerCase();
        if (!keyword) {
          state.visibleCards = state.cards.slice();
        } else {
          state.visibleCards = state.cards.filter((item) => {
            const haystack = (item.title + " " + item.content + " " + item.url).toLowerCase();
            return haystack.includes(keyword);
          });
        }
        renderCards();
      }

      async function trackSearch(keyword) {
        if (!state.sessionId) return;
        try {
          await request("/api/session/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: state.sessionId,
              eventType: "search",
              payload: { keyword },
            }),
          });
        } catch (error) {
          console.warn("Search event failed:", error.message);
        }
      }

      async function openModal(item) {
        modalTitle.textContent = item.title || "Untitled source";
        modalMeta.textContent = hostnameOf(item.url);
        modalContent.textContent = item.content || "No content snippet available.";
        modalLink.href = item.url || "#";
        resultModal.classList.add("active");

        if (state.sessionId) {
          try {
            await request("/api/session/event", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: state.sessionId,
                eventType: "click",
                payload: {
                  contentId: item.id,
                  contentType: item.type || "knowledge",
                  depthLevel: item.depthLevel || 1,
                },
              }),
            });
          } catch (error) {
            console.warn("Click event failed:", error.message);
          }
        }
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
        const padX = 44;
        const padY = 24;
        const plotW = width - padX * 2;
        const plotH = height - padY * 2;
        const base =
          "<rect x='0' y='0' width='" + width + "' height='" + height + "' fill='#f8fbff'/>" +
          "<line x1='" + padX + "' y1='" + (height - padY) + "' x2='" + (width - padX) + "' y2='" + (height - padY) + "' stroke='#d9e2ef'/>" +
          "<line x1='" + padX + "' y1='" + padY + "' x2='" + padX + "' y2='" + (height - padY) + "' stroke='#d9e2ef'/>";
        if (!Array.isArray(points) || points.length < 1) {
          trajectorySvg.innerHTML = base + "<text x='320' y='120' text-anchor='middle' fill='#64748b' font-size='13'>Not enough click data for trajectory.</text>";
          return;
        }

        const bins = 20;
        const safeDuration = Math.max(1, Number(durationSeconds || 300));
        const binSeconds = safeDuration / bins;
        const counts = new Array(bins).fill(0);
        for (const point of points) {
          const elapsed = Math.max(0, Number(point.elapsedSec || 0));
          const idx = Math.min(bins - 1, Math.floor(elapsed / binSeconds));
          counts[idx] += 1;
        }
        const maxCount = Math.max(1, ...counts);
        const converted = counts.map((count, idx) => {
          const x = padX + ((idx + 0.5) / bins) * plotW;
          const y = padY + (1 - count / maxCount) * plotH;
          return { x, y, count };
        });
        const path = converted.map((p, i) => (i === 0 ? "M " : "L ") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
        const dots = converted.map((p) => "<circle cx='" + p.x.toFixed(1) + "' cy='" + p.y.toFixed(1) + "' r='2.5' fill='#2563eb'/>").join("");

        trajectorySvg.innerHTML =
          base +
          "<path d='" + path + "' fill='none' stroke='#2563eb' stroke-width='2.3'/>" +
          dots +
          "<text x='52' y='18' fill='#64748b' font-size='11'>Y = click frequency per time window, X = time</text>" +
          "<text x='" + (width - padX) + "' y='" + (height - 6) + "' text-anchor='end' fill='#64748b' font-size='11'>Time</text>" +
          "<text x='" + (padX + 4) + "' y='" + (padY + 12) + "' fill='#64748b' font-size='11'>Freq</text>";
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
        let y = 260;
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
        wrapText(ctx, desc, 42, 580, 636, 28);
        ctx.fillText("Topic: " + (result.topic || ""), 42, 840);
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
          personaText.textContent =
            "Primary: " + result.persona.primary + " | Secondary: " + result.persona.secondary + " (" + result.persona.secondaryPct.toFixed(0) + "%)";
          explainText.textContent = (result.explanation || []).join(" ");
          mbtiText.textContent = "MBTI tendency: " + result.mbtiHint;
          renderMetrics(result);
          drawRadar(result.metrics || {});
          drawTrajectory(result.trajectory || [], state.durationSeconds || 300);
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
        applyKeywordFilter();
        trackSearch(keyword);
      });
      searchInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          searchBtn.click();
        }
      });

      backBtn.addEventListener("click", () => {
        clearTimer();
        setStage(landingStage);
      });
      endTestBtn.addEventListener("click", () => finishSession("manual"));
      restartBtn.addEventListener("click", () => {
        clearTimer();
        state.sessionId = "";
        state.result = null;
        state.cards = [];
        state.visibleCards = [];
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

      closeModalBtn.addEventListener("click", () => {
        resultModal.classList.remove("active");
      });

      resultModal.addEventListener("click", (event) => {
        if (event.target === resultModal) {
          resultModal.classList.remove("active");
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
