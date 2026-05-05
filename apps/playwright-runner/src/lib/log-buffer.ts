/**
 * Bounded ring buffer for adapter logs. We keep the last ~4 KB to surface in
 * upload_jobs.log_excerpt for failure diagnostics.
 */
export class LogBuffer {
  private chunks: string[] = [];
  private size = 0;

  constructor(private readonly maxBytes = 4096) {}

  append(line: string): void {
    const stamped = `[${new Date().toISOString()}] ${line}\n`;
    this.chunks.push(stamped);
    this.size += stamped.length;
    while (this.size > this.maxBytes && this.chunks.length > 1) {
      const dropped = this.chunks.shift()!;
      this.size -= dropped.length;
    }
  }

  toString(): string {
    return this.chunks.join('');
  }
}
