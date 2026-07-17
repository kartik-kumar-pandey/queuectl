# QueueCTL - CLI-based Background Job Queue System

QueueCTL is a production-grade, local-first background job queue system built with Node.js and SQLite. It supports parallel execution, automatic retries with exponential backoff, a Dead Letter Queue (DLQ) for permanently failed jobs, job timeouts, and graceful shutdown of worker processes.

## 🖥️ Terminal UI Preview

Here is a preview of the unique terminal console dashboard and interactive shell session:

### 1. Interactive Session Banner
```
  ┌────────────────────────────────────────────────────────────────────────────┐
  │           * Welcome to the QueueCtl Engine * [v1.0.0]                     │
  └────────────────────────────────────────────────────────────────────────────┘

                  ██████╗ ██╗   ██╗███████╗██╗   ██╗███████╗
                 ██╔═══██╗██║   ██║██╔════╝██║   ██║██╔════╝
                 ██║   ██║██║   ██║█████╗  ██║   ██║█████╗
                 ██║▄▄ ██║██║   ██║██╔══╝  ██║   ██║██╔══╝
                 ╚██████╔╝╚██████╔╝███████╗╚██████╔╝███████╗
                  ╚════▀▀╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝

                            ██████╗████████╗██╗
                           ██╔════╝╚══██╔══╝██║
                           ██║        ██║   ██║
                           ██║        ██║   ██║
                           ╚██████╗   ██║   ███████╗
                            ╚═════╝   ╚═╝   ╚══════╝

         A modern, persistent background job queue processing engine.

           ┌──────────── Engine Status Summary ───────────┐
           │  [IDLE] Engine:        IDLE                   │
           │  Jobs Processed:       3                      │
           │  Failed Jobs:          0                      │
           │  [WARN] Scheduled:     1                      │
           │  Active Queues:        1                      │
           │  Memory Usage:         46.5MB RSS             │
           │  CPU Usage:            ~5%                    │
           │  [INFO] Last Check:    10:18:12 pm            │
           └──────────────────────────────────────────────-┘

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

To run the automated test suite built with Node's native `node:test` framework:
```bash
npm test
```

> [!NOTE]
> The test suite runs sequentially using the `--test-concurrency=1` flag. This prevents race conditions and test state pollution since all tests share the same local SQLite database file (`queuectl.db`).

The test runner covers:
1. **Job Enqueuing**: Database schema validation, duplicate primary key constraints.
2. **Exponential Backoff**: Scheduling intervals based on exponential backoff delays.
3. **DLQ Handling**: Failed jobs entering DLQ and successful DLQ resurrection.
4. **Concurrency & Locking**: Parallel worker execution without overlapping job execution.
5. **Persistence**: Job recovery and persistence across engine restarts.

---

## 📹 Video Demo

A video walkthrough demonstrating QueueCTL command operations, workers, interactive session (REPL), and the Web UI console dashboard is available here:

[QueueCTL Demo Walkthrough Video](#)
---

## 🧠 Assumptions & Trade-offs

1. **SQLite as Datastore**: We chose SQLite instead of an in-memory datastore (like Redis) to ensure strict durability and local-first persistence out of the box without requiring external system dependencies. To handle concurrent worker writes, we enabled WAL (Write-Ahead Logging) mode and use atomic database-level transactions (`BEGIN IMMEDIATE`) to serialize claims.
2. **Process-Level Workers**: Spawning workers using Node's `child_process.fork()` mimics real-world isolated execution environments. However, it incurs higher memory overhead than thread-based systems (`worker_threads`). We accepted this trade-off for improved process-level crash safety and easier integration of arbitrary command lines.
3. **Polling-Based Workers**: To claim next eligible jobs, workers poll the database every second (configurable or default backoff). While less real-time than pub/sub sockets, polling keeps database connection handling lightweight, robust against network drops, and extremely simple.
4. **Local Shell Execution**: Commands are run directly on the host using `child_process.spawn`. We assume the host terminal environment has the necessary binaries installed. In production environments, running arbitrary shell strings should be sandboxed or containerized (e.g. Docker) to prevent malicious command execution.

