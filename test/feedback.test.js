import { describe, expect, it } from "vitest";
import {
  DELIB_FEEDBACK_SCHEMA,
  createFeedbackRecord,
  feedbackGitHubUrl,
  feedbackToMarkdown,
} from "../public/feedback-core.js";

const fixture = {
  role: "organizer",
  phase: "export",
  category: "schema-gap",
  severity: "degraded",
  tool: "Pocket Polis → TTTC",
  summary: "匯出後缺少來源活動代碼",
  expected: "下游可以辨識來源活動。",
  actual: "目前只有陳述 ID 與文字。",
  reproduction: "使用三句虛構陳述輸出 TTTC CSV。",
  workaround: "人工在專案名稱補上活動代碼。",
  environment: "Safari；Delib public site",
  publicUrl: "https://delib.mashbean.net/r/abcdef0123456789",
  confirmed: true,
};

describe("developer feedback loop", () => {
  it("builds a previewable, explicitly user-submitted feedback contract", () => {
    const record = createFeedbackRecord(fixture, "2026-09-01T00:00:00.000Z");
    expect(record.schema).toBe(DELIB_FEEDBACK_SCHEMA);
    expect(record.dataCard).toEqual({
      containsParticipantContent: false,
      containsDirectIdentifiers: false,
      containsCredentials: false,
      submittedAutomatically: false,
      destination: "user-selected-download-or-github-issue",
    });
    expect(feedbackToMarkdown(record)).toContain("如何重現");
    const issue = new URL(feedbackGitHubUrl(record));
    expect(issue.hostname).toBe("github.com");
    expect(issue.searchParams.get("body")).toContain("不含參與內容");
  });

  it("rejects private fragments and unconfirmed reports", () => {
    expect(() => createFeedbackRecord({ ...fixture, publicUrl: `${fixture.publicUrl}#delete=secret` })).toThrow("不能包含 #");
    expect(() => createFeedbackRecord({ ...fixture, confirmed: false })).toThrow("確認");
  });
});
