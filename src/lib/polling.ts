export type PollingState = "checking" | "waiting" | "error" | "paused" | "complete";

/** Consultas sequenciais: nunca repete uma operação enquanto a anterior está pendente. */
export function createPolling<T>({ check, onResult, onState, interval = 5000, maxDuration = 10 * 60 * 1000 }: {
  check: () => Promise<T>;
  onResult: (result: T) => boolean;
  onState: (state: PollingState) => void;
  interval?: number;
  maxDuration?: number;
}) {
  let disposed = false;
  let paused = false;
  let completed = false;
  let pending = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout>;
  let deadline: ReturnType<typeof setTimeout>;

  function armDeadline() {
    clearTimeout(deadline);
    deadline = setTimeout(() => {
      paused = true;
      clearTimeout(timer);
      if (!disposed) onState("paused");
    }, maxDuration);
  }

  async function run() {
    if (disposed || paused || pending) return;
    pending = true;
    onState("checking");
    try {
      const result = await check();
      if (disposed || paused) return;
      if (onResult(result)) {
        completed = true;
        paused = true;
        clearTimeout(deadline);
        onState("complete");
        return;
      }
      failures = 0;
      onState("waiting");
    } catch {
      if (disposed || paused) return;
      failures++;
      onState("error");
    } finally {
      pending = false;
      if (!disposed && !paused) timer = setTimeout(run, Math.min(interval * 2 ** failures, 30000));
    }
  }

  armDeadline();
  timer = setTimeout(run, interval);
  return {
    retry() {
      if (disposed || completed) return;
      paused = false;
      failures = 0;
      clearTimeout(timer);
      armDeadline();
      // Uma resposta lenta continua sendo a única consulta em andamento.
      if (!pending) void run();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(deadline);
    },
  };
}
