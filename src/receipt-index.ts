import { DurableObject } from "cloudflare:workers";

export type ReceiptIndexEntry = {
  slug: string;
  kind: string;
  createdAt: number;
  expiresAt: number;
};

/**
 * Operator-only registry of public receipt slugs (one object, named "index").
 * It stores nothing beyond what the public page already reveals (slug, kind,
 * timestamps), exists so abusive pages can be found and taken down, and is
 * only written when a receipt is created or removed.
 */
export class ReceiptIndex extends DurableObject<Env> {
  private ensureSchema(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS receipts (
        slug TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);
  }

  private hasSchema(): boolean {
    return this.ctx.storage.sql
      .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'receipts'")
      .toArray().length > 0;
  }

  async add(entry: ReceiptIndexEntry): Promise<void> {
    this.ensureSchema();
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO receipts (slug, kind, created_at, expires_at) VALUES (?, ?, ?, ?)`,
      entry.slug,
      entry.kind,
      entry.createdAt,
      entry.expiresAt,
    );
  }

  async remove(slug: string): Promise<void> {
    if (!this.hasSchema()) return;
    this.ctx.storage.sql.exec("DELETE FROM receipts WHERE slug = ?", slug);
  }

  async list(limit = 200): Promise<{ entries: ReceiptIndexEntry[]; total: number }> {
    if (!this.hasSchema()) return { entries: [], total: 0 };
    const now = Date.now();
    this.ctx.storage.sql.exec("DELETE FROM receipts WHERE expires_at <= ?", now);
    const total = this.ctx.storage.sql
      .exec<{ count: number }>("SELECT COUNT(*) AS count FROM receipts")
      .one().count;
    const entries = this.ctx.storage.sql
      .exec<{ slug: string; kind: string; created_at: number; expires_at: number }>(
        "SELECT slug, kind, created_at, expires_at FROM receipts ORDER BY created_at DESC LIMIT ?",
        Math.max(1, Math.min(1_000, Math.floor(limit))),
      )
      .toArray()
      .map((row) => ({ slug: row.slug, kind: row.kind, createdAt: row.created_at, expiresAt: row.expires_at }));
    return { entries, total };
  }
}
