import { describe, expect, it } from "vitest";
import { buildAudit } from "../scripts/audit-interoperability.mjs";

describe("read-only interoperability audit", () => {
  it("keeps every catalog tool covered exactly once", async () => {
    const audit = await buildAudit();
    expect(audit.coverage).toMatchObject({ complete: true, missingFromAudit: [], unknownAuditIds: [] });
    expect(audit.counts.tools).toBe(38);
  });

  it("describes the current adapter boundary without overstating it", async () => {
    const audit = await buildAudit();
    expect(audit.adapterCoverage.find((item) => item.name === "Pocket Polis").implemented).toBe(true);
    expect(audit.adapterCoverage.find((item) => item.name === "Power Ranker").implemented).toBe(true);
    expect(audit.adapterCoverage.find((item) => item.name === "TTTC CSV").implemented).toBe(true);
    for (const name of ["Form native JSON", "Harmonica native JSON", "TTTC report JSON", "Reply native JSON"]) {
      expect(audit.adapterCoverage.find((item) => item.name === name).implemented).toBe(true);
    }
  });
});
