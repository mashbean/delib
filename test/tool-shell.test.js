import { describe, expect, it } from "vitest";
import { activityToStationUrl, buildToolUrl, stationNavigationUrl } from "../public/tool-shell-core.js";
import stations from "../public/data/tool-stations.json";

const form = stations.find((station) => station.slug === "form");
describe("tool station navigation", () => {
  it("keeps activity paths, language and fragment credentials within the chosen service", () => {
    const result = buildToolUrl("https://delib.example/form/h/abcdefghij?lang=en#admin=private-key", form, form.origin);
    expect(result.href).toBe("https://form.mashbean.net/h/abcdefghij?lang=en#admin=private-key");
    expect(stationNavigationUrl("tttc", "en")).toBe("/tttc?lang=en");
  });
  it("removes query credentials before loading the tool", () => {
    const result = buildToolUrl("https://delib.example/form/h/abcdefghij?token=private-key&lang=en", form, form.origin);
    expect(result.search).toBe("?lang=en");
    expect(result.hash).toBe("#admin=private-key");
  });
  it("uses each tool's actual capability fragment name", () => {
    const polis = stations.find(s => s.slug === "polis");
    const callIn = stations.find(s => s.slug === "call-in");
    expect(buildToolUrl("https://delib.example/polis/a/demo?token=private-key", polis, polis.origin).hash).toBe("#token=private-key");
    const event = activityToStationUrl("https://call-in.mashbean.net/e/demo/setup/?access=private-key", callIn, callIn.origin, "https://delib.example", "en");
    expect(event.search).toBe("?lang=en");
    expect(event.hash).toBe("#access=private-key");
  });
  it("cannot turn a path or return parameter into a different service origin", () => {
    for (const path of ["/form//evil.example/h", "/form/%2f%2fevil.example", "/form/%5cevil.example"]) {
      expect(() => buildToolUrl(`https://delib.example${path}`, form, form.origin)).toThrow();
    }
    const result = buildToolUrl("https://delib.example/form?url=https://evil.example", form, form.origin);
    expect(result.origin).toBe(form.origin);
  });
  it("supports TTTC aliases, English landing pages and existing ranking links", () => {
    const tttc = stations.find((station) => station.slug === "tttc");
    expect(buildToolUrl("https://delib.example/ttt-city/r/abcdefghij/canvas", tttc, tttc.origin).pathname).toBe("/r/abcdefghij/canvas");
    const polis = stations.find((station) => station.slug === "polis");
    expect(buildToolUrl("https://delib.example/polis?lang=en", polis, polis.origin).pathname).toBe("/en");
    const rank = stations.find((station) => station.slug === "rank");
    const ranked = buildToolUrl("https://delib.example/rank?room=abc#admin=xyz", rank, "https://delib.example");
    expect(ranked.href).toBe("https://delib.example/integrations/power-ranker?room=abc#admin=xyz");
  });
  it("converts an existing activity into a station link without putting keys in a query", () => {
    const result = activityToStationUrl("https://form.mashbean.net/h/abcdefghij?token=private-key", form, form.origin, "https://delib.example", "en");
    expect(result.href).toBe("https://delib.example/form/h/abcdefghij?lang=en#admin=private-key");
    expect(() => activityToStationUrl("https://evil.example/h/abcdefghij", form, form.origin, "https://delib.example", "en")).toThrow();
    expect(() => activityToStationUrl("https://user:pass@form.mashbean.net/h/abcdefghij", form, form.origin, "https://delib.example", "en")).toThrow();
  });
});
