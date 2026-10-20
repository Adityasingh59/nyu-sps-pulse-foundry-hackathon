import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtime = resolve(root, "data/runtime");
mkdirSync(runtime, { recursive: true });
const pidFile = resolve(runtime, "supervisor.pid");
const logFile = resolve(runtime, "server.log");
const port = Number(process.env.PORT || 3001);
const url = `http://127.0.0.1:${port}`;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pid = () => {
  try {
    const value = Number(readFileSync(pidFile, "utf8"));
    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
};
const alive = (value) => {
  try {
    process.kill(value, 0);
    return true;
  } catch {
    return false;
  }
};
const managed = (value) => {
  if (!value || !alive(value)) return false;
  const result = spawnSync("ps", ["-p", String(value), "-o", "args="], {
    encoding: "utf8",
    timeout: 1000,
  });
  return (
    result.status === 0 &&
    result.stdout.includes(fileURLToPath(import.meta.url)) &&
    result.stdout.includes("supervise")
  );
};
const healthy = async () => {
  try {
    const r = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(1000),
    });
    const d = await r.json();
    return r.ok && d.ok === true && d.storage === "sqlite";
  } catch {
    return false;
  }
};
const clean = () => {
  if (pid() === process.pid)
    try {
      unlinkSync(pidFile);
    } catch {}
};
const command = process.argv[2] || "up";
if (command === "supervise") {
  writeFileSync(pidFile, String(process.pid));
  let child,
    stopping = false,
    failures = 0,
    timer;
  const launch = () => {
    const started = Date.now();
    console.log(`${new Date().toISOString()} Starting TableSignal locally.`);
    child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", () =>
      console.error(
        "Application process could not start. Inspect the local installation.",
      ),
    );
    child.on("exit", (code) => {
      if (stopping) {
        clean();
        process.exit(0);
        return;
      }
      failures = Date.now() - started > 30_000 ? 0 : failures + 1;
      if (failures >= 10) {
        console.error(
          "Stopped after10 consecutive startup failures. Run npm run local:status and inspect data/runtime/server.log.",
        );
        clean();
        process.exit(1);
        return;
      }
      const delay = Math.min(5000, 500 * (failures + 1));
      console.log(
        `${new Date().toISOString()} Application exited (${code}); restarting in ${delay}ms. SQLite history is preserved.`,
      );
      timer = setTimeout(launch, delay);
    });
  };
  const stop = () => {
    stopping = true;
    if (timer) clearTimeout(timer);
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      setTimeout(() => {
        child.kill("SIGKILL");
        clean();
        process.exit(0);
      }, 10_000).unref();
    } else {
      clean();
      process.exit(0);
    }
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  process.on("exit", clean);
  launch();
} else if (command === "up") {
  if (await healthy()) {
    console.log(`TableSignal is already running at ${url}`);
    process.exit(0);
  }
  const existing = pid();
  if (existing && managed(existing)) {
    console.log("The local supervisor is already starting the application.");
  } else {
    if (existsSync(pidFile)) unlinkSync(pidFile);
    const output = openSync(logFile, "a");
    const daemon = spawn(
      process.execPath,
      [fileURLToPath(import.meta.url), "supervise"],
      {
        cwd: root,
        env: process.env,
        detached: true,
        stdio: ["ignore", output, output],
      },
    );
    daemon.unref();
  }
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await healthy()) {
      console.log(`TableSignal is running at ${url}`);
      console.log(
        "Saved data: data/tablesignal.sqlite · Logs: data/runtime/server.log",
      );
      process.exit(0);
    }
    await pause(200);
  }
  console.error(
    "The application did not become ready. Inspect data/runtime/server.log.",
  );
  process.exitCode = 1;
} else if (command === "down") {
  const existing = pid();
  if (!existing || !managed(existing)) {
    console.log("No managed TableSignal supervisor is running.");
  } else {
    process.kill(existing, "SIGTERM");
    console.log(
      "Stopping the managed local application. Saved data is preserved.",
    );
  }
} else if (command === "status") {
  const existing = pid();
  console.log(
    JSON.stringify(
      {
        url,
        healthy: await healthy(),
        supervisorRunning: Boolean(existing && managed(existing)),
        logFile,
        database: resolve(root, "data/tablesignal.sqlite"),
      },
      null,
      2,
    ),
  );
} else {
  console.error("Use up, down, or status.");
  process.exitCode = 1;
}
