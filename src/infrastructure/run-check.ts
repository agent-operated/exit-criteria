import { spawn } from "node:child_process";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { Binding } from "../domain/bindings.js";
import type { UnavailableReason } from "../domain/outcome.js";

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

/**
 * Runs one bound check. The exit code decides PASS or FAIL; nothing in this
 * process interprets the command's output, and no model is consulted.
 *
 * A command that cannot be started, or that never finishes, is UNAVAILABLE.
 * It is not a failure of the condition — we simply did not learn anything.
 */
export function runCheck(binding: Binding, repoRoot: string): Promise<CheckRun> {
  return new Promise((resolvePromise) => {
    let cwd: string;
    try {
      cwd = resolveCwd(repoRoot, binding.cwd);
    } catch {
      resolvePromise({ kind: "unavailable", reason: "spawn_failed" });
      return;
    }

    const [executable, ...args] = binding.argv;
    if (executable === undefined) {
      resolvePromise({ kind: "unavailable", reason: "spawn_failed" });
      return;
    }

    // shell: false is not an optimisation. A shell string would let the binding
    // file decide what runs, which is exactly what must stay fixed.
    const child = spawn(executable, args, {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let spawnError = false;
    let timedOut = false;

    child.stdout.on("data", () => {});
    child.stderr.on("data", () => {});
    child.on("error", () => {
      spawnError = true;
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, binding.timeoutSeconds * 1000);
    timer.unref();

    child.on("close", (code) => {
      clearTimeout(timer);
      if (spawnError) {
        resolvePromise({ kind: "unavailable", reason: "spawn_failed" });
        return;
      }
      if (timedOut) {
        resolvePromise({ kind: "unavailable", reason: "timeout" });
        return;
      }
      resolvePromise({ kind: "ran", exitCode: code ?? 1 });
    });
  });
}
