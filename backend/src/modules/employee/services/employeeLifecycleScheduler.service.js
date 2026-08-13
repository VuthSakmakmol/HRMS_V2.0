import { autoReturnMaternityEmployees } from "./employeeLifecycle.service.js";

// Abandonment is intentionally NOT scheduled. It is evaluated immediately
// after every successful attendance import. This scheduler remains only for
// automatic maternity return so HR does not need to remember the return date.
const INTERVAL_MS = 15 * 60 * 1000;
let timer = null;
let running = false;

async function runEmployeeLifecycleCycle() {
  if (running) return;
  running = true;
  try {
    await autoReturnMaternityEmployees();
  } catch (error) {
    console.error("[employee-lifecycle] maternity cycle failed:", error);
  } finally {
    running = false;
  }
}

export function startEmployeeLifecycleScheduler() {
  if (timer) return timer;
  void runEmployeeLifecycleCycle();
  timer = setInterval(() => void runEmployeeLifecycleCycle(), INTERVAL_MS);
  timer.unref?.();
  return timer;
}

export function stopEmployeeLifecycleScheduler() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
