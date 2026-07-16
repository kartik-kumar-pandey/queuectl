# QueueCTL - CLI-based Background Job Queue System

QueueCTL is a production-grade, local-first background job queue system built with Node.js and SQLite. It supports parallel execution, automatic retries with exponential backoff, a Dead Letter Queue (DLQ) for permanently failed jobs, job timeouts, and graceful shutdown of worker processes.

## 🖥️ Terminal UI Preview

Here is a preview of the unique terminal console dashboard and interactive shell session:

### 1. Interactive Session Banner
```ansi
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║    ██████╗ ██╗   ██╗███████╗██╗   ██╗███████╗             ║
  ║   ██╔═══██╗██║   ██║██╔════╝██║   ██║██╔════╝             ║
  ║   ██║   ██║██║   ██║█████╗  ██║   ██║█████╗               ║
  ║   ██║▄▄ ██║██║   ██║██╔══╝  ██║   ██║██╔══╝               ║
  ║   ╚██████╔╝╚██████╔╝███████╗╚██████╔╝███████╗             ║
  ║    ╚════▀▀╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝             ║
  ║                                                           ║
  ║              ██████╗████████╗██╗                           ║
  ║             ██╔════╝╚══██╔══╝██║                           ║
  ║             ██║        ██║   ██║                           ║
  ║             ██║        ██║   ██║                           ║
  ║             ╚██████╗   ██║   ███████╗                      ║
  ║              ╚═════╝   ╚═╝   ╚══════╝                      ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
     Background Job Queue Engine • v1.0.0

  ✨ Interactive Console Session Initiated.
  Type help to list commands or exit to quit.

queuectl ➜
```

### 2. Live System Dashboard (`status` command)
```ansi
  ╭───────────────────────────────────────────────────────╮
  │   SYSTEM DASHBOARD                                    │
  ├───────────────────────────────────────────────────────┤
  │                                                       │
  │   Workers Active   ⬤  3 running                       │
  │   Total Jobs       8                                  │
  │                                                       │
  ├───────────────────────────────────────────────────────┤
  │   JOB BREAKDOWN                                       │
  ├───────────────────────────────────────────────────────┤
  │                                                       │
  │   ● Pending        ░░░░░░░░░░░░░░░ 0/8                │
  │   ◉ Processing     ░░░░░░░░░░░░░░░ 0/8                │
  │   ✔ Completed      █████████░░░░░░ 5/8                │
  │   ⚠ Failed         ░░░░░░░░░░░░░░░ 0/8                │
  │   ✖ Dead (DLQ)     ██████░░░░░░░░░ 3/8                │
  │                                                       │
  ╰───────────────────────────────────────────────────────╯
```

### 3. Custom Box-Drawing Table (`list` command)
```ansi
╭─────────────┬─────────────────────────────────────┬──────────────┬─────────╮
│ ID          │ COMMAND                             │ STATE        │ TIMEOUT │
├─────────────┼─────────────────────────────────────┼──────────────┼─────────┤
│ success-job │ node -e "console.log('ok')"         │ ✔ completed  │ none    │
│ fail-job    │ node -e "process.exit(1)"           │ ✖ dead       │ none    │
│ timeout-job │ node -e "setTimeout(()=>process.... │ ✖ dead       │ 1s      │
╰─────────────┴─────────────────────────────────────┴──────────────┴─────────╯
```


## Features

- **CLI Interface**: Perform all enqueue, worker management, config, status, and DLQ actions directly from your terminal.
- **Web UI Console (Premium)**: Serve a clean, professional dark-slate dashboard (AWS/Google Cloud styling) directly from the CLI to manage jobs and view logs in real-time.
- **Robust Persistence**: Job state and workers are persisted in a local SQLite database, surviving system restarts.
- **Race Condition Prevention**: Employs SQLite `BEGIN IMMEDIATE` transactions to safely coordinate multiple workers processing jobs in parallel without overlapping execution.
- **Graceful Shutdown**: Workers listen to termination signals and check the database state, completing their current task before exiting.
- **Configurability**: Configure retry thresholds and exponential backoff base factor dynamically via the CLI.
- **Extended Features**: 
  - **Job Execution Timeouts**: Kill hanging processes that exceed specified run-time limits.
  - **Job Priority**: Execute high-priority tasks before lower-priority tasks.

---

## Architecture Overview

### 1. Job Lifecycle
Jobs progress through the following states:
```
 [pending] -> [processing] -> [completed]
     ^              |
     | (retry)      v (failure)
     └-----------[failed] -> [dead] (DLQ after max_retries)
```

- **`pending`**: Waiting to be picked up by a worker.
- **`processing`**: Currently being executed by a worker process.
- **`completed`**: Successfully executed (exit code 0).
- **`failed`**: Execution failed, but scheduled for retry based on exponential backoff.
- **`dead`**: Failed permanently; moved to the Dead Letter Queue (DLQ).

### 2. Concurrency & Locking
SQLite **Write-Ahead Logging (WAL)** is enabled. During job pickup, a worker opens a write-exclusive transaction (`BEGIN IMMEDIATE`), queries the next eligible pending/failed job (ordered by priority desc, created_at asc), updates its status to `processing`, and commits. This ensures that no two workers can process the same job.

### 3. Exponential Backoff Formula
$$delay = \text{backoff-base}^{\text{attempts}} \text{ seconds}$$

For example, with a `backoff-base` of `2`:
- Attempt 1 fails: Retried in $2^1 = 2$ seconds.
- Attempt 2 fails: Retried in $2^2 = 4$ seconds.
- After reaching `max_retries`, the job is marked `dead`.

---

## Installation & Setup

1. **Clone or navigate to the directory**:
   ```bash
   cd queuectl
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Link CLI command globally (Optional)**:
   ```bash
   npm link
   ```
   *Note: If linked, you can run `queuectl` directly from any directory. Otherwise, run using `node bin/queuectl.js`.*

---

## CLI Usage Guide

If not linked globally, replace `queuectl` with `node bin/queuectl.js`.

### 1. Interactive Console Session (REPL)
Run `queuectl` (or `node bin/queuectl.js`) without any arguments to enter a persistent, interactive terminal shell session (similar to Claude Code or Gemini CLI):
```bash
queuectl
```
* **Features:** Autocompletion (`Tab` key), command history (`Up`/`Down` arrow keys), and run any CLI command directly (e.g. type `status`, `metrics`, `logs task-1`, `worker start`, `exit` to quit).

### 2. Enqueue a Job
Add a job using command options (highly recommended for PowerShell & Command Prompt):
```bash
queuectl enqueue --id task-1 --command "echo hello world" --retries 3 --priority 5 --timeout 10
```

Alternatively, you can pass a raw JSON string using the `--json` option:
```bash
queuectl enqueue --json '{"id": "job1", "command": "echo Hello World", "max_retries": 3}'
```

### 2. Manage Workers
- **Start workers**: Start 3 worker processes.
  ```bash
  queuectl worker start --count 3
  ```
- **Stop workers**: Signal all running workers to finish their current job and exit.
  ```bash
  queuectl worker stop
  ```

### 3. Check Queue Status
View job states and active worker counts:
```bash
queuectl status
```

### 4. List Jobs
List all jobs (or filter by a specific state):
```bash
queuectl list
queuectl list --state pending
```

### 5. Dead Letter Queue (DLQ)
- **List DLQ**:
  ```bash
  queuectl dlq list
  ```
- **Retry a dead job**:
  ```bash
  queuectl dlq retry job1
  ```

### 6. Job Output Logs (Bonus)
View historical execution logs, status, stdout/stderr, and duration for a specific job:
```bash
queuectl logs <job_id>
```

### 7. Performance Metrics (Bonus)
View performance metrics, total runs, success rate percentage, and average/min/max execution durations:
```bash
queuectl metrics
```

### 8. Web UI Console (Premium Feature)
Start the built-in HTTP Web UI dashboard to monitor jobs and manage the queue visually from your browser:
```bash
queuectl ui --port 5000
```
* **Dashboard:** http://localhost:5000 (Provides a professional Google Cloud / AWS-style dashboard for status, enqueuing, DLQ management, metrics, and logs).

### 9. Configurations
- **View all configs**:
  ```bash
  queuectl config list
  ```
- **Set config value**:
  ```bash
  queuectl config set max-retries 5
  ```
  *(e.g., config set backoff-base 3)*

---

## Verification & Testing

To run the automated verification test suite:
```bash
npm test
```

The test runner:
1. Resets the local SQLite database.
2. Enqueues a successful job, a failing job, and a job designed to time out.
3. Spawns a worker and validates that execution, exponential backoff, DLQ migration, and DLQ retries function as expected.
