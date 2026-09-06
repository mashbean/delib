import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FLOW_SCHEMA, PHASE_IDS, validateFlowBundle, getRoundStats, getStepState,
  exportRoundBundle, exportTttcCsv, exportPolisSeeds, roundToDelibData,
} from "../public/flow-core.js";
import { parseTttcCsv } from "../public/tttc-csv-core.js";
import { normalizeDelibDataBundle, DELIB_DATA_SCHEMA } from "../public/delib-data-core.js";

const demo = JSON.parse(readFileSync(new URL("../public/data/flow-demo.json", import.meta.url)));
const schema = JSON.parse(readFileSync(new URL("../public/schemas/delib-rounds/v1.json", import.meta.url)));
const copy = () => structuredClone(demo);

describe("iterative deliberation and synthetic demo", () => {
  it("publishes the stable versioned schema and a complete bilingual, explicitly synthetic graph", () => {
    expect(schema.$id).toBe(FLOW_SCHEMA);
    expect(schema.properties.schema.const).toBe(FLOW_SCHEMA);
    expect(validateFlowBundle(demo)).toMatchObject({ valid: true, errors: [] });
    expect(demo.simulated).toBe(true);
    expect(demo.rounds).toHaveLength(3);
    expect(demo.participants).toHaveLength(14);
    for (const round of demo.rounds) {
      expect(round.phases.map((p) => p.id)).toEqual(PHASE_IDS);
      expect(round.attendance).toHaveLength(12);
      expect(round.artifacts.every((a) => a.simulated)).toBe(true);
      expect(round.next.carryForwardRefs.length).toBeGreaterThan(0);
      expect(round.next.owner.en).toBeTruthy();
      for (const language of ["zh", "en"]) for (const phaseId of PHASE_IDS) {
        const state = getStepState(demo, { roundId: round.id, phaseId, language });
        expect(state.title && state.input && state.output && state.guidance).toBeTruthy();
        expect(state.stats.online + state.stats.inPerson).toBe(state.stats.participants);
      }
    }
  });

  it("derives stats from actual fictional rows and preserves minority opposition across rounds", () => {
    expect(demo.rounds.map((r) => getRoundStats(demo, r.id).responses)).toEqual([48, 48, 48]);
    expect(demo.rounds.map((r) => getRoundStats(demo, r.id).online)).toEqual([8, 5, 7]);
    expect(demo.rounds.map((r) => getRoundStats(demo, r.id).inPerson)).toEqual([4, 7, 5]);
    expect(demo.rounds.map((r) => getRoundStats(demo, r.id).unresolved)).toEqual([1, 1, 1]);
    for (const round of demo.rounds) {
      expect(round.responses.some((r) => r.value === "disagree")).toBe(true);
      expect(round.responses.some((r) => r.value === "pass")).toBe(true);
    }
    expect(demo.rounds.map((r) => r.next.phaseId)).toEqual(["recruit", "learn", "frame"]);
    expect(demo.rounds[1].phases[0].inputRefs).toEqual(demo.rounds[0].next.carryForwardRefs);
    expect(demo.rounds[2].phases[0].inputRefs).toEqual(demo.rounds[1].next.carryForwardRefs);
  });

  it("produces deterministic TTTC CSV that round-trips source IDs, Unicode, commas, quotes and line breaks", () => {
    const bundle = copy();
    const statement = bundle.rounds[0].artifacts.find((a) => a.kind === "statement");
    statement.text.en = 'A comma, a "quote"\nand a new line.';
    const csv = exportTttcCsv(bundle, { roundId: "r1", language: "en" });
    expect(csv).toBe(exportTttcCsv(bundle, { roundId: "r1", language: "en" }));
    const parsed = parseTttcCsv({ text: csv, label: "round-1.csv" });
    expect(parsed.rows).toHaveLength(16);
    expect(new Set(parsed.rows.map((r) => r.id)).size).toBe(16);
    expect(parsed.rows.find((r) => r.id === statement.id).comment).toBe(statement.text.en);
    expect(parsed.rows.every((r) => r.interview === "")).toBe(true);
    expect(parseTttcCsv({ text: exportTttcCsv(bundle, { roundId: "r1", includeParticipantRefs: true }), label: "private.csv" }).rows.some((r) => r.interview === "p01")).toBe(true);
  });

  it("blocks identifier-bearing exports and keeps real linked records private", () => {
    for (const pii of ["member@example.org", "0912-345-678", "A123456789"]) {
      const bundle = copy();
      bundle.rounds[0].artifacts[0].text.en = `Contact ${pii}`;
      expect(validateFlowBundle(bundle).valid).toBe(false);
      expect(() => exportTttcCsv(bundle, { roundId: "r1" })).toThrow(/identifiers/);
    }
    const real = copy();
    real.simulated = false;
    for (const round of real.rounds) for (const a of round.artifacts) a.simulated = false;
    expect(validateFlowBundle(real).errors.join(" ")).toContain("remain private");
    real.dataCard.suitableForPublicSharing = false;
    expect(validateFlowBundle(real).valid).toBe(true);
    expect(validateFlowBundle(real).warnings.join(" ")).toContain("cannot certify anonymization or consent");
  });

  it("preserves earlier rounds in an export so cross-round provenance never becomes dangling", () => {
    const exported = exportRoundBundle(demo, "r2");
    expect(exported.rounds.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(validateFlowBundle(exported).valid).toBe(true);
    expect(exported.dataCard.suitableForPublicSharing).toBe(false);
    expect(demo.dataCard.suitableForPublicSharing).toBe(true);
    exported.rounds[0].artifacts[0].text.en = "changed";
    expect(demo.rounds[0].artifacts[0].text.en).not.toBe("changed");
  });

  it("rejects broken provenance, duplicate votes, unavailable participants and same-phase cycles", () => {
    const mutations = [
      (b) => b.rounds[1].artifacts[0].derivedFrom.push("missing:artifact"),
      (b) => b.rounds[0].artifacts[0].derivedFrom.push(b.rounds[1].artifacts[0].id),
      (b) => b.rounds[0].responses.push({ ...b.rounds[0].responses[0], id: "duplicate:vote" }),
      (b) => { b.rounds[0].responses[0].participantRef = "uninvited:person"; },
      (b) => { b.rounds[1].responses[0].itemRef = b.rounds[0].responses[0].itemRef; },
      (b) => {
        const pair = b.rounds[0].artifacts.filter((a) => a.kind === "proposal").slice(0, 2);
        pair[0].derivedFrom.push(pair[1].id);
        pair[1].derivedFrom.push(pair[0].id);
      },
    ];
    for (const mutate of mutations) { const b = copy(); mutate(b); expect(validateFlowBundle(b).valid).toBe(false); }
  });

  it("exports only reviewed seeds, keeps provenance, and refuses destructive truncation", () => {
    const result = exportPolisSeeds(demo, { roundId: "r1", language: "en" });
    expect(result.seedStatements).toHaveLength(4);
    expect(result.seedStatements.every((s) => s.length <= 280)).toBe(true);
    expect(result.provenance).toHaveLength(4);
    expect(result).not.toHaveProperty("votes");
    expect(result).not.toHaveProperty("participants");
    const b = copy();
    b.rounds[0].artifacts.find((a) => a.kind === "proposal").text.en = "x".repeat(281);
    expect(() => exportPolisSeeds(b, { roundId: "r1", language: "en" })).toThrow(/instead of truncating/);
    b.rounds[0].artifacts.filter((a) => a.kind === "proposal").forEach((a) => { a.reviewed = false; });
    expect(() => exportPolisSeeds(b, { roundId: "r1" })).toThrow(/facilitator must review/);
  });

  it("rejects withdrawals before any export and does not label real records as simulation", () => {
    const withdrawn = copy();
    withdrawn.rounds[0].artifacts.find((a) => a.kind === "statement").status = "withdrawn";
    expect(validateFlowBundle(withdrawn).errors.join(" ")).toContain("withdrawn records");
    expect(() => exportTttcCsv(withdrawn, { roundId: "r1" })).toThrow(/withdrawn/);
    expect(() => exportRoundBundle(withdrawn, "r1")).toThrow(/withdrawn/);
    const real = copy(); real.simulated = false; real.dataCard.suitableForPublicSharing = false;
    for (const round of real.rounds) for (const artifact of round.artifacts) artifact.simulated = false;
    const exported = roundToDelibData(real, "r1", "en");
    expect(exported.source.tool).toBe("Delib round");
    expect(exported.source.url).toContain("#data");
    expect(exported.provenance.notes.join(" ")).not.toContain("fictional");
    expect(exported.provenance.notes.join(" ")).toContain("keep this export private");
  });

  it("guards CSV formula cells and maps vote counts into the existing delib-data envelope", () => {
    const b = copy();
    b.rounds[0].artifacts.find((a) => a.kind === "statement").text.en = '=HYPERLINK("https://example.org")';
    expect(exportTttcCsv(b, { roundId: "r1", language: "en" })).toContain("'=HYPERLINK");
    const portable = roundToDelibData(demo, "r1", "en");
    expect(portable.schema).toBe(DELIB_DATA_SCHEMA);
    expect(normalizeDelibDataBundle(portable)).toEqual(portable);
    expect(portable.summary).toMatchObject({ participants: 12, items: 33, responses: 48, coverage: 1 });
    expect(portable.outcomes.map((o) => o.counts)).toEqual([
      { agree: 8, disagree: 3, pass: 1 }, { agree: 11, disagree: 0, pass: 1 },
      { agree: 3, disagree: 8, pass: 1 }, { agree: 10, disagree: 1, pass: 1 },
    ]);
    expect(portable.dataCard.suitableForPublicSharing).toBe(false);
    expect(portable.provenance.sourceArtifacts).toHaveLength(33);
  });
});
