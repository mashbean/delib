#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPocketPolisBundle,
  parsePocketPolisExports,
  parsePocketPolisReportUrl,
  pocketPolisToAgoraCsv,
  pocketPolisToTttcCsv,
} from "../public/pocket-polis-data-core.js";
import {
  createPocketPolisReceipt,
  selectToolSynthesis,
  pocketPolisReceiptToMarkdown,
  pocketPolisReceiptUrl,
} from "../public/pocket-polis-receipt-core.js";
import { pocketPolisBundleToDelibData } from "../public/delib-data-core.js";
import {
  RECEIPT_HANDOFF_TARGETS,
  createReceiptHandoff,
  receiptHandoffTargetUrl,
} from "../public/receipt-handoff-core.js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = resolve(scriptDirectory, "..");
const cli = parseArguments(process.argv.slice(2));
const configurationFile = resolve(repositoryDirectory, cli.config);
const outputDirectory = resolve(cli.out);
const configuration = JSON.parse(await readFile(configurationFile, "utf8"));
const report = parsePocketPolisReportUrl(configuration.reportUrl);

if (!report) throw new Error("Pilot 設定需要有效的 Pocket Polis 公開成果網址");

const apiBase = `${report.origin}/api/conversations/${report.conversationId}`;
const [publicInfo, publicResults, statementsCsv, votesCsv] = await Promise.all([
  fetchJson(apiBase),
  fetchJson(`${apiBase}/results`),
  fetchText(`${apiBase}/export/statements.csv`),
  fetchText(`${apiBase}/export/votes.csv`),
]);

// The synthesis is public; reading it may ask Pocket Polis to (re)generate one.
const synthesisPayload = await fetchJson(`${apiBase}/synthesis`).catch(() => null);
const synthesisSelection = configuration.toolSynthesis && synthesisPayload?.status === "ready"
  ? selectToolSynthesis(synthesisPayload, configuration.toolSynthesis)
  : null;

if (publicInfo.openData !== true) {
  throw new Error("這個活動沒有開放匿名 CSV；pilot 不會要求或繞過私人管理金鑰");
}
if (publicInfo.title !== configuration.expectedTitle) {
  throw new Error(`活動標題不符：預期「${configuration.expectedTitle}」，實際為「${publicInfo.title}」`);
}

const exportedAt = new Date().toISOString();
const parsed = parsePocketPolisExports({ statementsCsv, votesCsv });
const bundle = buildPocketPolisBundle({
  title: publicInfo.title,
  description: publicInfo.description,
  reportUrl: report.reportUrl,
  parsed,
  exportedAt,
  files: [
    fileEvidence("statements", "statements.csv", statementsCsv),
    fileEvidence("votes", "votes.csv", votesCsv),
  ],
});
const receipt = createPocketPolisReceipt({
  bundle,
  selectedStatementIds: configuration.selectedStatementIds,
  organizer: configuration.organizer,
  preparedAt: exportedAt,
  toolSynthesis: synthesisSelection,
});
const tttcCsv = pocketPolisToTttcCsv(bundle);
const delibData = pocketPolisBundleToDelibData(bundle, exportedAt);
const agora = pocketPolisToAgoraCsv(bundle);
const handoffs = Object.fromEntries(
  Object.keys(RECEIPT_HANDOFF_TARGETS).map((target) => {
    const handoff = createReceiptHandoff({ receipt, target, createdAt: exportedAt });
    return [target, {
      targetUrl: receiptHandoffTargetUrl(handoff, configuration.delibOrigin),
      handoff,
    }];
  }),
);

const checks = runChecks({ bundle, delibData, receipt, tttcCsv, agora, handoffs, publicInfo, publicResults, synthesisSelection });
if (checks.some((check) => !check.ok)) {
  const failures = checks.filter((check) => !check.ok).map((check) => check.label).join("、");
  throw new Error(`Pilot 驗證失敗：${failures}`);
}

await mkdir(resolve(outputDirectory, "source"), { recursive: true });
await mkdir(resolve(outputDirectory, "portable"), { recursive: true });
await mkdir(resolve(outputDirectory, "tttc"), { recursive: true });
await mkdir(resolve(outputDirectory, "agora"), { recursive: true });
await mkdir(resolve(outputDirectory, "receipt"), { recursive: true });
await mkdir(resolve(outputDirectory, "handoffs"), { recursive: true });

await Promise.all([
  writeFile(resolve(outputDirectory, "source", "conversation.json"), jsonText(publicInfo)),
  writeFile(resolve(outputDirectory, "source", "results.json"), jsonText(publicResults)),
  ...(synthesisPayload ? [writeFile(resolve(outputDirectory, "source", "synthesis.json"), jsonText(synthesisPayload))] : []),
  writeFile(resolve(outputDirectory, "source", "statements.csv"), statementsCsv),
  writeFile(resolve(outputDirectory, "source", "votes.csv"), votesCsv),
  writeFile(resolve(outputDirectory, "portable", "delib-pocket-polis.json"), jsonText(bundle)),
  writeFile(resolve(outputDirectory, "portable", "delib-data.json"), jsonText(delibData)),
  writeFile(resolve(outputDirectory, "tttc", "statements.csv"), tttcCsv),
  writeFile(resolve(outputDirectory, "agora", "summary.csv"), agora.summaryCsv),
  writeFile(resolve(outputDirectory, "agora", "comments.csv"), agora.commentsCsv),
  writeFile(resolve(outputDirectory, "agora", "votes.csv"), agora.votesCsv),
  writeFile(resolve(outputDirectory, "agora", "README.md"), `# Agora 匯入包\n\n${agora.notes.map((note) => `- ${note}`).join("\n")}\n`),
  writeFile(resolve(outputDirectory, "receipt", "receipt.json"), jsonText(receipt)),
  writeFile(resolve(outputDirectory, "receipt", "receipt.md"), pocketPolisReceiptToMarkdown(receipt)),
  writeFile(resolve(outputDirectory, "receipt", "receipt-url.txt"), `${pocketPolisReceiptUrl(receipt, configuration.delibOrigin)}\n`),
  ...Object.entries(handoffs).map(([target, value]) =>
    writeFile(resolve(outputDirectory, "handoffs", `${target}.json`), jsonText(value)),
  ),
]);

const pilotReport = renderPilotReport({
  configuration,
  publicInfo,
  publicResults,
  bundle,
  receipt,
  checks,
  synthesisPayload,
  receiptUrl: pocketPolisReceiptUrl(receipt, configuration.delibOrigin),
});
await writeFile(resolve(outputDirectory, "pilot-report.md"), pilotReport);

console.log(`Pilot 完成：${outputDirectory}`);
console.log(`公開活動：${report.reportUrl}`);
console.log(`投票者／票數／陳述：${bundle.summary.participants}／${bundle.summary.votes}／${bundle.summary.statements}`);
console.log(`成果收據：receipt/receipt-url.txt（${pocketPolisReceiptUrl(receipt, configuration.delibOrigin).length} 字元）`);

function parseArguments(values) {
  const parsedArguments = {
    config: "pilots/defense-budget.json",
    out: "../../output/delib-pocket-polis-defense-pilot",
  };
  for (let index = 0; index < values.length; index += 1) {
    const flag = values[index];
    if (flag === "--config" || flag === "--out") {
      const value = values[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${flag} 需要一個路徑`);
      parsedArguments[flag.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`不支援的參數：${flag}`);
    }
  }
  return parsedArguments;
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { Accept: "application/json,text/csv;q=0.9" } });
  if (!response.ok) throw new Error(`${url} 回傳 HTTP ${response.status}`);
  return response.text();
}

function fileEvidence(role, name, content) {
  return {
    role,
    name,
    size: Buffer.byteLength(content),
    sha256: createHash("sha256").update(content).digest("hex"),
  };
}

function runChecks({ bundle, delibData, receipt, tttcCsv, agora, handoffs, publicInfo, publicResults, synthesisSelection }) {
  const statementIds = new Set(bundle.statements.map((statement) => statement.statementId));
  const citedIds = receipt.toolSynthesis
    ? [...receipt.toolSynthesis.commonGround, ...receipt.toolSynthesis.tensions].flatMap((item) => item.citedStatementIds)
    : [];
  const serializedReceipt = JSON.stringify(receipt);
  const selectedTexts = receipt.findings.map((finding) => finding.text);
  const serializedHandoffs = JSON.stringify(handoffs);
  const result = publicResults.result;
  const hasHighAgreement = receipt.findings.some((finding) => {
    const expressed = finding.agrees + finding.disagrees;
    return expressed >= 3 && finding.agrees / expressed >= 0.75;
  });
  const hasNearEvenSplit = receipt.findings.some((finding) => {
    const expressed = finding.agrees + finding.disagrees;
    return expressed >= 3 && Math.abs(finding.agrees - finding.disagrees) / expressed <= 0.15;
  });
  return [
    check("兩份 CSV 彙整票數一致", bundle.consistency.countMatches),
    check("通用資料層保留全部陳述與逐筆回應", delibData.items.length === bundle.summary.statements && delibData.responses.length === bundle.summary.votes),
    check("通用資料層標記匿名串連與禁止直接公開", delibData.dataCard.containsPseudonymousLinkage && !delibData.dataCard.suitableForPublicSharing),
    check("CSV 投票者數與分析結果一致", bundle.summary.participants === result.nParticipantsTotal),
    check("CSV 票數與分析結果一致", bundle.summary.votes === result.nVotes),
    check("活動開啟 session 不少於實際投票者", publicInfo.counts.participants >= bundle.summary.participants),
    check("公開收據至少包含一個高同意陳述", hasHighAgreement),
    check("公開收據至少包含一個同意／不同意接近的分歧陳述", hasNearEvenSplit),
    check("公開收據沒有逐筆 participant 欄", !serializedReceipt.includes('"participant":')),
    check("公開收據沒有原始檔雜湊", !serializedReceipt.includes("sha256")),
    check("TTTC 只含已核准陳述", lineCount(tttcCsv) === bundle.summary.approvedStatements + 1),
    check("Agora comments 含全部陳述", lineCount(agora.commentsCsv) === bundle.summary.statements + 1),
    check("Agora votes 含全部逐筆投票", lineCount(agora.votesCsv) === bundle.summary.votes + 1),
    check("四個下一步 handoff 都已建立", Object.keys(handoffs).length === 4),
    check("Handoff 不帶公開陳述原文", selectedTexts.every((text) => !serializedHandoffs.includes(text))),
    check("Handoff 不帶逐句票數欄", !serializedHandoffs.includes('"agrees"') && !serializedHandoffs.includes('"disagrees"')),
    check("工具整理只在綜整就緒時納入，且標明模型與產生時間",
      !synthesisSelection || (typeof receipt.toolSynthesis?.model === "string" && typeof receipt.toolSynthesis?.generatedAt === "string")),
    check("工具整理引用的陳述編號都存在於來源", citedIds.every((id) => statementIds.has(id))),
    check("工具整理有對應的限制聲明", !receipt.toolSynthesis || receipt.dataCard.limitations.some((line) => line.includes("工具整理"))),
  ];
}

function check(label, ok) {
  return { label, ok: Boolean(ok) };
}

function lineCount(value) {
  return value.trimEnd().split("\n").length;
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function renderPilotReport({ configuration, publicInfo, publicResults, bundle, receipt, checks, receiptUrl, synthesisPayload }) {
  const result = publicResults.result;
  const synthesisSection = receipt.toolSynthesis
    ? `## 工具整理（Pocket Polis 綜整節錄）\n\n` +
      `- 模型：${receipt.toolSynthesis.model}（${receipt.toolSynthesis.generationMode === "ai" ? "AI 綜整" : "統計摘要"}）\n` +
      `- 產生時間：${receipt.toolSynthesis.generatedAt}${receipt.toolSynthesis.isStale ? "（資料其後有更新）" : ""}\n` +
      `- 納入：概述 ${receipt.toolSynthesis.overview ? "是" : "否"}、共同點 ${receipt.toolSynthesis.commonGround.length} 點、張力 ${receipt.toolSynthesis.tensions.length} 組\n\n` +
      `這一層由工具產生、由 pilot 設定挑選，並在收據限制聲明中標明；它不是主辦者解讀，也不是共識證明。\n\n`
    : `## 工具整理\n\n${synthesisPayload ? `Pocket Polis 綜整狀態為 ${synthesisPayload.status}，本次未納入。` : "本次沒有讀取到 Pocket Polis 綜整，收據不含工具整理層。"}\n\n`;
  const findings = receipt.findings
    .map((finding) => `| ${finding.statementId} | ${escapeTable(finding.text)} | ${finding.agrees} | ${finding.disagrees} | ${finding.passes} |`)
    .join("\n");
  return `# Pocket Polis → Delib 軍購模擬完整 Pilot\n\n` +
    `執行時間：${receipt.preparedAt}\n\n` +
    `> 這是全部虛構的管線測試，不代表任何真實選民、立委、政黨、機關或 MetaGov 的立場，也不是代表性民調。\n\n` +
    `## 來源快照\n\n` +
    `- Pocket Polis 公開成果：${configuration.reportUrl}\n` +
    `- 活動頁登記 session：${publicInfo.counts.participants}\n` +
    `- CSV 實際投票者：${bundle.summary.participants}\n` +
    `- 逐筆投票：${bundle.summary.votes}\n` +
    `- 陳述：${bundle.summary.statements}（已核准 ${bundle.summary.approvedStatements}）\n` +
    `- 分群：${result.k} 群；納入分群 ${result.nParticipantsClustered}/${result.nParticipantsTotal} 位投票者；silhouette ${result.silhouette}\n\n` +
    `「活動頁登記 session」包含開啟過參與流程但未必投票的人；CSV 與 Delib 成果收據的 participants 指至少有一筆投票的人，兩者不應混稱。\n\n` +
    `## 公開成果收據選句\n\n` +
    `| ID | 陳述 | 同意 | 不同意 | 略過 |\n| --- | --- | ---: | ---: | ---: |\n${findings}\n\n` +
    `成果連結長度：${receiptUrl.length} 字元。完整連結在 \`receipt/receipt-url.txt\`，資料位於 URL fragment，Delib 不另存。\n\n` +
    `## 已完成的管線\n\n` +
    `1. 公開 open-data CSV 原檔與 SHA-256 證據；\n` +
    `2. \`delib-pocket-polis/v1\` participant-aware JSON；\n` +
    `3. \`delib-data/v1\` 跨工具資料包，保留來源 schema 與匿名串連風險；\n` +
    `4. TTTC \`id,interview,comment\` CSV；\n` +
    `5. Agora Pol.is summary/comments/votes 三檔；\n` +
    `6. \`delib-pocket-polis-receipt/v1\` JSON、Markdown 與 fragment-only 成果網址；\n` +
    `7. Call-in、Harmonica、TTTC、Pol.is 四份兩小時、一次性 handoff 草稿；\n` +
    `8. Pocket Polis 綜整（Workers AI Gemma 或統計摘要）的節錄與出處。\n\n` +
    synthesisSection +
    `## 自動驗證\n\n${checks.map((item) => `- ${item.ok ? "通過" : "失敗"}：${item.label}`).join("\n")}\n\n` +
    `## 尚未越過的外部邊界\n\n` +
    `本 pilot 會驗證 TTTC／Agora 檔案格式與 Delib 內的目的工具預填，但不把「產生檔案」宣稱為「上游匯入成功」。真正建立 TTTC 或 Agora 專案仍需要登入、上傳、預覽與人工確認。\n`;
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}
