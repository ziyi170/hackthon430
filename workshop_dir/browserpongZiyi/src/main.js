import { BrowserPod } from "@leaningtech/browserpod";

const statusEl = document.getElementById("status");
const portalLinkEl = document.getElementById("portalLink");
const previewEl = document.getElementById("preview");
const consoleEl = document.getElementById("console");

// Copies a file from /public into the pod filesystem
async function copyFile(pod, path) {
  const f = await pod.createFile("/" + path, "binary");
  const resp = await fetch(path);
  const buf = await resp.arrayBuffer();
  await f.write(buf);
  await f.close();
}

async function main() {
  statusEl.textContent = "Booting pod…";

  const pod = await BrowserPod.boot({ apiKey: import.meta.env.VITE_BP_APIKEY });

  const terminal = await pod.createDefaultTerminal(consoleEl);

  pod.onPortal(({ url }) => {
    statusEl.textContent = "✅ Running — share the link to play multiplayer!";
    previewEl.src = url;
    portalLinkEl.href = url;
    portalLinkEl.style.display = "inline";
  });

  statusEl.textContent = "Copying project files…";
  await pod.createDirectory("/project", { recursive: true });
  await pod.createDirectory("/project/.npm", { recursive: true });

  await copyFile(pod, "project/package.json");
  await copyFile(pod, "project/server.js");
  await copyFile(pod, "project/index.html");
  await copyFile(pod, "project/game.js");

  statusEl.textContent = "Installing dependencies (ws)…";
  await pod.run(
    "npm",
    [
      "install",
      "--no-audit",
      "--no-fund",
      "--omit=optional",
      "--cache",
      "/project/.npm",
    ],
    {
      echo: true,
      terminal,
      cwd: "/project",
      env: ["npm_config_cache=/project/.npm"],
    }
  );

  statusEl.textContent = "Starting Pong server…";
  await pod.run("node", ["server.js"], {
    echo: true,
    terminal,
    cwd: "/project",
  });
}

main().catch((err) => {
  statusEl.textContent = "❌ Error: " + err.message;
  console.error(err);
});
