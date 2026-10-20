# Run TableSignal on your computer

Each teammate runs their own local application and SQLite database. Git shares the code and the
saved report files in `reports/`; it does not share the current operator's database, provider
sign-in, API keys, or runtime logs.

## 1. Install the prerequisites

- Git, with access to the team's GitHub repository.
- Node.js **24 or newer**, including npm. The repository's `.nvmrc` selects Node 24.
- A terminal: PowerShell on Windows, Terminal on macOS, or a Linux shell.

After installing Git or Node, open a new terminal and check:

```sh
git --version
node --version
npm --version
```

In PowerShell, use `npm.cmd --version` if `npm` reports that script execution is disabled.
The Windows commands below use `npm.cmd` so no PowerShell execution-policy change is needed.
No separate database server is required; the application uses Node's built-in SQLite support.

## 2. Clone, install, and start

Run these commands in the folder where you keep your projects. If GitHub reports that the
repository cannot be found, check that you are signed in with an account that has repository
access; a repository owner may need to invite you.

### Windows PowerShell

```powershell
git clone https://github.com/Adityasingh59/nyu-sps-pulse-foundry-hackathon.git
cd nyu-sps-pulse-foundry-hackathon
npm.cmd ci
npm.cmd run setup
```

### macOS or Linux

```sh
git clone https://github.com/Adityasingh59/nyu-sps-pulse-foundry-hackathon.git
cd nyu-sps-pulse-foundry-hackathon
npm ci
npm run setup
```

If you use nvm on macOS/Linux, run `nvm use` in the project folder before `npm ci`.
Use the committed lockfile through `npm ci` for repeatable installs. Keep optional dependencies
enabled; the frontend build uses a platform-specific optional dependency.

`npm run setup` builds the frontend and starts the managed local application. It does not
install dependencies; run `npm ci` first.

Open **<http://127.0.0.1:3001>**. The managed server runs in the background and restarts the
application after an unexpected exit. It does not start automatically after a computer reboot;
run `npm run up` again after restarting your computer.

Starting the application does not run live model measurements. A fresh clone creates the
clearly labeled **Linden Table synthetic example**, so you can explore the interface without
provider credentials. It will not contain this machine's saved John's of Bleecker Street runs.
Read the checked-in [real case study](../reports/johns-bleecker-case-study.md) and
[comparison report](../reports/johns-bleecker-comparison.json) for those results.

## 3. Everyday commands

Run commands from the project folder. On Windows PowerShell, replace `npm` with `npm.cmd`.

| Task | Command | Result |
| --- | --- | --- |
| Build and start | `npm run setup` | One command after installing dependencies |
| Start the built app | `npm run up` | Background server at port 3001 |
| Check the server | `npm run local:status` | Health, supervisor state, and local file paths |
| Stop the managed app | `npm run down` | Stops the server and preserves saved data |
| Run in the foreground | `npm start` | Built UI and API at port 3001; stop with Ctrl+C |
| Develop | `npm run dev` | UI at port 5173 and API at port 3001; stop with Ctrl+C |
| Run isolated tests | `npm test` | Temporary databases; no live model calls |
| Check types and rebuild UI | `npm run build` | Production frontend in `dist/` |

Build before `npm start` or `npm run up`. Rebuild after changing frontend code.
Before switching to development or foreground mode, run `npm run down`. Before switching back
from development, press Ctrl+C in its terminal. Run only one API worker on the same port and
database. For development, open <http://127.0.0.1:5173>.

## 4. Pull team changes

Stop the server, save your own changes on a branch or commit them, then update:

```sh
npm run down
git pull --ff-only
npm ci
npm test
npm run setup
```

Use `npm.cmd` in PowerShell. If you were using `npm run dev`, stop that terminal with Ctrl+C
first. `git pull --ff-only` stops if your local branch and remote branch have diverged; resolve
that with the team rather than discarding your work.

Your `data/tablesignal.sqlite` survives ordinary pulls, installs, builds, and restarts.
Do not delete it or run `git clean -fdx` to fix an installation problem: ignored local evidence
and authentication/configuration files may be lost. Do not commit or pass around the `data/`
directory or provider credentials as part of setup. Each teammate signs in independently.

To contribute code, make a branch before editing:

```sh
git switch -c ui/short-description
```

Run `npm test` and `npm run build` before opening a pull request. See
[CONTRIBUTING.md](../CONTRIBUTING.md) for the project workflow and evidence rules.
Changes on one computer reach teammates only after they are committed and pushed to the
repository and teammates pull the relevant branch. Uncommitted setup changes are local.

## 5. Optional: enable live restaurant measurements

The synthetic example and saved report files need no provider sign-in. To make new live calls,
use your own supported provider access:

```sh
npm run provider:status
# If sign-in is required:
npm run provider:login
```

Use `npm.cmd` in PowerShell. Sign in through the official CLI's normal flow; do not copy another
teammate's authentication files or extract tokens. If provider status is unavailable, the local
synthetic interface remains usable. Restart the server after changing provider configuration.

The optional alternative is a server-side `OPENAI_API_KEY`, configured in your local server
environment. The [`.env.example`](../.env.example) file describes the available variables;
`.env` is **not automatically loaded**. Never add a key to frontend code, Git, screenshots, or
exported reports. Live calls consume the selected account's allowance or API budget and remain
subject to the configured per-run ceilings.

To prepare the real public-information case study on your own database, start the app and run:

```sh
npm run setup:nyc
```

This collects public website pages and leaves extracted facts for review. In the interface,
review the identity and individual facts with their saved sources. Website observations retain
`website` provenance. Once that review is complete and you intend to consume provider allowance,
you can start a new baseline and then its follow-up:

```sh
npm run run:nyc
npm run rerun:nyc
```

The stable idempotency keys resume existing runs **within your local database**. They do not
reuse this machine's results or prevent another teammate's independent database from making
new calls. Coordinate live measurements with the team. This workflow does not authorize
publishing to the restaurant's website or contacting the business.

## 6. Troubleshooting

| Symptom | Action |
| --- | --- |
| `git`, `node`, or `npm` is not found | Install the prerequisite, open a new terminal, and check the versions again. |
| PowerShell blocks `npm.ps1` | Use `npm.cmd` for the same command. No execution-policy change is needed. |
| SQLite import or Node engine error | Check `node --version`; use Node 24 or newer, then reinstall with `npm ci`. |
| Install/build reports a missing Rollup native module | Run `npm ci` on this computer with optional dependencies enabled. Do not copy `node_modules` between operating systems. |
| Browser cannot open port 3001 | Run `npm run local:status`. Build, then run `npm run up`; inspect `data/runtime/server.log` if startup fails. |
| `EADDRINUSE` or port 3001 is busy | Stop this project's managed server with `npm run down`, or stop its development terminal with Ctrl+C. Identify other listeners before stopping them. |
| Vite says port 5173 is busy | Stop the earlier development terminal, then run `npm run dev` again. |
| Interface changes are missing | Run `npm run build` and restart the built server, or use development mode. |
| John's saved runs do not appear after cloning | Expected: the SQLite database is local and ignored by Git. Read `reports/` or deliberately create your own reviewed case study. |
| Provider is not configured | Check `npm run provider:status` and use supported sign-in if needed. Starting the local app requires no live provider. |

For logs, use `Get-Content data/runtime/server.log -Tail 60` in PowerShell or
`tail -n 60 data/runtime/server.log` on macOS/Linux. Keep logs local if they contain collected
restaurant evidence or raw provider answers.

For a different port in built mode, set it before starting the server:

```powershell
$env:PORT = "3002"
npm.cmd run up
# local:status and down find the managed server's settings automatically.
```

```sh
PORT=3002 npm run up
PORT=3002 npm run local:status
PORT=3002 npm run down
```

Open <http://127.0.0.1:3002>. For development, set `PORT` before `npm run dev`; Vite uses the
same value for its API proxy while its UI stays on port 5173. The application binds to loopback,
so each teammate should run it locally rather than expose it as a shared network service.

Read [docs/PROGRESS.md](PROGRESS.md) for the latest verified state and
[docs/brief-validation.md](brief-validation.md) for remaining product work.
