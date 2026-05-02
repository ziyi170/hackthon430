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
  urlDiv.innerHTML = `Portal 已创建（本地端口 ${port}）：<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`;
  openLinkBtn.href = url;
  openLinkBtn.classList.remove("disabled");
}

function setQrCode(url) {
  qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
  qrImage.onload = () => {
    qrImage.style.display = "block";
    qrHint.textContent = "手机扫码后即可进入 MBTI 问卷。";
  };
  qrImage.onerror = () => {
    qrHint.textContent = "二维码加载失败，请直接使用上方链接。";
  };
}

function renderTypeStats(byType) {
  const entries = Object.entries(byType || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    typeStats.innerHTML = '<span class="pill">暂无类型数据</span>';
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
  return time.toLocaleString("zh-CN", { hour12: false });
}

function renderRecentRows(rows) {
  if (!rows || rows.length === 0) {
    recentTableBody.innerHTML = '<tr><td colspan="4" class="empty">尚未收到提交</td></tr>';
    return;
  }

  recentTableBody.innerHTML = rows
    .map((item) => {
      return `<tr><td>${item.id}</td><td>${item.name}</td><td>${item.mbti}</td><td>${formatTime(item.createdAt)}</td></tr>`;
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
    copyLinkBtn.textContent = "链接已复制";
    setTimeout(() => {
      copyLinkBtn.textContent = "复制问卷链接";
    }, 1400);
  } catch (error) {
    copyLinkBtn.textContent = "复制失败，请手动复制";
    console.warn("Clipboard write failed:", error);
  }
}

copyLinkBtn.addEventListener("click", copyPortalLink);

try {
  setStatus("pending", "BrowserPod 启动中...");

  const pod = await BrowserPod.boot({ apiKey: import.meta.env.VITE_BP_APIKEY });
  const terminal = await pod.createDefaultTerminal(document.querySelector("#console"));

  setStatus("pending", "Pod 已启动，正在创建 Portal...");

  pod.onPortal(({ url, port }) => {
    portalUrl = url;
    portalIframe.src = url;
    setPortalUrl(url, port);
    setQrCode(url);
    copyLinkBtn.disabled = false;
    setStatus("ready", "问卷已上线，可扫码填写");
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
  setStatus("error", "启动失败，请检查 API Key 或网络");
  urlDiv.textContent = String(error?.message || error);
}
