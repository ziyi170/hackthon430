const http = require("http");
const WebSocket = require("ws");
const fs = require("fs");
const path = require("path");

// ── Constants ────────────────────────────────────────────────────────────────
const W = 800, H = 600;
const PADDLE_H = 100, PADDLE_W = 12;
const BALL_SIZE = 12;
const WINNING_SCORE = 7;

// ── Game State ───────────────────────────────────────────────────────────────
function freshState() {
  return {
    ball: { x: W / 2, y: H / 2, vx: 4, vy: 3 },
    paddles: { left: H / 2 - PADDLE_H / 2, right: H / 2 - PADDLE_H / 2 },
    scores: { left: 0, right: 0 },
    mode: null,           // "single" | "multi"
    status: "idle",       // "idle" | "waiting" | "playing" | "finished"
    winner: null,
  };
}

let state = freshState();
const seats = { left: null, right: null };

// ── Ball helpers ─────────────────────────────────────────────────────────────
function resetBall(towardsRight) {
  const dir = towardsRight ? 1 : -1;
  state.ball = {
    x: W / 2,
    y: H / 2,
    vx: dir * (3 + Math.random() * 2),
    vy: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 2),
  };
}

// ── AI (single player) ───────────────────────────────────────────────────────
function tickAI() {
  const target = state.ball.y - PADDLE_H / 2;
  const diff = target - state.paddles.right;
  const speed = 4;
  state.paddles.right = Math.max(
    0,
    Math.min(H - PADDLE_H, state.paddles.right + Math.sign(diff) * Math.min(Math.abs(diff), speed))
  );
}

// ── Physics ──────────────────────────────────────────────────────────────────
function tick() {
  if (state.status !== "playing") return;
  if (state.mode === "single") tickAI();

  const b = state.ball;
  b.x += b.vx;
  b.y += b.vy;

  // Top / bottom wall bounce
  if (b.y <= 0) { b.y = 0; b.vy = Math.abs(b.vy); }
  if (b.y >= H - BALL_SIZE) { b.y = H - BALL_SIZE; b.vy = -Math.abs(b.vy); }

  // Left paddle hit
  const lp = state.paddles.left;
  if (b.vx < 0 && b.x <= 20 + PADDLE_W && b.x >= 16 && b.y + BALL_SIZE >= lp && b.y <= lp + PADDLE_H) {
    b.x = 20 + PADDLE_W;
    b.vx = Math.abs(b.vx) * 1.04;
    b.vy += (b.y + BALL_SIZE / 2 - (lp + PADDLE_H / 2)) * 0.08;
  }

  // Right paddle hit
  const rp = state.paddles.right;
  if (b.vx > 0 && b.x + BALL_SIZE >= W - 20 - PADDLE_W && b.x + BALL_SIZE <= W - 16 && b.y + BALL_SIZE >= rp && b.y <= rp + PADDLE_H) {
    b.x = W - 20 - PADDLE_W - BALL_SIZE;
    b.vx = -Math.abs(b.vx) * 1.04;
    b.vy += (b.y + BALL_SIZE / 2 - (rp + PADDLE_H / 2)) * 0.08;
  }

  // Clamp ball speed
  const maxSpeed = 14;
  const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  if (speed > maxSpeed) { b.vx = (b.vx / speed) * maxSpeed; b.vy = (b.vy / speed) * maxSpeed; }

  // Scoring
  if (b.x + BALL_SIZE < 0) {
    state.scores.right++;
    checkWin() || resetBall(true);
  }
  if (b.x > W) {
    state.scores.left++;
    checkWin() || resetBall(false);
  }
}

function checkWin() {
  if (state.scores.left >= WINNING_SCORE) { state.status = "finished"; state.winner = "left"; return true; }
  if (state.scores.right >= WINNING_SCORE) { state.status = "finished"; state.winner = "right"; return true; }
  return false;
}

// ── HTTP server ──────────────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
  const filePath = path.join(__dirname, urlPath);
  try {
    const ext = path.extname(filePath);
    res.setHeader("Content-Type", MIME[ext] || "text/plain");
    res.end(fs.readFileSync(filePath));
  } catch {
    res.writeHead(404);
    res.end("Not found: " + urlPath);
  }
});

// ── WebSocket ─────────────────────────────────────────────────────────────────
const wss = new WebSocket.Server({ server, path: "/ws", perMessageDeflate: false, skipUTF8Validation: true });
const clients = new Set();

function send(ws, msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(msg) {
  const str = JSON.stringify(msg);
  for (const c of clients) if (c.readyState === WebSocket.OPEN) c.send(str);
}

function publicState() {
  // Don't serialise the socket refs in seats
  return {
    ball: state.ball,
    paddles: state.paddles,
    scores: state.scores,
    mode: state.mode,
    status: state.status,
    winner: state.winner,
    seatsOccupied: { left: !!seats.left, right: !!seats.right },
  };
}

wss.on("connection", (ws) => {
  clients.add(ws);

  // Assign a seat if available
  let mySeat = null;
  if (!seats.left) { seats.left = ws; mySeat = "left"; }
  else if (!seats.right && state.mode === "multi") { seats.right = ws; mySeat = "right"; }

  send(ws, { type: "welcome", seat: mySeat, state: publicState() });

  // If joining as player 2 while waiting
  if (mySeat === "right" && state.status === "waiting") {
    state.status = "playing";
    broadcast({ type: "state", state: publicState() });
  }

  ws.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    if (msg.type === "choose_mode") {
      state = freshState();
      seats.left = ws; seats.right = null;
      mySeat = "left";
      state.mode = msg.mode;
      state.status = msg.mode === "single" ? "playing" : "waiting";
      resetBall(true);
      // Re-confirm seat to this client so their mySeat is updated
      send(ws, { type: "welcome", seat: mySeat, state: publicState() });
      broadcast({ type: "state", state: publicState() });
    }

    if (msg.type === "paddle_move" && state.status === "playing") {
      const y = Math.max(0, Math.min(H - PADDLE_H, msg.y));
      // Resolve seat from the live seats map, not the closure variable
      const side = seats.left === ws ? "left" : seats.right === ws ? "right" : null;
      if (side === "left") state.paddles.left = y;
      if (side === "right" && state.mode === "multi") state.paddles.right = y;
    }

    if (msg.type === "restart") {
      state = freshState();
      seats.left = ws; seats.right = null;
      mySeat = "left";
      broadcast({ type: "state", state: publicState() });
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    if (seats.left === ws) seats.left = null;
    if (seats.right === ws) seats.right = null;
    if (state.status === "playing" && ((!seats.left && state.mode === "multi") || !seats.right && state.mode === "multi")) {
      state.status = "waiting";
      broadcast({ type: "state", state: publicState() });
    }
  });
});

// ── Game loop (60 fps) ───────────────────────────────────────────────────────
setInterval(() => {
  tick();
  broadcast({ type: "state", state: publicState() });
}, 1000 / 60);

server.listen(3000, () => console.log("🏓 Pong server running on port 3000"));
