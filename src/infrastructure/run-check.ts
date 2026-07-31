import { spawn, type ChildProcess } from "node:child_process";
import { isAbsolute, relative, resolve, sep } from "node:path";
import process from "node:process";

import type { Criterion } from "../domain/criteria.js";
import type { UnavailableReason } from "../domain/outcome.js";
import { escapeHumanValue, quoteHumanValue } from "../presentation/human-value.js";

export type CheckRun =
  | { readonly kind: "ran"; readonly exitCode: number }
  | { readonly kind: "unavailable"; readonly reason: UnavailableReason };

function resolveCwd(repoRoot: string, requested: string): string {
  if (isAbsolute(requested)) {
    throw new Error("check cwd must be relative to the repository root");
  }
  const target = resolve(repoRoot, requested);
  const distance = relative(repoRoot, target);
  if (distance === ".." || distance.startsWith(`..${sep}`)) {
    throw new Error("check cwd escapes the repository root");
  }
  return target;
}

function terminateChild(child: ChildProcess): void {
  if (child.pid === undefined) {
    return;
  }
  try {
    child.kill("SIGKILL");
  } catch {
    // Exiting between observation and signalling is already the desired state.
  }
}

function writeSpawnFailure(executable: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;
  const detail = code === undefined || code === message ? message : `${code}: ${message}`;
  process.stderr.write(
    `exit-criteria: cannot start ${quoteHumanValue(executable)}: ${escapeHumanValue(detail)}\n`,
  );
}

/**
 * Runs one criterion. Exit 0 is PASS and another numeric exit is FAIL.
 * Startup failure, timeout, and signal termination are UNAVAILABLE.
 */
export function runCheck(criterion: Criterion, repoRoot: string): Promise<CheckRun> {
  return new Promise((resolvePromise) => {
    let cwd: string;
    try {
      cwd = resolveCwd(repoRoot, criterion.cwd);
    } catch {
      resolvePromise({ kind: "unavailable", reason: "spawn_failed" });
      return;
    }

    const [executable, ...args] = criterion.argv;
    if (executable === undefined) {
      resolvePromise({ kind: "unavailable", reason: "spawn_failed" });
      return;
    }

    let child;
    try {
      child = spawn(executable, args, {
        cwd,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      writeSpawnFailure(executable, error);
      resolvePromise({ kind: "unavailable", reason: "spawn_failed" });
      return;
    }

    // stdout belongs to the Exit Criteria report. Forward checker output to
    // stderr with stream backpressure instead of buffering it in memory.
    child.stdout.pipe(process.stderr, { end: false });
    child.stderr.pipe(process.stderr, { end: false });

    let spawnFailed = false;
    let directProcessExited = false;
    let timedOut = false;
    let settled = false;

    const removeSignalHandlers = (): void => {
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
    };

    const interrupt = (signal: "SIGINT" | "SIGTERM"): void => {
      removeSignalHandlers();
      terminateChild(child);
      process.kill(process.pid, signal);
    };

    const onSigint = (): void => interrupt("SIGINT");
    const onSigterm = (): void => interrupt("SIGTERM");

    const finish = (result: CheckRun, closePipes = false): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      removeSignalHandlers();
      if (closePipes) {
        child.stdout.unpipe(process.stderr);
        child.stderr.unpipe(process.stderr);
        child.stdout.destroy();
        child.stderr.destroy();
      }
      resolvePromise(result);
    };

    process.once("SIGINT", onSigint);
    process.once("SIGTERM", onSigterm);

    child.on("error", (error: NodeJS.ErrnoException) => {
      spawnFailed = true;
      writeSpawnFailure(executable, error);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      if (directProcessExited) {
        process.stderr.write(
          `exit-criteria: checker ${quoteHumanValue(criterion.id)} exited but left stdout or stderr open\n`,
        );
      }
      terminateChild(child);
      finish({ kind: "unavailable", reason: "timeout" }, true);
    }, criterion.timeoutSeconds * 1000);
    timer.unref();

    // `close` waits for inherited pipes. A conforming checker stays in the
    // foreground until its work is done. Timeout still closes our pipe ends so
    // a violating background process cannot keep Exit Criteria running.
    child.on("exit", (_code, signal) => {
      directProcessExited = true;
      if (timedOut) {
        finish({ kind: "unavailable", reason: "timeout" }, true);
        return;
      }
      if (signal !== null) {
        finish({ kind: "unavailable", reason: "terminated_by_signal" }, true);
      }
    });

    child.on("close", (code, signal) => {
      if (spawnFailed) {
        finish({ kind: "unavailable", reason: "spawn_failed" }, true);
        return;
      }
      if (timedOut) {
        finish({ kind: "unavailable", reason: "timeout" }, true);
        return;
      }
      if (signal !== null || code === null) {
        finish({ kind: "unavailable", reason: "terminated_by_signal" }, true);
        return;
      }
      finish({ kind: "ran", exitCode: code });
    });
  });
}
