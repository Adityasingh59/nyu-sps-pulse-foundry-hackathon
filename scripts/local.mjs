import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtime = resolve(root, process.env.TABLESIGNAL_RUNTIME_DIR || "data/runtime");
mkdirSync(runtime, { recursive: true });
const pidFile = resolve(runtime, "supervisor.pid");
const logFile = resolve(runtime, "server.log");
const database = resolve(root, process.env.TABLESIGNAL_DB_PATH || "data/tablesignal.sqlite");
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("PORT must be an integer between 1 and 65535.");
  process.exit(1);
}
const url = `http://127.0.0.1:${port}`;
const identity = createHash("sha256").update(runtime).digest("hex").slice(0, 24);
// Named pipes on Windows and Unix sockets elsewhere identify our own supervisor
// without inspecting processes or terminating a possibly reused PID.
const endpoint = process.platform === "win32"
  ? `\\\\.\\pipe\\tablesignal-${identity}`
  : resolve(tmpdir(), `tablesignal-${identity}.sock`);
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const metadata = () => ({ root, runtime, supervisorPid: process.pid, url, database, logFile });

function request(command = "status") {
  return new Promise((done) => {
    const socket = createConnection(endpoint);
    let output = "", settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      done(value);
    };
    socket.setTimeout(1000, () => finish(undefined));
    socket.on("error", () => finish(undefined));
    socket.on("connect", () => socket.write(`${command}\n`));
    socket.on("data", (chunk) => {
      output += chunk.toString();
      if (output.length > 4096) return finish(undefined);
      if (!output.includes("\n")) return;
      try {
        const value = JSON.parse(output.trim());
        finish(value.root === root && value.runtime === runtime ? value : undefined);
      } catch {
        finish(undefined);
      }
    });
    socket.on("end", () => finish(undefined));
  });
}

async function healthy(base = url) {
  try {
    const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) });
    const body = await response.json();
    return response.ok && body.ok === true && body.storage === "sqlite";
  } catch {
    return false;
  }
}

const command = process.argv[2] || "up";
if (command === "supervise") {
  let child, timer, stopping = false, failures = 0;
  const clean = () => {
    try {
      if (readFileSync(pidFile, "utf8") === String(process.pid)) unlinkSync(pidFile);
    } catch {}
  };
  const finish = (code = 0) => {
    clean();
    control.close(() => process.exit(code));
  };
  const stop = () => {
    if (stopping) return;
    stopping = true;
    clearTimeout(timer);
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      timer = setTimeout(() => child.kill("SIGKILL"), 10_000);
      timer.unref();
    } else {
      finish();
    }
  };
  const launch = () => {
    const started = Date.now();
    console.log(`${new Date().toISOString()} Starting TableSignal locally.`);
    child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", () => console.error("Application could not start. Inspect the local installation."));
    child.on("close", (code) => {
      if (stopping) return finish();
      failures = Date.now() - started > 30_000 ? 0 : failures + 1;
      if (failures >= 10) {
        console.error("Stopped after 10 consecutive startup failures. Inspect data/runtime/server.log.");
        return finish(1);
      }
      const delay = Math.min(5000, 500 * (failures + 1));
      console.log(`${new Date().toISOString()} Application exited (${code}); restarting in ${delay}ms. SQLite history is preserved.`);
      timer = setTimeout(launch, delay);
    });
  };
  const control = createServer((socket) => {
    let input = "";
    socket.setTimeout(1000, () => socket.destroy());
    socket.on("error", () => {});
    socket.on("data", (chunk) => {
      input += chunk.toString();
      if (input.length > 128) return socket.destroy();
      if (!input.includes("\n")) return;
      const action = input.trim();
      if (!["status", "stop"].includes(action)) return socket.destroy();
      socket.end(`${JSON.stringify(metadata())}\n`, () => {
        if (action === "stop") stop();
      });
    });
  });
  control.on("error", () => {
    console.error("A local supervisor already owns this runtime, or its control socket is unavailable.");
    process.exit(1);
  });
  control.listen(endpoint, () => {
    if (process.platform !== "win32") chmodSync(endpoint, 0o600);
    writeFileSync(pidFile, String(process.pid));
    launch();
  });
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  process.on("exit", clean);
} else if (command === "up") {
  const existing = await request();
  if (existing && (existing.url !== url || existing.database !== database)) {
    console.error("This checkout is already running with different settings. Run npm run down before changing PORT or TABLESIGNAL_DB_PATH.");
    process.exit(1);
  }
  if (await healthy()) {
    console.log(`TableSignal is already running at ${url}${existing ? "" : " (outside this supervisor)"}`);
    process.exit(0);
  }
  if (!existsSync(resolve(root, "dist/index.html"))) {
    console.error("Build the interface first with npm run build, or use npm run setup.");
    process.exit(1);
  }
  if (!existing) {
    // Unix leaves the socket behind after a hard kill. Do not unlink a listener
    // that is still starting or serves an unrecognized protocol.
    if (process.platform !== "win32" && existsSync(endpoint)) {
      const listening = await new Promise((done) => {
        const socket = createConnection(endpoint);
        socket.setTimeout(1000, () => { socket.destroy(); done(true); });
        socket.on("connect", () => { socket.destroy(); done(true); });
        socket.on("error", (error) => done(error.code !== "ECONNREFUSED" && error.code !== "ENOENT"));
      });
      if (!listening) {
        try { unlinkSync(endpoint); } catch (error) { if (error.code !== "ENOENT") throw error; }
      }
    }
    const output = openSync(logFile, "a");
    try {
      const daemon = spawn(process.execPath, [fileURLToPath(import.meta.url), "supervise"], {
        cwd: root,
        env: process.env,
        detached: true,
        windowsHide: true,
        stdio: ["ignore", output, output],
      });
      daemon.on("error", () => console.error("The supervisor could not start. Check your Node installation."));
      daemon.unref();
    } finally {
      closeSync(output);
    }
  }
  for (let attempt = 0; attempt < 75; attempt++) {
    const supervisor = await request();
    if (supervisor && await healthy()) {
      console.log(`TableSignal is running at ${url}`);
      console.log(`Saved data: ${database}\nLogs: ${logFile}`);
      process.exit(0);
    }
    await pause(200);
  }
  console.error(`The application did not become ready. Inspect ${logFile}.`);
  process.exitCode = 1;
} else if (command === "down") {
  const existing = await request("stop");
  if (!existing) {
    console.log("No managed TableSignal supervisor is running.");
  } else {
    for (let attempt = 0; attempt < 75; attempt++) {
      if (!await request()) {
        console.log("Stopped the managed local application. Saved data is preserved.");
        process.exit(0);
      }
      await pause(200);
    }
    console.error(`The supervisor is still stopping. Inspect ${existing.logFile}.`);
    process.exitCode = 1;
  }
} else if (command === "status") {
  const existing = await request();
  console.log(JSON.stringify({
    url: existing?.url || url,
    healthy: await healthy(existing?.url || url),
    supervisorRunning: Boolean(existing),
    supervisorPid: existing?.supervisorPid,
    logFile: existing?.logFile || logFile,
    database: existing?.database || database,
  }, null, 2));
} else {
  console.error("Use up, down, or status.");
  process.exitCode = 1;
}
