import { DurableObject } from "cloudflare:workers";

export type RankingChoice = "alpha" | "beta" | "equal";

export type RankingItem = {
  id: string;
  label: string;
};

export type RankingJudgment = {
  alpha: string;
  beta: string;
  choice: RankingChoice;
};

export type RankingRoomConfig = {
  title: string;
  items: RankingItem[];
  createdAt: number;
  expiresAt: number;
  adminTokenHash: string;
};

export type RankingRoomRpcResult = {
  status: string;
  duplicate?: boolean;
  limit?: number;
  question?: { title: string; items: RankingItem[] };
  createdAt?: number;
  expiresAt?: number;
  aggregate?: {
    sessions: number;
    judgments: number;
    pairwise: Array<{
      alpha: string;
      beta: string;
      alphaWins: number;
      betaWins: number;
      equal: number;
      total: number;
    }>;
  } | null;
  resultThreshold?: number;
  sessionsReceived?: number;
  admin?: boolean;
  acceptingSubmissions?: boolean;
  sessionLimit?: number;
  dataCard?: {
    storedByDelib: boolean;
    containsDirectIdentifiers: boolean;
    containsParticipantFreeText: boolean;
    storedFields: string[];
    rawJudgmentsStored: boolean;
  };
};

type RoomRow = {
  title: string;
  items_json: string;
  created_at: number;
  expires_at: number;
  admin_hash: string;
  sessions: number;
  judgments: number;
};

type PairRow = {
  alpha: string;
  beta: string;
  alpha_wins: number;
  beta_wins: number;
  equal_count: number;
};

const MAX_SESSIONS = 300;
const PUBLIC_RESULT_THRESHOLD = 3;

/**
 * One short-lived ranking room per Durable Object.
 *
 * The schema is created only inside `init()`, never in the constructor, so a
 * request for an expired or unknown room does not re-create tables that no
 * alarm would ever clean up again.
 */
export class RankingRoom extends DurableObject<Env> {
  private deleted = false;

  private ensureSchema(): void {
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
        CREATE TABLE room (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          title TEXT NOT NULL,
          items_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          admin_hash TEXT NOT NULL,
          sessions INTEGER NOT NULL DEFAULT 0,
          judgments INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE sessions (
          session_hash TEXT PRIMARY KEY,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE pair_counts (
          alpha TEXT NOT NULL,
          beta TEXT NOT NULL,
          alpha_wins INTEGER NOT NULL DEFAULT 0,
          beta_wins INTEGER NOT NULL DEFAULT 0,
          equal_count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (alpha, beta)
        );
        INSERT INTO _sql_schema_migrations (id) VALUES (1);
      `);
    }
  }

  private hasSchema(): boolean {
    return this.ctx.storage.sql
      .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'room'")
      .toArray().length > 0;
  }

  async init(config: RankingRoomConfig): Promise<{ created: boolean }> {
    if (this.deleted) return { created: false };
    this.ensureSchema();
    if (this.roomRow()) return { created: false };
    this.ctx.storage.sql.exec(
      `INSERT INTO room
        (id, title, items_json, created_at, expires_at, admin_hash)
       VALUES (1, ?, ?, ?, ?, ?)`,
      config.title,
      JSON.stringify(config.items),
      config.createdAt,
      config.expiresAt,
      config.adminTokenHash,
    );
    try {
      await this.ctx.storage.setAlarm(config.expiresAt);
    } catch (error) {
      await this.clearStorage();
      throw error;
    }
    return { created: true };
  }

  async getRoom(adminToken?: string): Promise<RankingRoomRpcResult> {
    if (this.deleted) return { status: "not_found" };
    const suppliedHash = adminToken ? await sha256(adminToken) : "";
    const row = this.roomRow();
    if (!row) return { status: "not_found" };
    if (Date.now() >= row.expires_at) {
      await this.clearStorage();
      return { status: "expired" };
    }

    const isAdmin = Boolean(suppliedHash) && constantTimeEqual(suppliedHash, row.admin_hash);
    if (adminToken && !isAdmin) return { status: "forbidden" };
    return this.snapshot(row, isAdmin);
  }

  async submit(sessionId: string, rawJudgments: RankingJudgment[]): Promise<RankingRoomRpcResult> {
    if (this.deleted) return { status: "not_found" };
    const sessionHash = await sha256(sessionId);
    const row = this.roomRow();
    if (!row) return { status: "not_found" };
    if (Date.now() >= row.expires_at) {
      await this.clearStorage();
      return { status: "expired" };
    }

    const items = parseItems(row.items_json);
    const judgments = normalizeJudgments(items, rawJudgments);
    if (judgments.length < items.length - 1) return { status: "invalid" };

    const duplicate = this.ctx.storage.sql
      .exec<{ found: number }>(
        "SELECT EXISTS(SELECT 1 FROM sessions WHERE session_hash = ?) AS found",
        sessionHash,
      )
      .one().found === 1;
    if (duplicate) return { ...this.snapshot(row, false), duplicate: true };
    if (row.sessions >= MAX_SESSIONS) return { status: "full", limit: MAX_SESSIONS };

    this.ctx.storage.sql.exec(
      "INSERT INTO sessions (session_hash, created_at) VALUES (?, ?)",
      sessionHash,
      Date.now(),
    );
    for (const judgment of judgments) {
      const alphaWins = judgment.choice === "alpha" ? 1 : 0;
      const betaWins = judgment.choice === "beta" ? 1 : 0;
      const equalCount = judgment.choice === "equal" ? 1 : 0;
      this.ctx.storage.sql.exec(
        `INSERT INTO pair_counts (alpha, beta, alpha_wins, beta_wins, equal_count)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(alpha, beta) DO UPDATE SET
           alpha_wins = alpha_wins + excluded.alpha_wins,
           beta_wins = beta_wins + excluded.beta_wins,
           equal_count = equal_count + excluded.equal_count`,
        judgment.alpha,
        judgment.beta,
        alphaWins,
        betaWins,
        equalCount,
      );
    }
    this.ctx.storage.sql.exec(
      "UPDATE room SET sessions = sessions + 1, judgments = judgments + ? WHERE id = 1",
      judgments.length,
    );
    const updated = this.roomRow();
    return updated ? { ...this.snapshot(updated, false), duplicate: false } : { status: "not_found" };
  }

  async deleteRoom(adminToken: string): Promise<RankingRoomRpcResult> {
    if (this.deleted) return { status: "not_found" };
    const suppliedHash = await sha256(adminToken);
    const row = this.roomRow();
    if (!row) return { status: "not_found" };
    if (!constantTimeEqual(suppliedHash, row.admin_hash)) return { status: "forbidden" };
    await this.clearStorage();
    return { status: "deleted" };
  }

  async alarm(): Promise<void> {
    await this.clearStorage();
  }

  private roomRow(): RoomRow | null {
    if (this.deleted || !this.hasSchema()) return null;
    const rows = this.ctx.storage.sql
      .exec<RoomRow>(
        `SELECT title, items_json, created_at, expires_at, admin_hash, sessions, judgments
         FROM room WHERE id = 1`,
      )
      .toArray();
    return rows[0] || null;
  }

  private snapshot(row: RoomRow, admin: boolean): RankingRoomRpcResult {
    const items = parseItems(row.items_json);
    const resultVisible = admin || row.sessions >= PUBLIC_RESULT_THRESHOLD;
    const pairwise = resultVisible
      ? this.ctx.storage.sql
          .exec<PairRow>(
            `SELECT alpha, beta, alpha_wins, beta_wins, equal_count
             FROM pair_counts ORDER BY alpha, beta`,
          )
          .toArray()
          .map((pair) => ({
            alpha: pair.alpha,
            beta: pair.beta,
            alphaWins: pair.alpha_wins,
            betaWins: pair.beta_wins,
            equal: pair.equal_count,
            total: pair.alpha_wins + pair.beta_wins + pair.equal_count,
          }))
      : null;

    return {
      status: "ready",
      question: { title: row.title, items },
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      aggregate: resultVisible && pairwise
        ? { sessions: row.sessions, judgments: row.judgments, pairwise }
        : null,
      resultThreshold: PUBLIC_RESULT_THRESHOLD,
      sessionsReceived: row.sessions,
      admin,
      acceptingSubmissions: row.sessions < MAX_SESSIONS,
      sessionLimit: MAX_SESSIONS,
      dataCard: {
        storedByDelib: true,
        containsDirectIdentifiers: false,
        containsParticipantFreeText: false,
        storedFields: ["question", "aggregate pair counts", "hashed random session IDs"],
        rawJudgmentsStored: false,
      },
    };
  }

  private async clearStorage(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.deleted = true;
  }
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function parseItems(value: string): RankingItem[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as RankingItem[]) : [];
  } catch {
    return [];
  }
}

function normalizeJudgments(items: RankingItem[], value: unknown): RankingJudgment[] {
  if (!Array.isArray(value)) return [];
  const positions = new Map(items.map((item, index) => [item.id, index]));
  const seen = new Set<string>();
  const normalized: RankingJudgment[] = [];
  for (const raw of value.slice(0, 45)) {
    if (!isRecord(raw)) continue;
    let alpha = cleanId(raw.alpha);
    let beta = cleanId(raw.beta);
    let choice = cleanChoice(raw.choice);
    if (!alpha || !beta || !choice || alpha === beta || !positions.has(alpha) || !positions.has(beta)) continue;
    if ((positions.get(alpha) || 0) > (positions.get(beta) || 0)) {
      [alpha, beta] = [beta, alpha];
      if (choice === "alpha") choice = "beta";
      else if (choice === "beta") choice = "alpha";
    }
    const key = `${alpha}:${beta}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ alpha, beta, choice });
  }
  return normalized;
}

function cleanId(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value) ? value : "";
}

function cleanChoice(value: unknown): RankingChoice | null {
  return value === "alpha" || value === "beta" || value === "equal" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
