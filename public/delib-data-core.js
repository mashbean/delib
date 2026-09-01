import { POCKET_POLIS_DATA_SCHEMA } from "./pocket-polis-data-core.js";
import { RANKING_SCHEMA } from "./power-ranker-core.js";

export const DELIB_DATA_SCHEMA = "https://delib.mashbean.net/schemas/delib-data/v1.json";

export function pocketPolisBundleToDelibData(bundle, transformedAt) {
  if (
    !bundle ||
    bundle.schema !== POCKET_POLIS_DATA_SCHEMA ||
    bundle.kind !== "pocket-polis-export" ||
    !Array.isArray(bundle.statements) ||
    !Array.isArray(bundle.votes)
  ) throw new Error("需要有效的 Pocket Polis 資料包");

  const phaseId = "phase-opinion";
  const transformed = validDateTime(transformedAt) || new Date().toISOString();
  return normalizeDelibDataBundle({
    schema: DELIB_DATA_SCHEMA,
    kind: "delib-data-bundle",
    bundleId: `pocket-polis:${bundle.source.conversationId}`,
    exportedAt: validDateTime(bundle.exportedAt) || transformed,
    source: {
      tool: "Pocket Polis",
      sourceSchema: POCKET_POLIS_DATA_SCHEMA,
      sourceId: bundle.source.conversationId,
      title: bundle.source.title,
      description: bundle.source.description,
      url: bundle.source.reportUrl,
    },
    phases: [{ id: phaseId, type: "opinion", title: bundle.source.title, status: "completed" }],
    items: bundle.statements.map((statement) => ({
      id: `statement:${statement.statementId}`,
      phaseId,
      type: "statement",
      text: statement.text,
      status: statement.status,
      origin: statement.isSeed ? "organizer" : "participant",
      createdAt: statement.createdAt,
    })),
    responses: bundle.votes.map((vote, index) => ({
      id: `vote:${index + 1}`,
      phaseId,
      subjectRef: `statement:${vote.statementId}`,
      participantRef: `participant:${vote.participant}`,
      response: vote.value === 1 ? "agree" : vote.value === -1 ? "disagree" : "pass",
      count: 1,
      occurredAt: vote.updatedAt,
    })),
    outcomes: bundle.statements.map((statement) => ({
      id: `statement-counts:${statement.statementId}`,
      phaseId,
      type: "response-counts",
      itemRef: `statement:${statement.statementId}`,
      counts: {
        agree: statement.agrees,
        disagree: statement.disagrees,
        pass: statement.passes,
      },
    })),
    summary: {
      participants: bundle.summary.participants,
      items: bundle.summary.statements,
      responses: bundle.summary.votes,
      coverage: bundle.summary.coverage,
    },
    provenance: {
      adapter: "delib:pocket-polis/v1",
      transformedAt: transformed,
      sourceArtifacts: Array.isArray(bundle.source.importedFiles) ? bundle.source.importedFiles : [],
      notes: [
        "participantRef 保留同一匿名參與者在本活動內的跨題串連能力。",
        "未新增 Pol.is 分群；Pocket Polis 原始匯出沒有群組欄位。",
      ],
    },
    dataCard: {
      containsParticipantData: true,
      containsDirectIdentifiers: false,
      containsParticipantFreeText: true,
      containsPseudonymousLinkage: true,
      aggregation: "individual-responses-plus-item-counts",
      publicationStatus: "local-private-export",
      storedByDelib: false,
      suitableForPublicSharing: false,
      limitations: [...(bundle.dataCard?.limitations || [])],
    },
  });
}

export function rankingBundleToDelibData(bundle, transformedAt) {
  if (
    !bundle ||
    bundle.schema !== RANKING_SCHEMA ||
    !["individual", "aggregate"].includes(bundle.kind) ||
    !Array.isArray(bundle.question?.items) ||
    !Array.isArray(bundle.result)
  ) throw new Error("需要有效的 Power Ranker 資料包");

  const phaseId = "phase-prioritize";
  const transformed = validDateTime(transformedAt) || new Date().toISOString();
  const individual = bundle.kind === "individual";
  const responses = individual
    ? bundle.judgments.map((judgment, index) => ({
        id: `judgment:${index + 1}`,
        phaseId,
        subjectRef: `option:${judgment.alpha}`,
        objectRef: `option:${judgment.beta}`,
        participantRef: `session:${bundle.session.id}`,
        response: judgment.choice === "alpha"
          ? "prefer-subject"
          : judgment.choice === "beta"
            ? "prefer-object"
            : "equal",
        count: 1,
        occurredAt: null,
      }))
    : bundle.aggregate.pairwise.flatMap((pair, pairIndex) => [
        ["prefer-subject", pair.alphaWins],
        ["prefer-object", pair.betaWins],
        ["equal", pair.equal],
      ].filter(([, count]) => count > 0).map(([response, count], responseIndex) => ({
        id: `pair:${pairIndex + 1}:${responseIndex + 1}`,
        phaseId,
        subjectRef: `option:${pair.alpha}`,
        objectRef: `option:${pair.beta}`,
        participantRef: null,
        response,
        count,
        occurredAt: null,
      })));

  const sessions = individual ? 1 : bundle.aggregate.sessions;
  const responseCount = individual ? bundle.judgments.length : bundle.aggregate.judgments;
  return normalizeDelibDataBundle({
    schema: DELIB_DATA_SCHEMA,
    kind: "delib-data-bundle",
    bundleId: `power-ranker:${bundle.kind}:${String(bundle.exportedAt || transformed)}`,
    exportedAt: validDateTime(bundle.exportedAt) || transformed,
    source: {
      tool: "Power Ranker",
      sourceSchema: RANKING_SCHEMA,
      sourceId: bundle.kind,
      title: bundle.question.title,
      description: "以成對比較形成相對排序。",
      url: cleanUrl(bundle.source?.url),
    },
    phases: [{ id: phaseId, type: "prioritize", title: bundle.question.title, status: "completed" }],
    items: bundle.question.items.map((item) => ({
      id: `option:${item.id}`,
      phaseId,
      type: "option",
      text: item.label,
      status: "active",
      origin: "organizer",
      createdAt: null,
    })),
    responses,
    outcomes: bundle.result.map((item) => ({
      id: `ranking:${item.id}`,
      phaseId,
      type: "relative-ranking",
      itemRef: `option:${item.id}`,
      rank: item.rank,
      score: item.score,
      observations: item.observations,
    })),
    summary: {
      participants: sessions,
      items: bundle.question.items.length,
      responses: responseCount,
      coverage: bundle.coverage.ratio,
    },
    provenance: {
      adapter: `delib:power-ranker-${bundle.kind}/v1`,
      transformedAt: transformed,
      sourceArtifacts: [],
      notes: [
        "模型分數是相對排序權重，不是支持率或共識證明。",
        individual
          ? "participantRef 是單一瀏覽器 session，必須保留在私人流程。"
          : "群體檔只有配對計數，無法還原每個 session 的完整判斷。",
      ],
    },
    dataCard: {
      containsParticipantData: true,
      containsDirectIdentifiers: false,
      containsParticipantFreeText: false,
      containsPseudonymousLinkage: individual,
      aggregation: individual ? "one-browser-session" : "pair-counts-without-session-links",
      publicationStatus: individual ? "local-private-export" : bundle.dataCard.publicationStatus,
      storedByDelib: bundle.dataCard.storedByDelib === true,
      suitableForPublicSharing: !individual,
      limitations: [...(bundle.dataCard?.limitations || [])],
    },
  });
}

export function normalizeDelibDataBundle(value) {
  if (
    !value ||
    value.schema !== DELIB_DATA_SCHEMA ||
    value.kind !== "delib-data-bundle" ||
    typeof value.bundleId !== "string" ||
    !validDateTime(value.exportedAt) ||
    !value.source ||
    !Array.isArray(value.phases) ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.responses) ||
    !Array.isArray(value.outcomes) ||
    !value.dataCard
  ) throw new Error("delib-data/v1 資料包格式不完整");
  return structuredClone(value);
}

function validDateTime(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function cleanUrl(value) {
  try {
    const url = new URL(String(value));
    url.hash = "";
    return url.toString();
  } catch {
    return "https://delib.mashbean.net/integrations/power-ranker.html";
  }
}
