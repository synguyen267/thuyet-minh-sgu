/**
 * Bộ điều khiển thuyết minh: quyết định phát / xếp hàng / bỏ qua.
 * Không tự phát âm thanh: chỉ trả về lệnh, giao diện (web hay mobile) tự phát.
 *
 * Quy tắc:
 *  - Điểm đang phát hoặc đang chờ thì bỏ qua (không chồng giọng).
 *  - Điểm vừa đọc trong cooldownMs thì bỏ qua (không đọc lặp), chỉ áp dụng cho GPS.
 *  - Nguồn "qr" hoặc "manual": phát ngay, không áp dụng thời gian chờ.
 *  - interrupt()/resume()/dismiss(): xử lý cuộc gọi, thông báo, trang bị ẩn (FR-22).
 */
export class NarrationController {
  constructor({ cooldownMs = 10 * 60 * 1000, now = () => Date.now() } = {}) {
    this.cooldownMs = cooldownMs;
    this.now = now;
    this.reset();
  }

  reset() {
    this.current = null;
    this.queue = [];
    this.lastStarted = new Map();
    this.paused = false;
  }

  request(id, { source = 'gps' } = {}) {
    const direct = source !== 'gps';

    if (!direct) {
      if (this.current?.id === id) return { action: 'skip', reason: 'playing' };
      if (this.queue.some((q) => q.id === id)) return { action: 'skip', reason: 'queued' };
      const last = this.lastStarted.get(id);
      if (last !== undefined && this.now() - last < this.cooldownMs) {
        return { action: 'skip', reason: 'cooldown' };
      }
      if (this.current || this.paused) {
        this.queue.push({ id, source });
        return { action: 'queued', id, position: this.queue.length };
      }
      return this.#start(id, source);
    }

    const preempted = this.current?.id ?? null;
    this.queue = this.queue.filter((q) => q.id !== id);
    this.paused = false;
    const result = this.#start(id, source);
    return preempted === null ? result : { ...result, preempted };
  }

  /** Gọi khi phát xong. Trả về điểm kế tiếp cần phát hoặc { action: 'idle' }. */
  finish() {
    this.current = null;
    if (this.paused) return { action: 'idle' };
    const next = this.queue.shift();
    return next ? this.#start(next.id, next.source) : { action: 'idle' };
  }

  /** Có cuộc gọi, thông báo hoặc trang bị ẩn. */
  interrupt() {
    if (!this.current) return { action: 'idle' };
    this.paused = true;
    return { action: 'pause', id: this.current.id };
  }

  /** Hết gián đoạn, người dùng chọn nghe tiếp. */
  resume() {
    if (!this.paused) return { action: 'idle' };
    this.paused = false;
    if (this.current) return { action: 'play', id: this.current.id, resumed: true };
    return this.finish();
  }

  /** Hết gián đoạn, người dùng chọn bỏ qua điểm bị ngắt. */
  dismiss() {
    this.paused = false;
    return this.finish();
  }

  snapshot() {
    return {
      current: this.current?.id ?? null,
      queue: this.queue.map((q) => q.id),
      paused: this.paused,
    };
  }

  #start(id, source) {
    this.current = { id, source, startedAt: this.now() };
    this.lastStarted.set(id, this.now());
    return { action: 'play', id, source };
  }
}
