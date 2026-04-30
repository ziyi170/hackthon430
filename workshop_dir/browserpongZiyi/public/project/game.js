// ── Canvas setup ─────────────────────────────────────────────────────────────
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const W = 800, H = 600;
const PADDLE_H = 100, PADDLE_W = 12, BALL = 12;

// ── State ─────────────────────────────────────────────────────────────────────
let gs = null;       // latest game state from server
let mySeat = null;   // "left" | "right" | null (spectator)

// ── WebSocket ─────────────────────────────────────────────────────────────────
const proto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${proto}://${location.host}/ws`);

ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);

  if (msg.type === "welcome") {
    mySeat = msg.seat;
    gs = msg.state;
    updateUI();
  }

  if (msg.type === "state") {
    gs = msg.state;
    updateUI();
  }
});

ws.addEventListener("close", () => {
  document.getElementById("message").textContent = "Disconnected from server.";
});

// ── Controls ──────────────────────────────────────────────────────────────────
function sendPaddleMove(clientY) {
  if (!gs || gs.status !== "playing") return;
  if (ws.readyState !== WebSocket.OPEN) return;
  const rect = canvas.getBoundingClientRect();
  const scaleY = H / rect.height;
  const y = (clientY - rect.top) * scaleY - PADDLE_H / 2;
  ws.send(JSON.stringify({ type: "paddle_move", y }));
}

canvas.addEventListener("mousemove", (e) => sendPaddleMove(e.clientY));

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  sendPaddleMove(e.touches[0].clientY);
}, { passive: false });

// ── UI helpers ────────────────────────────────────────────────────────────────
function chooseMode(mode) {
  ws.send(JSON.stringify({ type: "choose_mode", mode }));
  document.getElementById("modeButtons").style.display = "none";

  if (mode === "multi") {
    const box = document.getElementById("shareBox");
    box.style.display = "block";
    document.getElementById("shareLink").value = location.href;
  }
}

function copyLink() {
  const link = document.getElementById("shareLink").value;
  navigator.clipboard.writeText(link).then(() => {
    const btn = document.querySelector("#shareBox button");
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = "Copy"), 1500);
  });
}

function restart() {
  ws.send(JSON.stringify({ type: "restart" }));
  document.getElementById("modeButtons").style.display = "flex";
  document.getElementById("shareBox").style.display = "none";
}

function updateUI() {
  if (!gs) return;
  const msgEl = document.getElementById("message");
  const badge = document.getElementById("seatBadge");
  const modeButtons = document.getElementById("modeButtons");

  if (gs.status === "idle") {
    msgEl.textContent = "Choose a game mode to start";
    msgEl.style.display = "block";
    modeButtons.style.display = "flex";
  } else if (gs.status === "waiting") {
    msgEl.textContent = "⏳ Waiting for Player 2 to join…";
    msgEl.style.display = "block";
    modeButtons.style.display = "none";
  } else if (gs.status === "playing") {
    msgEl.style.display = "none";
    modeButtons.style.display = "none";
  } else if (gs.status === "finished") {
    msgEl.style.display = "block";
    modeButtons.style.display = "none";
    const won = mySeat === gs.winner;
    msgEl.innerHTML = gs.winner
      ? (mySeat ? (won ? "🎉 You win!" : "😢 You lose!") : `${gs.winner.toUpperCase()} wins!`)
      : "";
    // Show restart button once
    if (!document.getElementById("restartBtn")) {
      const btn = document.createElement("button");
      btn.id = "restartBtn";
      btn.textContent = "🔄 Play Again";
      btn.onclick = () => { btn.remove(); restart(); };
      document.querySelector(".btn-row").after(btn);
    }
  }

  if (mySeat) {
    badge.style.display = "inline-block";
    badge.textContent = `You: ${mySeat === "left" ? "⬅ Left paddle" : "➡ Right paddle"}`;
  }
}

// ── Drawing ───────────────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, W, H);

  if (!gs) {
    ctx.fillStyle = "#444";
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Connecting…", W / 2, H / 2);
    requestAnimationFrame(draw);
    return;
  }

  // Centre line
  ctx.setLineDash([12, 12]);
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Scores
  ctx.fillStyle = "#fff";
  ctx.font = "bold 56px monospace";
  ctx.textAlign = "center";
  ctx.fillText(gs.scores.left, W / 2 - 80, 72);
  ctx.fillText(gs.scores.right, W / 2 + 80, 72);

  // Paddles
  const leftColor = mySeat === "left" ? "#4af" : "#fff";
  const rightColor = mySeat === "right" ? "#4af" : "#fff";

  // Left paddle
  ctx.fillStyle = leftColor;
  ctx.shadowColor = leftColor;
  ctx.shadowBlur = mySeat === "left" ? 8 : 0;
  ctx.fillRect(20, gs.paddles.left, PADDLE_W, PADDLE_H);
  ctx.shadowBlur = 0;

  // Right paddle
  ctx.fillStyle = rightColor;
  ctx.shadowColor = rightColor;
  ctx.shadowBlur = mySeat === "right" ? 8 : 0;
  ctx.fillRect(W - 20 - PADDLE_W, gs.paddles.right, PADDLE_W, PADDLE_H);
  ctx.shadowBlur = 0;

  // Ball
  if (gs.status === "playing" || gs.status === "finished") {
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 6;
    ctx.fillRect(gs.ball.x, gs.ball.y, BALL, BALL);
    ctx.shadowBlur = 0;
  }

  // Overlays
  if (gs.status === "waiting") {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "24px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Waiting for Player 2…", W / 2, H / 2);
    ctx.font = "14px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText("Share the portal URL to invite them", W / 2, H / 2 + 36);
  }

  if (gs.status === "finished") {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    const label = gs.winner === "left" ? "LEFT WINS" : "RIGHT WINS";
    ctx.fillText(label, W / 2, H / 2 - 10);
    ctx.font = "18px monospace";
    ctx.fillStyle = "#888";
    ctx.fillText(`${gs.scores.left} — ${gs.scores.right}`, W / 2, H / 2 + 34);
  }

  requestAnimationFrame(draw);
}

draw();
