import { DurableObject } from "cloudflare:workers";
import { sha256 } from "./ranking-room";

export type PublicReceiptKind = "pocket-polis-receipt" | "ranking-receipt";
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type PublicReceiptRecord = {
  status: "ready" | "not_found" | "expired" | "forbidden" | "deleted";
  kind?: PublicReceiptKind;
  receipt?: JsonValue;
  createdAt?: number;
  expiresAt?: number;
};

type ReceiptRow = {
  kind: PublicReceiptKind;
  receipt_json: string;
  created_at: number;
  expires_at: number;
  admin_hash: string;
};

export class PublicReceipt extends DurableObject<Env> {
  private deleted = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.migrate();
    });
  }

  private migrate(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
        id INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const version = this.ctx.storage.sql
      .exec<{ version: number }>(
        "SELECT COALESCE(MAX(id), 0) AS version FROM _sql_schema_migrations",
      )
      .one().version;

    if (version < 1) {
      this.ctx.storage.sql.exec(`
        CREATE TABLE receipt (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          kind TEXT NOT NULL,
          receipt_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          admin_hash TEXT NOT NULL
        );
        INSERT INTO _sql_schema_migrations (id) VALUES (1);
      `);
    }
  }

  async init(input: {
    kind: PublicReceiptKind;
    receipt: JsonValue;
    createdAt: number;
    expiresAt: number;
    adminTokenHash: string;
  }): Promise<{ created: boolean }> {
    if (this.deleted || this.receiptRow()) return { created: false };
    this.ctx.storage.sql.exec(
      `INSERT INTO receipt
        (id, kind, receipt_json, created_at, expires_at, admin_hash)
       VALUES (1, ?, ?, ?, ?, ?)`,
      input.kind,
      JSON.stringify(input.receipt),
      input.createdAt,
      input.expiresAt,
      input.adminTokenHash,
    );
    try {
      await this.ctx.storage.setAlarm(input.expiresAt);
    } catch (error) {
      await this.ctx.storage.deleteAll();
      this.deleted = true;
      throw error;
    }
    return { created: true };
  }

  async getReceipt(): Promise<PublicReceiptRecord> {
    if (this.deleted) return { status: "not_found" };
    const row = this.receiptRow();
    if (!row) return { status: "not_found" };
    if (Date.now() >= row.expires_at) {
      await this.clearStorage();
      return { status: "expired" };
    }
    try {
      return {
        status: "ready",
        kind: row.kind,
        receipt: JSON.parse(row.receipt_json) as JsonValue,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      };
    } catch {
      await this.clearStorage();
      return { status: "not_found" };
    }
  }

  async deleteReceipt(adminToken: string): Promise<PublicReceiptRecord> {
    if (this.deleted) return { status: "not_found" };
    const row = this.receiptRow();
    if (!row) return { status: "not_found" };
    const suppliedHash = await sha256(adminToken);
    if (!constantTimeEqual(suppliedHash, row.admin_hash)) return { status: "forbidden" };
    await this.clearStorage();
    return { status: "deleted" };
  }

  async alarm(): Promise<void> {
    await this.clearStorage();
  }

  private receiptRow(): ReceiptRow | null {
    if (this.deleted) return null;
    const rows = this.ctx.storage.sql
      .exec<ReceiptRow>(
        `SELECT kind, receipt_json, created_at, expires_at, admin_hash
         FROM receipt WHERE id = 1`,
      )
      .toArray();
    return rows[0] || null;
  }

  private async clearStorage(): Promise<void> {
    await this.ctx.storage.deleteAll();
    this.deleted = true;
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual(a: ArrayBufferView, b: ArrayBufferView): boolean;
  };
  return subtle.timingSafeEqual(leftBytes, rightBytes);
}
