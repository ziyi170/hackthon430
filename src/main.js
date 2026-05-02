import { BrowserPod } from "@leaningtech/browserpod";
import { copyFile } from "./utils";

const statusBadge = document.getElementById("statusBadge");
const urlDiv = document.getElementById("url");
const portalIframe = document.getElementById("portal");
const qrImage = document.getElementById("qrImage");
const qrHint = document.getElementById("qrHint");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const openLinkBtn = document.getElementById("openLinkBtn");
const totalCount = document.getElementById("totalCount");
const lastUpdated = document.getElementById("lastUpdated");
const typeStats = document.getElementById("typeStats");
const recentTableBody = document.getElementById("recentTableBody");

let portalUrl = "";
let statsTimer = null;

function setStatus(kind, text) {
  statusBadge.className = `badge ${kind}`;
  statusBadge.textContent = text;
}

function setPortalUrl(url, port) {
  urlDiv.innerHTML = `Portal is live on local port ${port}: <a href="${url}" target="_blank" rel="noreferrer">${url}</a>`;
  openLinkBtn.href = url;
  openLinkBtn.classList.remove("disabled");
}

function setQrCode(url) {
  qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
  qrImage.onload = () => {
    qrImage.style.display = "block";
    qrHint.textContent = "Scan to open the WBTI behavior browser test.";
  };
  qrImage.onerror = () => {
    qrHint.textContent = "QR loading failed. Please use the link above.";
  };
}

function renderTypeStats(byType) {
  const entries = Object.entries(byType || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    typeStats.innerHTML = '<span class="pill">No persona data yet</span>';
    return;
  }

  typeStats.innerHTML = entries
    .map(([type, count]) => `<span class="pill">${type}: ${count}</span>`)
    .join("");
}

function formatTime(isoString) {
  const time = new Date(isoString);
  if (Number.isNaN(time.valueOf())) {
    return "--";
  }
  return time.toLocaleString("en-US", { hour12: false });
}

function renderRecentRows(rows) {
  if (!rows || rows.length === 0) {
    recentTableBody.innerHTML = '<tr><td colspan="4" class="empty">No results yet</td></tr>';
    return;
  }

  recentTableBody.innerHTML = rows
    .map((item) => {
      const topic = item.topic || "--";
      const persona = item.persona || "--";
      const mbti = item.mbti || "--";
      return `<tr><td>${item.id}</td><td>${persona}<div class="metric-label">${mbti}</div></td><td>${topic}</td><td>${formatTime(item.createdAt)}</td></tr>`;
    })
    .join("");
}

function renderStats(payload) {
  totalCount.textContent = String(payload.total || 0);
  lastUpdated.textContent = formatTime(new Date().toISOString());
  renderTypeStats(payload.byType);
  renderRecentRows(payload.recent);
}

async function fetchStats() {
  if (!portalUrl) {
    return;
  }

  try {
    const response = await fetch(`${portalUrl}/api/stats?ts=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    renderStats(payload);
  } catch (error) {
    console.warn("Failed to fetch survey stats:", error);
  }
}

function startPollingStats() {
  if (statsTimer) {
    clearInterval(statsTimer);
  }
  fetchStats();
  statsTimer = setInterval(fetchStats, 5000);
}

async function copyPortalLink() {
  if (!portalUrl) {
    return;
  }

  try {
    await navigator.clipboard.writeText(portalUrl);
    copyLinkBtn.textContent = "Copied";
    setTimeout(() => {
      copyLinkBtn.textContent = "Copy Test Link";
    }, 1400);
  } catch (error) {
    copyLinkBtn.textContent = "Copy failed";
    console.warn("Clipboard write failed:", error);
  }
}

copyLinkBtn.addEventListener("click", copyPortalLink);

try {
  setStatus("pending", "Booting BrowserPod...");

  const pod = await BrowserPod.boot({ apiKey: import.meta.env.VITE_BP_APIKEY });
  const terminal = await pod.createDefaultTerminal(document.querySelector("#console"));

  setStatus("pending", "Pod booted. Creating portal...");

  pod.onPortal(({ url, port }) => {
    portalUrl = url;
    portalIframe.src = url;
    setPortalUrl(url, port);
    setQrCode(url);
    copyLinkBtn.disabled = false;
    setStatus("ready", "WBTI test is live");
    startPollingStats();
  });

  const homePath = "/home/user";
  const projectPath = `${homePath}/project-${Date.now()}`;

  await pod.createDirectory(projectPath, { recursive: true });
  await copyFile(pod, "project/main.js", `${projectPath}/main.js`);
  await copyFile(pod, "project/package.json", `${projectPath}/package.json`);

  await pod.run("npm", ["install"], {
    echo: true,
    terminal,
    cwd: projectPath,
  });

  await pod.run("node", ["main.js"], {
    echo: true,
    terminal,
    cwd: projectPath,
  });
} catch (error) {
  console.error(error);
  setStatus("error", "Startup failed. Check API key or network.");
  urlDiv.textContent = String(error?.message || error);
}
