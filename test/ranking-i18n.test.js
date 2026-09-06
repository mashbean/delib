import { describe, expect, it } from "vitest";
import { RANKING_EN, formatRankingTemplate, rankingLanguage, rankingLanguageUrl, tr } from "../public/ranking-i18n.js";

describe("ranking language and shared links", () => {
  it("translates the interaction while preserving participant-authored values", () => {
    expect(formatRankingTemplate(["权重 ", ""], [3], "en")).toBe("权重 3");
    expect(formatRankingTemplate(["", ". ", " — 模型權重 ", ""], [1, "保留草地 ${2}", "0.300"], "en"))
      .toBe("1. 保留草地 ${2} — model weight 0.300");
    expect(tr("這是參與者自己的中文理由", "en")).toBe("這是參與者自己的中文理由");
  });
  it("keeps Chinese as the default and localizes English questions explicitly", () => {
    expect(rankingLanguage("https://delib.example/rank")).toBe("zh");
    expect(rankingLanguage("https://delib.example/rank?lang=en")).toBe("en");
    expect(tr("兩項一樣重要", "en")).toBe("Equally important");
    expect(tr("兩項一樣重要", "zh")).toBe("兩項一樣重要");
  });
  it("preserves ranking configuration and room credentials when language changes", () => {
    expect(rankingLanguageUrl("/integrations/power-ranker?room=abc#admin=secret", { language: "en", station: true }))
      .toBe("https://delib.example/rank?room=abc&lang=en#admin=secret");
    expect(rankingLanguageUrl("/results/power-ranker#receipt=encoded", { language: "en" }))
      .toBe("https://delib.example/results/power-ranker?lang=en#receipt=encoded");
  });
  it("does not modify external evidence links", () => {
    expect(rankingLanguageUrl("https://evidence.example/report?round=2", { language: "en" }))
      .toBe("https://evidence.example/report?round=2");
  });
  it("has English text for every catalog entry", () => {
    expect(Object.keys(RANKING_EN).length).toBeGreaterThan(200);
    for (const [key, value] of Object.entries(RANKING_EN)) {
      expect(/[\u3400-\u9fff]/.test(value), key).toBe(false);
      const placeholders = (input) => [...input.matchAll(/\$\{\d+\}/g)].map((match) => match[0]).sort();
      expect(placeholders(value), key).toEqual(placeholders(key));
    }
  });
});
