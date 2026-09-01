import {
  OPTIONS,
  buildBundle,
  buildMarkdown,
  buildPlan,
  normalizeState,
  stateFromSearch,
  stateToSearch,
} from "./core.js";
import { normalizeRankingConfig, rankingConfigToHash } from "./power-ranker-core.js";
import {
  RECEIPT_HANDOFF_STORAGE_KEY,
  RECEIPT_HANDOFF_TARGETS,
  normalizeReceiptHandoff,
} from "./receipt-handoff-core.js";

const STAGE_LABELS = {
  evaluating: "現況評估",
  "agenda-setting": "議程設定",
  eliciting: "意見蒐集",
  learning: "共同學習",
  deliberating: "審議",
  proposing: "提案",
  deciding: "決定",
  actuating: "行動",
  reflecting: "回顧",
};

const STATUS_LABELS = {
  integrated: "可直接試",
  adapter: "已有 adaptor",
  catalog: "待接入",
};

const RESULT_TITLES = {
  listen: "這一輪，先聽見，再回覆。",
  understand: "把共識與歧見都留在地圖上。",
  evidence: "讓證據成為入口，不是最後一句話。",
  propose: "讓每次修正都看得到理由。",
  decide: "先說清楚權限，再作成決定。",
  followup: "審議結束，loop 才正要開始。",
};

const POCKET_POLIS_STORAGE_KEY = "delib:pocket-polis-instance";

let tools = [];
let integrations = new Map();
let hosting = new Map();
let currentPlan = null;
let currentStep = 0;
let activeFilter = "all";
let polisDeploymentConnected = false;

const plannerDialog = document.querySelector("#planner-dialog");
const plannerForm = document.querySelector("#planner-form");
const plannerProgress = document.querySelector("#planner-progress");
const stepCount = document.querySelector("#step-count");
const plannerBack = document.querySelector("#planner-back");
const plannerNext = document.querySelector("#planner-next");
const plannerSubmit = document.querySelector("#planner-submit");
const plannerError = document.querySelector("#planner-error");
const resultSection = document.querySelector("#result");
const actionStatus = document.querySelector("#action-status");
const agentStatus = document.querySelector("#agent-status");
const agentOutput = document.querySelector("#agent-output");
const apiKeyInput = document.querySelector("#openai-key");
const harmonicaKeyInput = document.querySelector("#harmonica-key");

init().catch((error) => {
  console.error(error);
  const library = document.querySelector("#tool-library");
  library.replaceChildren(
    createElement("p", "empty-state", "工具目錄暫時讀不到，但你仍可下載 skill 或稍後再試。"),
  );
});

async function init() {
  const [response, integrationResponse, hostingResponse] = await Promise.all([
    fetch("/data/tools.json", { cache: "no-cache" }),
    fetch("/data/integrations.json", { cache: "no-cache" }),
    fetch("/data/hosting.json", { cache: "no-cache" }),
  ]);
  if (!response.ok || !integrationResponse.ok || !hostingResponse.ok) {
    throw new Error("tool registry unavailable");
  }
  const registry = await response.json();
  const integrationRegistry = await integrationResponse.json();
  const hostingRegistry = await hostingResponse.json();
  tools = Array.isArray(registry.tools) ? registry.tools : [];
  integrations = new Map(
    (Array.isArray(integrationRegistry.integrations) ? integrationRegistry.integrations : []).map((item) => [
      item.toolId,
      item,
    ]),
  );
  hosting = new Map(
    (Array.isArray(hostingRegistry.tools) ? hostingRegistry.tools : []).map((item) => [item.toolId, item]),
  );
  document.querySelector("#tool-count").textContent = String(tools.length);
  renderToolLibrary();
  bindEvents();
  updatePolisMode();
  loadPolisStatus();

  apiKeyInput.value = sessionStorage.getItem("delib:openai-key") || "";
  harmonicaKeyInput.value = sessionStorage.getItem("delib:harmonica-key") || "";
  restoreCallInInstance();
  restorePocketPolisInstance();
  restoreReceiptHandoff();
  const state = stateFromSearch(location.search);
  if (state) renderResult(state, false);
}

function bindEvents() {
  document.querySelectorAll("[data-start]").forEach((button) => {
    button.addEventListener("click", () => openPlanner(button.dataset.start || null));
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => plannerDialog.close());
  });
  plannerDialog.addEventListener("click", (event) => {
    if (event.target === plannerDialog) plannerDialog.close();
  });
  plannerBack.addEventListener("click", () => showStep(currentStep - 1));
  plannerNext.addEventListener("click", () => {
    if (!validateStep(currentStep)) return;
    showStep(currentStep + 1);
  });
  plannerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateStep(currentStep)) return;
    const state = formState();
    if (!normalizeState(state)) {
      plannerError.textContent = "還有一個選擇沒有完成。";
      return;
    }
    const query = stateToSearch(state);
    history.pushState({}, "", `${location.pathname}?${query}#result`);
    renderResult(state, true);
    plannerDialog.close();
  });

  document.querySelector("#copy-link").addEventListener("click", copyShareLink);
  document.querySelector("#download-json").addEventListener("click", downloadBundle);
  document.querySelector("#download-markdown").addEventListener("click", downloadRunbook);
  document.querySelectorAll("[data-open-agent]").forEach((button) => {
    button.addEventListener("click", () => document.querySelector("#agent").scrollIntoView());
  });
  document.querySelectorAll("[data-start-agent]").forEach((button) => {
    button.addEventListener("click", () => document.querySelector("#agent").scrollIntoView());
  });

  document.querySelector("#tool-search").addEventListener("input", renderToolLibrary);
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((candidate) => {
        candidate.classList.toggle("active", candidate === button);
      });
      renderToolLibrary();
    });
  });

  apiKeyInput.addEventListener("input", () => {
    const key = apiKeyInput.value.trim();
    if (key) sessionStorage.setItem("delib:openai-key", key);
    else sessionStorage.removeItem("delib:openai-key");
  });
  document.querySelector("#clear-key").addEventListener("click", () => {
    sessionStorage.removeItem("delib:openai-key");
    apiKeyInput.value = "";
    apiKeyInput.focus();
    agentStatus.textContent = "這個分頁裡的 key 已清除。";
  });
  document.querySelector("#run-agent").addEventListener("click", runAgent);
  document.querySelector("#call-in-form").addEventListener("submit", createCallIn);
  document.querySelector("#pocket-polis-form").addEventListener("submit", createPocketPolis);
  document.querySelector("#polis-form").addEventListener("submit", preparePolis);
  document.querySelector("#agora-form").addEventListener("submit", prepareAgora);
  document.querySelector("#heyform-form").addEventListener("submit", prepareHeyForm);
  document.querySelector("#tttc-form").addEventListener("submit", prepareTttc);
  document.querySelector("#harmonica-form").addEventListener("submit", createHarmonica);
  document.querySelector("#power-ranker-form").addEventListener("submit", preparePowerRanker);
  document.querySelector("#copy-power-ranker-link").addEventListener("click", copyPowerRankerLink);
  document.querySelector("#copy-power-ranker-manage").addEventListener("click", copyPowerRankerManageLink);
  document.querySelectorAll('input[name="power-ranker-mode"]').forEach((input) => {
    input.addEventListener("change", updatePowerRankerMode);
  });
  harmonicaKeyInput.addEventListener("input", () => {
    const key = harmonicaKeyInput.value.trim();
    if (key) sessionStorage.setItem("delib:harmonica-key", key);
    else sessionStorage.removeItem("delib:harmonica-key");
  });
  document.querySelector("#clear-harmonica-key").addEventListener("click", () => {
    sessionStorage.removeItem("delib:harmonica-key");
    harmonicaKeyInput.value = "";
    harmonicaKeyInput.focus();
    document.querySelector("#harmonica-status").textContent = "這個分頁裡的 Harmonica key 已清除。";
  });
  document.querySelector("#copy-harmonica-agent").addEventListener("click", () =>
    copyText(
      "請使用 Harmonica MCP 幫我設計並建立一個審議 session。先問清楚主題、目標、參與者、資料邊界、人工複核與結束條件；建立外部 session 前讓我確認。可用 npx harmonica-mcp 啟動，API key 只放在本機環境，不要貼進對話或網址。",
      document.querySelector("#harmonica-status"),
      "Harmonica MCP 啟動提示已複製。",
    ),
  );
  document.querySelector("#copy-polis-agent").addEventListener("click", () =>
    copyText(
      "請幫我連接 Delib 與 Pol.is：先開啟 Pol.is 的帳號整合頁；若需要登入就停下來讓我操作。登入後找出帳號自動產生的 Site ID，再讓我選擇貼進 Delib，或設成 Cloudflare Worker 的 POLIS_SITE_ID。不要讀取、保存或回傳我的密碼與 session cookie。",
      document.querySelector("#polis-status"),
      "Agent 連接指令已複製；請貼到支援瀏覽器操作的 Agent。",
    ),
  );
  document.querySelector("#copy-pocket-polis-agent").addEventListener("click", () =>
    copyText(
      "請先閱讀 https://github.com/mashbean/pocket-polis/blob/main/AGENT.md，協助我設計一輪 Pocket Polis 口袋審議。請問清楚主題、參與者、後續回覆責任與資料公開範圍，草擬 5–15 句彼此不重複、每句只有一個觀點的起始陳述；建立前列出標題、說明、陳述、投稿審核與 openData 設定讓我確認。只有我確認後，才能在我擁有的 https://polis.mashbean.net 建立；私人 admin URL 只回傳給我，不要貼到公開文件或 log。也可以用 npx --yes github:mashbean/pocket-polis install-skill 安裝 skill。",
      document.querySelector("#pocket-polis-status"),
      "Pocket Polis Agent 提示已複製；建立外部活動前仍會請你確認。",
    ),
  );
  document.querySelectorAll('input[name="polis-mode"]').forEach((input) => {
    input.addEventListener("change", updatePolisMode);
  });
  document.querySelectorAll("[data-copy-command]").forEach((button) => {
    button.addEventListener("click", () => copyText("npx --yes github:mashbean/delib install-skill", agentStatus, "安裝指令已複製。"));
  });
  document.querySelectorAll("[data-copy-prompt]").forEach((button) => {
    button.addEventListener("click", () =>
      copyText(
        "請閱讀 https://delib.mashbean.net/.well-known/delib/SKILL.md，先確認你服務的社群、風險、真正權限、申訴方式與終止條件，再帶我完成一份審議拼圖。",
        agentStatus,
        "啟動提示已複製。",
      ),
    );
  });
  window.addEventListener("popstate", () => {
    const state = stateFromSearch(location.search);
    if (state) renderResult(state, false);
    else {
      currentPlan = null;
      resultSection.hidden = true;
    }
  });
}

function openPlanner(presetGoal) {
  plannerError.textContent = "";
  if (currentPlan) fillForm(currentPlan);
  if (presetGoal && Object.hasOwn(OPTIONS.goal, presetGoal)) {
    const input = plannerForm.querySelector(`input[name="goal"][value="${presetGoal}"]`);
    if (input) input.checked = true;
  }
  showStep(0);
  plannerDialog.showModal();
  const firstChoice = plannerForm.querySelector('[data-step="0"] input:checked') || plannerForm.querySelector('[data-step="0"] input');
  queueMicrotask(() => firstChoice?.focus());
}

function fillForm(state) {
  for (const [name, value] of Object.entries(state)) {
    const input = plannerForm.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
  }
}

function showStep(step) {
  currentStep = Math.min(3, Math.max(0, step));
  plannerForm.querySelectorAll("[data-step]").forEach((fieldset) => {
    fieldset.hidden = Number(fieldset.dataset.step) !== currentStep;
  });
  stepCount.textContent = `${currentStep + 1} / 4`;
  plannerProgress.style.width = `${(currentStep + 1) * 25}%`;
  plannerBack.hidden = currentStep === 0;
  plannerNext.hidden = currentStep === 3;
  plannerSubmit.hidden = currentStep !== 3;
  plannerError.textContent = "";
  const currentFieldset = plannerForm.querySelector(`[data-step="${currentStep}"]`);
  const focusTarget = currentFieldset?.querySelector("input:checked") || currentFieldset?.querySelector("input");
  if (plannerDialog.open) queueMicrotask(() => focusTarget?.focus());
}

function validateStep(step) {
  const fieldset = plannerForm.querySelector(`[data-step="${step}"]`);
  const names = [...new Set([...fieldset.querySelectorAll("input[type=radio]")].map((input) => input.name))];
  const missing = names.find((name) => !fieldset.querySelector(`input[name="${name}"]:checked`));
  if (missing) {
    plannerError.textContent = step === 2 ? "請各選一個人數與資料風險。" : "先選一個最接近的答案。";
    fieldset.querySelector(`input[name="${missing}"]`)?.focus();
    return false;
  }
  plannerError.textContent = "";
  return true;
}

function formState() {
  const data = new FormData(plannerForm);
  return Object.fromEntries(["goal", "format", "scale", "privacy", "output"].map((key) => [key, data.get(key)]));
}

function renderResult(state, scroll) {
  currentPlan = buildPlan(state, tools);
  resultSection.hidden = false;
  document.querySelector("#result-title").textContent = RESULT_TITLES[currentPlan.goal];
  document.querySelector("#result-summary").textContent = `${currentPlan.labels.format} · ${currentPlan.labels.scale} · ${currentPlan.labels.privacy}。目標是留下${currentPlan.labels.output}。`;
  document.querySelector("#sensitive-warning").hidden = currentPlan.privacy !== "sensitive";

  const gearRoot = document.querySelector("#offline-gears");
  gearRoot.replaceChildren(
    ...currentPlan.offlineGears.map((gear) => {
      const node = createElement("article", "gear");
      node.append(createElement("strong", "", gear.title), createElement("p", "", gear.description));
      return node;
    }),
  );

  const toolRoot = document.querySelector("#recommended-tools");
  toolRoot.replaceChildren(...currentPlan.tools.map(renderRecommendation));
  actionStatus.textContent = "";
  if (scroll) resultSection.scrollIntoView({ block: "start" });
}

function renderRecommendation(tool) {
  const article = createElement("article", "recommendation");
  const head = createElement("div", "recommendation-head");
  const integration = launchableIntegration(tool.id);
  const hostingPath = hosting.get(tool.id);
  head.append(
    createElement("h4", "", tool.name),
    createElement(
      "span",
      "status-chip",
      integration?.label || hostingPath?.label || STATUS_LABELS[tool.status] || "工具目錄",
    ),
  );
  article.append(head, createElement("p", "", tool.summary));
  if (hostingPath) {
    const hostingNote = createElement("p", "hosting-note");
    hostingNote.append(
      createElement("strong", "", hostingPath.label),
      document.createTextNode(` ${hostingPath.summary}`),
    );
    article.append(hostingNote);
  }

  const reasons = createElement("div", "match-reasons");
  for (const reason of tool.match.reasons.slice(0, 3)) reasons.append(createElement("span", "reason-chip", reason));
  article.append(reasons);

  const links = createElement("div", "recommendation-links");
  if (integration) links.append(launchButton(tool.id, integration));
  links.append(externalLink("查看工具 ↗", tool.url));
  if (tool.deploy) links.append(externalLink("部署到 Cloudflare ↗", tool.deploy));
  const sourceUrl = hostingPath?.source?.url || tool.source;
  if (sourceUrl && sourceUrl !== tool.url) links.append(externalLink("原始碼", sourceUrl));
  article.append(links);
  return article;
}

function renderToolLibrary() {
  if (!tools.length) return;
  const term = document.querySelector("#tool-search")?.value.trim().toLocaleLowerCase("zh-Hant") || "";
  const matches = tools.filter((tool) => {
    const hostingPath = hosting.get(tool.id);
    if (activeFilter === "direct" && !launchableIntegration(tool.id)) return false;
    if (activeFilter === "source" && hostingPath?.source?.reusable !== true) return false;
    if (activeFilter === "shared-host" && hostingPath?.route !== "shared-host") return false;
    if (activeFilter === "component" && hostingPath?.route !== "component") return false;
    if (
      activeFilter === "unverified" &&
      !["research", "blocked", "unverified"].includes(hostingPath?.route)
    ) {
      return false;
    }
    if (!term) return true;
    const haystack = [tool.name, tool.summary, tool.handoff, ...(tool.stages || []).map((stage) => STAGE_LABELS[stage] || stage)]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("zh-Hant");
    return haystack.includes(term);
  });
  document.querySelector("#tool-library").replaceChildren(...matches.map(renderToolCard));
  document.querySelector("#no-tools").hidden = matches.length > 0;
}

function renderToolCard(tool) {
  const article = createElement("article", "tool-card");
  const top = createElement("div", "tool-card-top");
  const integration = launchableIntegration(tool.id);
  const hostingPath = hosting.get(tool.id);
  top.append(
    createElement("h3", "", tool.name),
    createElement("span", "status-chip", integration?.label || hostingPath?.label || STATUS_LABELS[tool.status] || "工具目錄"),
  );
  const stages = createElement("div", "stage-list");
  for (const stage of tool.stages || []) stages.append(createElement("span", "", STAGE_LABELS[stage] || stage));
  const links = createElement("div", "tool-card-links");
  if (integration) links.append(launchButton(tool.id, integration));
  links.append(externalLink("查看 ↗", tool.url));
  const sourceUrl = hostingPath?.source?.url || tool.source;
  if (sourceUrl && sourceUrl !== tool.url) links.append(externalLink("原始碼", sourceUrl));
  const hostingNote = createElement("p", "hosting-note");
  if (hostingPath) {
    hostingNote.append(
      createElement("strong", "", hostingPath.label),
      document.createTextNode(` ${hostingPath.summary}`),
    );
  }
  article.append(top, createElement("p", "", tool.summary), hostingNote, stages, links);
  return article;
}

function launchableIntegration(toolId) {
  const integration = integrations.get(toolId);
  return integration && ["managed-create", "credentialed-create", "embedded-workspace", "local-tool"].includes(integration.activation)
    ? integration
    : null;
}

function launchButton(toolId, integration) {
  const button = createElement(
    "button",
    "direct-launch",
    ["managed-create", "credentialed-create"].includes(integration.activation)
      ? "在這裡建立"
      : integration.activation === "local-tool"
        ? "在這裡使用"
        : "在這裡開啟",
  );
  button.type = "button";
  button.addEventListener("click", () => launchTool(toolId));
  return button;
}

function launchTool(toolId) {
  const target = document.querySelector(`#launch-${CSS.escape(toolId)}`);
  if (!target) return;
  if (currentPlan) {
    const suggestedTitle = RESULT_TITLES[currentPlan.goal];
    if (toolId === "call-in" && !document.querySelector("#call-in-title").value) {
      document.querySelector("#call-in-title").value = suggestedTitle;
    }
    if (toolId === "polis" && !document.querySelector("#polis-title").value) {
      document.querySelector("#polis-title").value = suggestedTitle;
    }
    if (toolId === "pocket-polis" && !document.querySelector("#pocket-polis-title").value) {
      document.querySelector("#pocket-polis-title").value = suggestedTitle;
    }
    if (toolId === "talk-to-the-city" && !document.querySelector("#tttc-title").value) {
      document.querySelector("#tttc-title").value = suggestedTitle;
    }
    if (toolId === "harmonica" && !document.querySelector("#harmonica-topic").value) {
      document.querySelector("#harmonica-topic").value = suggestedTitle;
      document.querySelector("#harmonica-goal").value = currentPlan.tools
        .map((tool) => tool.summary)
        .filter(Boolean)
        .slice(0, 2)
        .join(" ");
    }
    if (toolId === "power-ranker" && !document.querySelector("#power-ranker-title").value) {
      document.querySelector("#power-ranker-title").value = suggestedTitle;
    }
  }
  target.scrollIntoView({ block: "start" });
  const firstInput = target.querySelector("input:not([type=checkbox]):not([type=radio])");
  queueMicrotask(() => firstInput?.focus());
}

function updatePowerRankerMode() {
  const roomMode = document.querySelector('input[name="power-ranker-mode"]:checked')?.value === "room";
  document.querySelector("#power-ranker-room-fields").hidden = !roomMode;
  document.querySelector("#power-ranker-local-preview").hidden = roomMode;
  document.querySelector("#power-ranker-room-preview").hidden = !roomMode;
  document.querySelector("#prepare-power-ranker").textContent = roomMode ? "建立短期收件室" : "準備排序頁";
}

async function preparePowerRanker(event) {
  event.preventDefault();
  const status = document.querySelector("#power-ranker-status");
  const confirm = document.querySelector("#power-ranker-confirm");
  if (!confirm.checked) {
    status.textContent = "先確認決策權限與題目資料邊界，再準備分享連結。";
    confirm.focus();
    return;
  }

  const config = normalizeRankingConfig({
    title: document.querySelector("#power-ranker-title").value,
    items: document.querySelector("#power-ranker-items").value.split(/\r?\n/),
  });
  if (!config) {
    status.textContent = "請填入問題與 3–10 個不重複項目；每個項目都要獨立一行。";
    document.querySelector("#power-ranker-items").focus();
    return;
  }

  const mode = document.querySelector('input[name="power-ranker-mode"]:checked')?.value || "local";
  const button = document.querySelector("#prepare-power-ranker");
  button.disabled = true;
  try {
    if (mode === "room") {
      status.textContent = "正在建立短期收件室；只會送出題目、選項與清除期限。";
      const data = await postJson("/api/integrations/power-ranker/rooms", {
        title: config.title,
        items: config.items,
        retentionHours: Number(document.querySelector("#power-ranker-retention").value),
        confirmed: true,
      });
      renderPowerRankerInstance(data);
      status.textContent = "收件室已建立。先保存私人管理連結，再分享公開參與連結。";
    } else {
      const workspace = new URL("/integrations/power-ranker.html", location.origin);
      workspace.hash = rankingConfigToHash(config);
      renderPowerRankerInstance({ participantUrl: workspace.href, storedByDelib: false });
      status.textContent = "排序頁已在本機準備好；尚未建立帳號、專案或外部資料。";
    }
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "排序頁暫時沒有完成，請稍後再試。";
  } finally {
    button.disabled = false;
    updatePowerRankerMode();
  }
}

function renderPowerRankerInstance(data) {
  const roomMode = data.storedByDelib === true;
  document.querySelector("#power-ranker-workspace").href = data.participantUrl;
  document.querySelector("#power-ranker-result-heading").textContent = roomMode
    ? "短期收件室準備好了"
    : "排序頁準備好了";
  document.querySelector("#power-ranker-result-copy").textContent = roomMode
    ? "先自己測試，再把公開連結分享給參與者；私人管理連結可以看彙整與提前刪除。"
    : "先自己試排一次，再分享給參與者；主辦者可在排序頁匯入多人結果。";
  const privateLinks = document.querySelector("#power-ranker-private-links");
  privateLinks.hidden = !roomMode;
  if (roomMode) {
    document.querySelector("#power-ranker-manage").href = data.manageUrl;
    const expires = new Intl.DateTimeFormat("zh-Hant-TW", { dateStyle: "long", timeStyle: "short" }).format(
      new Date(data.expiresAt),
    );
    document.querySelector("#power-ranker-expiry").textContent = `資料預計保留到 ${expires}，也可以提前刪除。`;
  }
  document.querySelector("#power-ranker-result").hidden = false;
}

function copyPowerRankerLink() {
  const link = document.querySelector("#power-ranker-workspace");
  if (!link.href) return;
  copyText(link.href, document.querySelector("#power-ranker-status"), "參與連結已複製。");
}

function copyPowerRankerManageLink() {
  const link = document.querySelector("#power-ranker-manage");
  if (!link.href) return;
  copyText(link.href, document.querySelector("#power-ranker-status"), "私人管理連結已複製，請放在安全的地方。 ");
}

async function createCallIn(event) {
  event.preventDefault();
  const status = document.querySelector("#call-in-status");
  const confirm = document.querySelector("#call-in-confirm");
  if (!confirm.checked) {
    status.textContent = "先看完建立預覽，再勾選確認；這不是額外條款，只是防止誤建活動。";
    confirm.focus();
    return;
  }

  const button = document.querySelector("#create-call-in");
  button.disabled = true;
  button.textContent = "正在建立，大概幾秒鐘…";
  status.textContent = "只會送出活動名稱、說明與公開簡報網址；不會送出你的審議拼圖。";
  try {
    const data = await postJson("/api/integrations/call-in", {
      title: document.querySelector("#call-in-title").value.trim(),
      description: document.querySelector("#call-in-description").value.trim(),
      deckUrl: document.querySelector("#call-in-deck").value.trim(),
      locale: "zh-Hant-TW",
      confirmed: true,
    });
    sessionStorage.setItem("delib:call-in-instance", JSON.stringify(data));
    renderCallInInstance(data);
    status.textContent = "活動已建立。先把私人連結存到安全的地方，再分享參與頁。";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Call-in 暫時沒有完成，稍後再試一次。";
  } finally {
    button.disabled = false;
    button.textContent = "建立 Call-in 活動";
  }
}

function restoreCallInInstance() {
  const raw = sessionStorage.getItem("delib:call-in-instance");
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data?.status === "ready" && data?.audienceUrl && data?.setupUrl) renderCallInInstance(data);
    else sessionStorage.removeItem("delib:call-in-instance");
  } catch {
    sessionStorage.removeItem("delib:call-in-instance");
  }
}

function restoreReceiptHandoff() {
  const raw = sessionStorage.getItem(RECEIPT_HANDOFF_STORAGE_KEY);
  if (!raw) return;
  sessionStorage.removeItem(RECEIPT_HANDOFF_STORAGE_KEY);
  try {
    const handoff = normalizeReceiptHandoff(JSON.parse(raw));
    if (!handoff) return;
    applyReceiptHandoff(handoff);
  } catch {
    // Invalid or expired drafts are consumed without touching any form.
  }
}

function applyReceiptHandoff(handoff) {
  const draft = handoff.draft;
  let focusTarget = null;
  if (handoff.target === "call-in") {
    document.querySelector("#call-in-title").value = draft.title;
    document.querySelector("#call-in-description").value = draft.description;
    document.querySelector("#call-in-form .advanced-fields").open = true;
    document.querySelector("#call-in-confirm").checked = false;
    document.querySelector("#call-in-result").hidden = true;
    focusTarget = document.querySelector("#call-in-deck");
  } else if (handoff.target === "harmonica") {
    document.querySelector("#harmonica-topic").value = draft.topic;
    document.querySelector("#harmonica-goal").value = draft.goal;
    document.querySelector("#harmonica-context").value = draft.context;
    document.querySelector("#harmonica-critical").value = draft.critical;
    document.querySelector("#harmonica-questions").value = draft.questions.join("\n");
    document.querySelector("#harmonica-form .advanced-fields").open = true;
    document.querySelector("#harmonica-confirm").checked = false;
    document.querySelector("#harmonica-result").hidden = true;
    focusTarget = document.querySelector("#harmonica-topic");
  } else if (handoff.target === "talk-to-the-city") {
    document.querySelector("#tttc-title").value = draft.title;
    document.querySelector("#tttc-description").value = draft.description;
    document.querySelector("#tttc-confirm").checked = false;
    document.querySelector("#tttc-result").hidden = true;
    focusTarget = document.querySelector("#tttc-title");
  } else {
    const siteMode = document.querySelector('input[name="polis-mode"][value="site"]');
    siteMode.checked = true;
    document.querySelector("#polis-title").value = draft.title;
    document.querySelector("#polis-confirm").checked = false;
    document.querySelector("#polis-result").hidden = true;
    updatePolisMode();
    focusTarget = document.querySelector("#polis-title");
  }

  const card = document.querySelector(`#${RECEIPT_HANDOFF_TARGETS[handoff.target].hash}`);
  const form = card.querySelector(".launch-form");
  const toast = document.createElement("section");
  toast.className = "handoff-toast";
  toast.setAttribute("role", "status");
  const heading = document.createElement("strong");
  heading.textContent = "已從成果收據帶入草稿";
  const summary = document.createElement("p");
  summary.textContent = `${handoff.source.title} → ${RECEIPT_HANDOFF_TARGETS[handoff.target].label}`;
  const boundary = document.createElement("p");
  boundary.textContent = "尚未建立任何外部活動，也沒有上傳參與資料。草稿暫存已刪除；請逐欄檢查後再勾選確認。";
  toast.append(heading, summary, boundary);
  form.prepend(toast);
  card.scrollIntoView({ block: "start" });
  queueMicrotask(() => focusTarget?.focus({ preventScroll: true }));
}

function renderCallInInstance(data) {
  document.querySelector("#call-in-audience").href = data.audienceUrl;
  document.querySelector("#call-in-presenter").href = data.presenterUrl;
  document.querySelector("#call-in-setup").href = data.setupUrl;
  document.querySelector("#call-in-moderator").href = data.moderatorUrl;
  const expires = new Intl.DateTimeFormat("zh-Hant-TW", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(data.expiresAt),
  );
  document.querySelector("#call-in-expiry").textContent = `預計保留到 ${expires}。`;
  document.querySelector("#call-in-result").hidden = false;
}

async function createPocketPolis(event) {
  event.preventDefault();
  const status = document.querySelector("#pocket-polis-status");
  const confirm = document.querySelector("#pocket-polis-confirm");
  if (!confirm.checked) {
    status.textContent = "先確認起始陳述、審核方式、公開範圍與主辦者責任。";
    confirm.focus();
    return;
  }

  const seedStatements = document
    .querySelector("#pocket-polis-seeds")
    .value.split(/\r?\n/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  const button = document.querySelector("#create-pocket-polis");
  button.disabled = true;
  status.textContent = "正在建立口袋審議與三種連結…";
  try {
    const data = await postJson("/api/integrations/pocket-polis", {
      title: document.querySelector("#pocket-polis-title").value.trim(),
      description: document.querySelector("#pocket-polis-description").value.trim(),
      seedStatements,
      autoApprove: document.querySelector("#pocket-polis-auto-approve").checked,
      allowSubmissions: document.querySelector("#pocket-polis-allow-submissions").checked,
      openData: document.querySelector("#pocket-polis-open-data").checked,
      confirmed: true,
    });
    sessionStorage.setItem(POCKET_POLIS_STORAGE_KEY, JSON.stringify(data));
    renderPocketPolisInstance(data);
    status.textContent = "活動已建立；請先測試參與頁，並把私人管理連結交給真正的主辦者。";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Pocket Polis 暫時沒有完成建立。";
  } finally {
    button.disabled = false;
  }
}

function restorePocketPolisInstance() {
  const saved = sessionStorage.getItem(POCKET_POLIS_STORAGE_KEY);
  if (!saved) return;
  try {
    renderPocketPolisInstance(JSON.parse(saved));
    document.querySelector("#pocket-polis-status").textContent = "已復原這個分頁剛建立的三種連結。";
  } catch {
    sessionStorage.removeItem(POCKET_POLIS_STORAGE_KEY);
  }
}

function renderPocketPolisInstance(data) {
  const serviceOrigin = validateServiceOrigin(data.serviceOrigin);
  const participateUrl = validatePocketPolisUrl(data.participateUrl, "c", false, serviceOrigin);
  const reportUrl = validatePocketPolisUrl(data.reportUrl, "r", false, serviceOrigin);
  const adminUrl = validatePocketPolisUrl(data.adminUrl, "a", true, serviceOrigin);
  if (!participateUrl || !reportUrl || !adminUrl) throw new Error("Pocket Polis 連結格式不完整");
  document.querySelector("#pocket-polis-participate").href = participateUrl;
  document.querySelector("#pocket-polis-report").href = reportUrl;
  document.querySelector("#pocket-polis-admin").href = adminUrl;
  document.querySelector("#pocket-polis-result").hidden = false;
}

function validateServiceOrigin(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password && parsed.pathname === "/" && !parsed.search && !parsed.hash
      ? parsed.origin
      : null;
  } catch {
    return null;
  }
}

function validatePocketPolisUrl(value, route, requiresToken, serviceOrigin) {
  if (!serviceOrigin) return null;
  try {
    const parsed = new URL(value);
    if (parsed.origin !== serviceOrigin || parsed.search) return null;
    if (!new RegExp(`^/${route}/[a-z0-9]{10}$`).test(parsed.pathname)) return null;
    if (requiresToken) {
      if (!/^#token=[a-f0-9]{32}$/i.test(parsed.hash)) return null;
    } else if (parsed.hash) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function updatePolisMode() {
  const mode = document.querySelector('input[name="polis-mode"]:checked')?.value || "existing";
  const existing = document.querySelector("#polis-existing-fields");
  const site = document.querySelector("#polis-site-fields");
  existing.hidden = mode !== "existing";
  site.hidden = mode !== "site";
  document.querySelector("#polis-conversation").required = mode === "existing";
  document.querySelector("#polis-site-id").required = mode === "site" && !polisDeploymentConnected;
  document.querySelector("#polis-title").required = mode === "site";
  document.querySelector("#open-polis").textContent =
    mode === "existing" ? "開啟 Pol.is 工作區" : "準備新的 Pol.is 對話";
}

async function loadPolisStatus() {
  try {
    const response = await fetch("/api/integrations/polis/status", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    polisDeploymentConnected = data.configured === true;
    if (polisDeploymentConnected) {
      document.querySelector("#polis-site-id").placeholder = "部署時已連接，可留白";
      document.querySelector("#polis-site-note").textContent =
        "這個 Delib 部署已連接 Pol.is Site ID；留白即可自動使用。Site ID 是公開識別碼，不是密碼。";
      updatePolisMode();
    }
  } catch {
    // The normal paste-a-Site-ID path remains usable when status lookup fails.
  }
}

async function preparePolis(event) {
  event.preventDefault();
  const status = document.querySelector("#polis-status");
  const confirm = document.querySelector("#polis-confirm");
  if (!confirm.checked) {
    status.textContent = "先確認這個畫面會連到 Pol.is；如果是新對話，第一次開啟才會真的建立。";
    confirm.focus();
    return;
  }
  const mode = document.querySelector('input[name="polis-mode"]:checked')?.value || "existing";
  const button = document.querySelector("#open-polis");
  button.disabled = true;
  status.textContent = mode === "existing" ? "正在檢查對話網址…" : "正在準備一個可復原的工作區網址…";
  try {
    const data = await postJson("/api/integrations/polis", {
      mode,
      conversation: document.querySelector("#polis-conversation").value.trim(),
      siteId: document.querySelector("#polis-site-id").value.trim(),
      title: document.querySelector("#polis-title").value.trim(),
      confirmed: true,
    });
    const workspace = document.querySelector("#polis-workspace");
    workspace.href = data.workspaceUrl;
    document.querySelector("#polis-result").hidden = false;
    status.textContent =
      data.writesWhenOpened === true
        ? "工作區網址已準備好；按下開啟時，Pol.is 才會新增對話。"
        : "工作區網址已準備好，Delib 沒有複製對話資料。";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Pol.is 工作區暫時沒有準備好。";
  } finally {
    button.disabled = false;
    updatePolisMode();
  }
}

async function prepareHeyForm(event) {
  event.preventDefault();
  const status = document.querySelector("#heyform-status");
  const confirm = document.querySelector("#heyform-confirm");
  if (!confirm.checked) {
    status.textContent = "先確認回答會直接交給 HeyForm，而且表單已說明資料用途與保存方式。";
    confirm.focus();
    return;
  }
  const button = document.querySelector("#open-heyform");
  button.disabled = true;
  status.textContent = "正在檢查公開表單網址…";
  try {
    const data = await postJson("/api/integrations/heyform", {
      form: document.querySelector("#heyform-url").value.trim(),
      confirmed: true,
    });
    document.querySelector("#heyform-workspace").href = data.workspaceUrl;
    document.querySelector("#heyform-result").hidden = false;
    status.textContent = "工作區網址已準備好；Delib 不會接收或保存表單回答。";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "HeyForm 工作區暫時沒有準備好。";
  } finally {
    button.disabled = false;
  }
}

async function prepareAgora(event) {
  event.preventDefault();
  const status = document.querySelector("#agora-status");
  const confirm = document.querySelector("#agora-confirm");
  if (!confirm.checked) {
    status.textContent = "先確認登入、意見、比較與投票會直接交給 Agora。";
    confirm.focus();
    return;
  }
  const button = document.querySelector("#open-agora");
  button.disabled = true;
  status.textContent = "正在檢查官方公開對話網址…";
  try {
    const data = await postJson("/api/integrations/agora", {
      conversation: document.querySelector("#agora-url").value.trim(),
      confirmed: true,
    });
    document.querySelector("#agora-workspace").href = data.workspaceUrl;
    document.querySelector("#agora-result").hidden = false;
    status.textContent = "工作區網址已準備好；Delib 不會接收或保存 Agora 的參與資料。";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Agora 工作區暫時沒有準備好。";
  } finally {
    button.disabled = false;
  }
}

async function prepareTttc(event) {
  event.preventDefault();
  const status = document.querySelector("#tttc-status");
  const confirm = document.querySelector("#tttc-confirm");
  if (!confirm.checked) {
    status.textContent = "先確認資料已去識別，且分析結果發布前會有人逐項複核。";
    confirm.focus();
    return;
  }
  const button = document.querySelector("#open-tttc");
  button.disabled = true;
  status.textContent = "正在準備官方建立工作區；目前不會上傳資料或建立報告…";
  try {
    const data = await postJson("/api/integrations/tttc", {
      title: document.querySelector("#tttc-title").value.trim(),
      description: document.querySelector("#tttc-description").value.trim(),
      confirmed: true,
    });
    document.querySelector("#tttc-workspace").href = data.workspaceUrl;
    document.querySelector("#tttc-result").hidden = false;
    status.textContent = "工作區已準備好；登入、CSV 與模型處理都不會經過 Delib。";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Talk to the City 工作區暫時沒有準備好。";
  } finally {
    button.disabled = false;
  }
}

async function createHarmonica(event) {
  event.preventDefault();
  const status = document.querySelector("#harmonica-status");
  const confirm = document.querySelector("#harmonica-confirm");
  const key = harmonicaKeyInput.value.trim();
  if (!key) {
    status.textContent = "請先貼上 Harmonica API key；也可以改用 MCP 讓自己的 Agent 建立。";
    harmonicaKeyInput.focus();
    return;
  }
  if (!confirm.checked) {
    status.textContent = "先確認資料邊界與人工複核責任，再建立外部 session。";
    confirm.focus();
    return;
  }

  const button = document.querySelector("#create-harmonica");
  button.disabled = true;
  button.textContent = "正在建立，大概幾秒鐘…";
  status.textContent = "主題、目標與選填情境將送到 Harmonica；key 不會被 Delib 保存。";
  try {
    const questions = document
      .querySelector("#harmonica-questions")
      .value.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8);
    const data = await postJson(
      "/api/integrations/harmonica",
      {
        topic: document.querySelector("#harmonica-topic").value.trim(),
        goal: document.querySelector("#harmonica-goal").value.trim(),
        context: document.querySelector("#harmonica-context").value.trim(),
        critical: document.querySelector("#harmonica-critical").value.trim(),
        questions,
        crossPollination: false,
        confirmed: true,
      },
      { "X-Harmonica-Key": key },
    );
    document.querySelector("#harmonica-workspace").href = data.workspaceUrl;
    document.querySelector("#harmonica-manage").href = data.manageUrl;
    document.querySelector("#harmonica-result").hidden = false;
    status.textContent = "Session 已建立；先自己走一次參與流程，再分享公開連結。";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Harmonica 暫時沒有完成建立。";
  } finally {
    button.disabled = false;
    button.textContent = "建立 Harmonica session";
  }
}

async function postJson(url, body, extraHeaders = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("工具回應不完整，這不是你的輸入問題；稍後再試一次。");
  }
  if (!response.ok) throw new Error(data.error || "工具暫時沒有完成；稍後再試一次。");
  return data;
}

async function copyShareLink() {
  const shareUrl = new URL(location.href);
  shareUrl.hash = "result";
  await copyText(shareUrl.toString(), actionStatus, "成果連結已複製；連結只包含固定選項，沒有自由文字。");
}

function downloadBundle() {
  if (!currentPlan) return;
  const bundle = buildBundle(currentPlan, shareUrl());
  downloadFile("delib-plan.json", JSON.stringify(bundle, null, 2), "application/json");
  actionStatus.textContent = "資料包已下載；目前版本不含參與者資料。";
}

function downloadRunbook() {
  if (!currentPlan) return;
  downloadFile("delib-runbook.md", buildMarkdown(currentPlan, shareUrl()), "text/markdown");
  actionStatus.textContent = "Markdown 執行手冊已下載。";
}

async function runAgent() {
  if (!currentPlan) {
    agentStatus.textContent = "先完成一份審議拼圖，再讓 AI 整理。";
    openPlanner("listen");
    return;
  }
  const key = apiKeyInput.value.trim();
  const consent = document.querySelector("#agent-consent").checked;
  if (!key) {
    agentStatus.textContent = "請貼上自己的 OpenAI API key，或改用右邊的 skill。";
    apiKeyInput.focus();
    return;
  }
  if (!consent) {
    agentStatus.textContent = "請先確認補充說明的資料邊界。";
    document.querySelector("#agent-consent").focus();
    return;
  }

  const button = document.querySelector("#run-agent");
  button.disabled = true;
  button.textContent = "正在整理…";
  agentStatus.textContent = "只送出這次流程與你填的補充說明；不會把 key 寫進資料庫。";
  agentOutput.hidden = true;

  try {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenAI-Key": key,
      },
      body: JSON.stringify({
        model: document.querySelector("#openai-model").value.trim(),
        context: document.querySelector("#agent-context").value.trim(),
        plan: currentPlan,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "AI 暫時無法完成");
    agentOutput.textContent = data.text;
    agentOutput.hidden = false;
    agentStatus.textContent = `已由 ${data.model} 產生；使用前請逐段人工複核。`;
  } catch (error) {
    agentStatus.textContent = error instanceof Error ? error.message : "AI 暫時無法完成，請稍後再試。";
  } finally {
    button.disabled = false;
    button.textContent = "產生主持簡報";
  }
}

function shareUrl() {
  const url = new URL(location.href);
  url.hash = "result";
  return url.toString();
}

async function copyText(value, statusElement, message) {
  try {
    await navigator.clipboard.writeText(value);
    statusElement.textContent = message;
  } catch {
    statusElement.textContent = "瀏覽器沒有開放剪貼簿；請手動選取並複製。";
  }
}

function downloadFile(filename, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type: `${type};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function externalLink(label, href) {
  const link = createElement("a", "", label);
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  return link;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
