// Fila de sync seletivo: agrupa os MLBs notificados por usuário e dispara um
// único runSync `delayMs` depois da primeira notificação do lote.
export function createSyncQueue({
  runSync,
  getSyncState,
  delayMs = 30_000,
  setTimeout: setTimer = globalThis.setTimeout,
  clearTimeout: clearTimer = globalThis.clearTimeout,
} = {}) {
  const lotes = new Map(); // userId -> { mlbs: Set, timer }

  function agendar(userId) {
    const lote = lotes.get(userId);
    lote.timer = setTimer(() => disparar(userId), delayMs);
  }

  function disparar(userId) {
    const lote = lotes.get(userId);
    if (!lote) return;
    // runSync não inicia se já houver sync rodando: reagenda o mesmo lote.
    if (getSyncState(userId)?.running) return agendar(userId);
    lotes.delete(userId);
    clearTimer(lote.timer);
    const log = (e) => console.error("[ML webhook] falha no sync seletivo:", e?.message || e);
    try {
      Promise.resolve(runSync(userId, [...lote.mlbs])).catch(log);
    } catch (e) {
      log(e);
    }
  }

  function enqueue(userId, mlbs) {
    let lote = lotes.get(userId);
    const novo = !lote;
    if (novo) { lote = { mlbs: new Set(), timer: null }; lotes.set(userId, lote); }
    for (const m of mlbs) lote.mlbs.add(m);
    if (novo) agendar(userId);
  }

  return { enqueue };
}
