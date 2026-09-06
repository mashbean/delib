import { csvTable, formulaSafeCell } from "./pocket-polis-data-core.js";
import { DELIB_DATA_SCHEMA } from "./delib-data-core.js";

export const FLOW_SCHEMA = "https://delib.mashbean.net/schemas/delib-rounds/v1.json";
export const PHASE_IDS = Object.freeze(["frame", "recruit", "sortition", "learn", "listen", "deliberate", "respond", "feedback"]);
export const PHASE_TITLES = Object.freeze({
  frame: { zh: "定義問題與權限", en: "Frame the question" },
  recruit: { zh: "招募與接觸", en: "Invite and include" },
  sortition: { zh: "檢查代表性與抽樣", en: "Check who is missing" },
  learn: { zh: "共同學習與提問", en: "Learn and question" },
  listen: { zh: "聆聽經驗與陳述", en: "Listen to experiences" },
  deliberate: { zh: "審議、比較與修訂", en: "Deliberate and revise" },
  respond: { zh: "決定、回覆與承諾", en: "Respond and commit" },
  feedback: { zh: "回饋與下一輪", en: "Reflect and begin again" },
});

const PII = /[\w.+-]+@[\w-]+\.[\w.-]+|(?:\+?886|0)9\d{2}[-\s]?\d{3}[-\s]?\d{3}\b|\b[A-Z][12]\d{8}\b/i;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9:_./-]{0,119}$/;
const localized = (value, language = "zh") => typeof value === "string" ? value : value?.[language === "en" ? "en" : "zh"] || "";
const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** A strict graph/privacy check in addition to the published JSON schema. No network or storage. */
export function validateFlowBundle(bundle) {
  const errors = [];
  const warnings = [];
  if (!object(bundle)) return { valid: false, errors: ["Bundle must be an object."], warnings };
  if (bundle.schema !== FLOW_SCHEMA || bundle.kind !== "delib-rounds-bundle") errors.push("Unknown rounds schema or kind.");
  if (!ID.test(bundle.id || "")) errors.push("A stable bundle id is required.");
  if (!object(bundle.issue) || !bundle.issue.title?.zh || !bundle.issue.title?.en) errors.push("Bilingual issue title is required.");
  if (typeof bundle.simulated !== "boolean") errors.push("Simulation status must be explicit.");
  if (!Array.isArray(bundle.participants) || !Array.isArray(bundle.rounds) || !bundle.rounds.length) errors.push("Participants and nonempty rounds are required.");
  if (!object(bundle.dataCard) || bundle.dataCard.containsDirectIdentifiers !== false) errors.push("Do not put contact details or direct identifiers in a rounds bundle.");
  if (!bundle.simulated && bundle.dataCard?.suitableForPublicSharing !== false) errors.push("Real participant rounds must remain private; publish a reviewed aggregate separately.");
  if (!Number.isFinite(Date.parse(bundle.generatedAt))) errors.push("A valid generation timestamp is required.");
  if (bundle.simulated && list(bundle.participants).some((p) => p.simulated !== true)) errors.push("Every demo participant must be explicitly fictional.");
  const participantIds = new Set();
  for (const participant of list(bundle.participants)) {
    if (!ID.test(participant.id || "") || participantIds.has(participant.id)) errors.push(`Invalid or duplicate participant id: ${participant.id}`);
    participantIds.add(participant.id);
  }
  const roundIds = new Set();
  const artifactIndex = new Map();
  const responseIds = new Set();
  list(bundle.rounds).forEach((round, roundIndex) => {
    if (!ID.test(round.id || "") || roundIds.has(round.id)) errors.push(`Invalid or duplicate round id: ${round.id}`);
    roundIds.add(round.id);
    if (round.sequence !== roundIndex + 1) errors.push(`Round ${round.id}: sequence is not consecutive.`);
    if (round.previousRoundId !== (bundle.rounds[roundIndex - 1]?.id ?? null)) errors.push(`Round ${round.id}: previous round link is broken.`);
    if (list(round.phases).map((p) => p.id).join(",") !== PHASE_IDS.join(",")) errors.push(`Round ${round.id}: all eight ordered phases are required.`);
    const attendance = new Set();
    for (const entry of list(round.attendance)) {
      if (!participantIds.has(entry.participantRef) || attendance.has(entry.participantRef)) errors.push(`Round ${round.id}: invalid or duplicate attendance.`);
      attendance.add(entry.participantRef);
      if (!["online", "in-person"].includes(entry.mode)) errors.push(`Round ${round.id}: invalid attendance mode.`);
    }
    for (const artifact of list(round.artifacts)) {
      if (!ID.test(artifact.id || "") || artifactIndex.has(artifact.id)) errors.push(`Invalid or duplicate artifact id: ${artifact.id}`);
      if (!PHASE_IDS.includes(artifact.phaseId)) errors.push(`Artifact ${artifact.id}: unknown phase.`);
      if (!artifact.text?.zh || !artifact.text?.en || Math.max(artifact.text?.zh?.length || 0, artifact.text?.en?.length || 0) > 2000) errors.push(`Artifact ${artifact.id}: bilingual text must contain 1–2000 characters.`);
      if (!artifact.source?.tool || !artifact.source?.sourceId || !artifact.source?.artifactId) errors.push(`Artifact ${artifact.id}: original source identifiers are required.`);
      if (!["brief", "statement", "question", "inclusion-check", "theme", "proposal", "reply", "decision", "feedback"].includes(artifact.kind)) errors.push(`Artifact ${artifact.id}: unsupported kind.`);
      if (!["draft", "reviewed", "needs-response"].includes(artifact.status)) errors.push(`Artifact ${artifact.id}: unsupported status; withdrawn records must not be re-exported.`);
      if (typeof artifact.reviewed !== "boolean") errors.push(`Artifact ${artifact.id}: review status must be explicit.`);
      if (artifact.participantRef != null && !attendance.has(artifact.participantRef)) errors.push(`Artifact ${artifact.id}: participant is not attending this round.`);
      if (artifact.simulated !== bundle.simulated) errors.push(`Artifact ${artifact.id}: simulation status differs from its bundle.`);
      artifactIndex.set(artifact.id, { artifact, roundIndex });
    }
  });
  list(bundle.rounds).forEach((round, roundIndex) => {
    const availableRef = (ref, currentPhase) => {
      const found = artifactIndex.get(ref);
      return found && (found.roundIndex < roundIndex || (found.roundIndex === roundIndex && PHASE_IDS.indexOf(found.artifact.phaseId) <= PHASE_IDS.indexOf(currentPhase)));
    };
    for (const artifact of list(round.artifacts)) {
      if (!Array.isArray(artifact.derivedFrom)) errors.push(`Artifact ${artifact.id}: derivedFrom must be an array.`);
      for (const ref of list(artifact.derivedFrom)) {
        if (ref === artifact.id || !availableRef(ref, artifact.phaseId)) errors.push(`Artifact ${artifact.id}: missing, future or self-referential provenance ${ref}.`);
      }
    }
    const attendance = new Set(list(round.attendance).map((entry) => entry.participantRef));
    for (const phase of list(round.phases)) {
      if (!phase.input?.zh || !phase.input?.en || !phase.output?.zh || !phase.output?.en || !phase.guidance?.zh || !phase.guidance?.en) errors.push(`Round ${round.id}/${phase.id}: bilingual facilitation guidance is required.`);
      for (const ref of [...list(phase.inputRefs), ...list(phase.outputRefs)]) if (!availableRef(ref, phase.id)) errors.push(`Round ${round.id}/${phase.id}: broken artifact reference ${ref}.`);
      for (const ref of list(phase.outputRefs)) if (artifactIndex.get(ref)?.artifact.phaseId !== phase.id || artifactIndex.get(ref)?.roundIndex !== roundIndex) errors.push(`Round ${round.id}/${phase.id}: output belongs to a different phase.`);
      if (list(phase.participantRefs).some((ref) => !attendance.has(ref))) errors.push(`Round ${round.id}/${phase.id}: participant not in attendance.`);
    }
    const voteKeys = new Set();
    for (const response of list(round.responses)) {
      if (!ID.test(response.id || "") || responseIds.has(response.id)) errors.push(`Invalid or duplicate response id: ${response.id}`);
      responseIds.add(response.id);
      if (!attendance.has(response.participantRef) || !availableRef(response.itemRef, response.phaseId) || artifactIndex.get(response.itemRef)?.roundIndex !== roundIndex) errors.push(`Response ${response.id}: broken participant/item reference.`);
      if (!["agree", "disagree", "pass"].includes(response.value)) errors.push(`Response ${response.id}: unsupported response value.`);
      const key = `${response.participantRef}/${response.itemRef}`;
      if (voteKeys.has(key)) errors.push(`Response ${response.id}: duplicate participant/item vote.`);
      voteKeys.add(key);
    }
    if (!PHASE_IDS.includes(round.next?.phaseId) || !round.next?.reason?.zh || !round.next?.reason?.en || !round.next?.owner?.zh || !round.next?.reviewOn) errors.push(`Round ${round.id}: a next phase, reason, owner and review date are required.`);
    for (const ref of list(round.next?.carryForwardRefs)) if (!availableRef(ref, "feedback")) errors.push(`Round ${round.id}: missing carry-forward artifact ${ref}.`);
  });
  // Detect cycles even when multiple derivations happen within one phase.
  const visiting = new Set();
  const visited = new Set();
  function visit(id) {
    if (visiting.has(id)) { errors.push(`Provenance cycle at ${id}.`); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const ref of list(artifactIndex.get(id)?.artifact.derivedFrom)) if (artifactIndex.has(ref)) visit(ref);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of artifactIndex.keys()) visit(id);
  if (PII.test(JSON.stringify(bundle))) errors.push("Possible email, Taiwan mobile number or national ID found; remove identifiers and review the source before export.");
  if (!bundle.simulated) warnings.push("Pseudonymous participant links and free text remain personal data. Pattern checks cannot certify anonymization or consent.");
  warnings.push("A shared CSV format does not preserve votes, consent, participant identity or AI-analysis semantics. Keep the round bundle alongside each export.");
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings };
}

function requireValid(bundle) {
  const result = validateFlowBundle(bundle);
  if (!result.valid) throw new Error(result.errors.join("\n"));
}

function findRound(bundle, roundId) {
  const round = bundle.rounds.find((r) => r.id === roundId || r.sequence === roundId);
  if (!round) throw new Error(`Unknown round: ${roundId}`);
  return round;
}

export function getRoundStats(bundle, roundId, phaseId) {
  const round = findRound(bundle, roundId);
  const phase = phaseId ? round.phases.find((p) => p.id === phaseId) : null;
  if (phaseId && !phase) throw new Error(`Unknown phase: ${phaseId}`);
  const refs = new Set(phase ? phase.participantRefs : round.attendance.map((entry) => entry.participantRef));
  const attendance = round.attendance.filter((entry) => refs.has(entry.participantRef));
  return {
    participants: refs.size,
    online: attendance.filter((entry) => entry.mode === "online").length,
    inPerson: attendance.filter((entry) => entry.mode === "in-person").length,
    inputs: phase ? phase.inputRefs.length : new Set(round.phases.flatMap((p) => p.inputRefs)).size,
    outputs: phase ? phase.outputRefs.length : round.artifacts.length,
    responses: round.responses.filter((r) => !phaseId || r.phaseId === phaseId).length,
    unresolved: round.artifacts.filter((a) => a.status === "needs-response" && (!phaseId || a.phaseId === phaseId)).length,
    tools: [...new Set((phase ? [phase] : round.phases).flatMap((p) => p.tools))],
  };
}

export function getStepState(bundle, { roundId, phaseId, language = "zh" }) {
  const round = findRound(bundle, roundId);
  const phase = round.phases.find((p) => p.id === phaseId);
  if (!phase) throw new Error(`Unknown phase: ${phaseId}`);
  return {
    id: phase.id, roundId: round.id, title: localized(PHASE_TITLES[phase.id], language),
    input: localized(phase.input, language), output: localized(phase.output, language), guidance: localized(phase.guidance, language),
    tools: phase.tools, mode: phase.mode, stats: getRoundStats(bundle, roundId, phaseId),
    participants: phase.participantRefs.map((ref) => ({ ...bundle.participants.find((p) => p.id === ref), mode: round.attendance.find((a) => a.participantRef === ref)?.mode })),
    artifacts: round.artifacts.filter((a) => phase.outputRefs.includes(a.id)).map((a) => ({ ...a, text: localized(a.text, language) })),
    next: { ...round.next, reason: localized(round.next.reason, language), owner: localized(round.next.owner, language) },
  };
}

/** Retain earlier rounds because source links are not disposable. Never publish real individual records. */
export function exportRoundBundle(bundle, roundId) {
  requireValid(bundle);
  const round = findRound(bundle, roundId);
  const copy = structuredClone(bundle);
  copy.rounds = copy.rounds.filter((r) => r.sequence <= round.sequence);
  const used = new Set(copy.rounds.flatMap((r) => r.attendance.map((a) => a.participantRef)));
  copy.participants = copy.participants.filter((p) => used.has(p.id));
  copy.dataCard.suitableForPublicSharing = false;
  copy.dataCard.publicationStatus = "local-private-export";
  return copy;
}

/** CSV id is the globally namespaced artifact ID; interview is blank unless explicitly requested. */
export function exportTttcCsv(bundle, { roundId, language = "zh", includeParticipantRefs = false } = {}) {
  requireValid(bundle);
  const round = findRound(bundle, roundId || bundle.rounds[0].id);
  const rows = round.artifacts.filter((a) => ["statement", "question"].includes(a.kind));
  if (!rows.length) throw new Error("This round has no source statements or questions.");
  return csvTable(["id", "interview", "comment"], rows.map((a) => [
    a.id, includeParticipantRefs ? a.participantRef || "" : "", formulaSafeCell(localized(a.text, language)),
  ]));
}

/** Source mapping travels beside seedStatements; seeds do not transfer votes or an endorsement. */
export function exportPolisSeeds(bundle, { roundId, language = "zh" } = {}) {
  requireValid(bundle);
  const round = findRound(bundle, roundId || bundle.rounds[0].id);
  const candidates = round.artifacts.filter((a) => a.kind === "proposal" && a.reviewed === true && a.status === "reviewed");
  if (!candidates.length) throw new Error("A facilitator must review candidate statements before they become seeds.");
  if (candidates.length > 50) throw new Error("Pocket Polis accepts at most 50 seeds; select a balanced set first.");
  const seedStatements = candidates.map((a) => localized(a.text, language));
  if (seedStatements.some((s) => !s || s.length > 280)) throw new Error("Each seed must contain 1–280 characters; shorten with human review instead of truncating.");
  return {
    seedStatements,
    provenance: candidates.map((a, index) => ({ seedIndex: index, artifactId: a.id, source: structuredClone(a.source), derivedFrom: [...a.derivedFrom] })),
    simulated: bundle.simulated,
    limitations: ["Seed text only: no votes, participant IDs or inferred support are transferred.", "Review the selection for missing and minority positions before starting a new conversation."],
  };
}

/** A compatible Delib envelope; richer round links/modes remain in the delib-rounds companion. */
export function roundToDelibData(bundle, roundId, language = "zh") {
  requireValid(bundle);
  const round = findRound(bundle, roundId);
  const responseItems = new Set(round.responses.map((r) => r.itemRef));
  return {
    schema: DELIB_DATA_SCHEMA, kind: "delib-data-bundle", bundleId: `${bundle.id}:${round.id}`, exportedAt: bundle.generatedAt,
    source: { tool: bundle.simulated ? "Delib round simulator" : "Delib round", sourceSchema: FLOW_SCHEMA, sourceId: round.id, title: localized(round.title, language), description: localized(bundle.disclaimer, language), url: bundle.simulated ? "https://delib.mashbean.net/#demo" : "https://delib.mashbean.net/#data" },
    phases: round.phases.map((p) => ({ id: p.id, type: p.id, title: localized(PHASE_TITLES[p.id], language), status: "completed" })),
    items: round.artifacts.map((a) => ({ id: a.id, phaseId: a.phaseId, type: a.kind, text: localized(a.text, language), status: a.status, origin: a.participantRef ? "participant" : "organizer", createdAt: null })),
    responses: round.responses.map((r) => ({ id: r.id, phaseId: r.phaseId, subjectRef: r.itemRef, participantRef: r.participantRef, response: r.value, count: 1, occurredAt: null })),
    outcomes: [...responseItems].map((itemRef) => ({ id: `${itemRef}:counts`, phaseId: "deliberate", type: "response-counts", itemRef, counts: Object.fromEntries(["agree", "disagree", "pass"].map((value) => [value, round.responses.filter((r) => r.itemRef === itemRef && r.value === value).length])) })),
    summary: { participants: round.attendance.length, items: round.artifacts.length, responses: round.responses.length, coverage: responseItems.size ? round.responses.length / (responseItems.size * round.attendance.length) : 0 },
    provenance: { adapter: "delib:rounds/v1", transformedAt: bundle.generatedAt, sourceArtifacts: round.artifacts.map((a) => ({ id: a.id, ...a.source, derivedFrom: [...a.derivedFrom] })), notes: [bundle.simulated ? "Fully fictional demonstration; no real participants, tool runs, field observations or public decisions." : "Real participant-linked records: keep this export private. The adapter does not certify source accuracy, consent or a formal decision.", "Keep the delib-rounds companion to retain attendance modes, review gates and next-round commitments."] },
    dataCard: { containsParticipantData: !bundle.simulated, containsDirectIdentifiers: false, containsParticipantFreeText: !bundle.simulated, containsPseudonymousLinkage: true, aggregation: "individual-responses-plus-item-counts", publicationStatus: "local-private-export", storedByDelib: false, suitableForPublicSharing: false, limitations: ["Pseudonymous linkage remains private for real activities.", "Counts are not representative public opinion, a consensus model or a voting mandate."] },
  };
}
