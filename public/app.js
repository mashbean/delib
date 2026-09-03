import {
  OPTIONS,
  buildBundle,
  buildMarkdown,
  buildPlan,
  normalizeState,
  stateFromSearch,
  stateToSearch,
} from "./core.js";
import {
  copyText,
  createElement,
  downloadFile,
  formatDateTime,
  postJson,
  storageGet,
  storageGetJson,
  storageRemove,
  storageSet,
} from "./ui-shared.js";

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
  adapter: "可轉接",
  catalog: "待接入",
};

const RESULT_TITLES = {
  listen: "這一輪，先聽見，再回覆。",
  understand: "把共識與歧見都留在地圖上。",
  evidence: "讓證據成為入口，不是最後一句話。",
  propose: "讓每次修正都看得到理由。",
  decide: "先說清楚權限，再作成決定。",
  followup: "審議結束，下一輪才正要開始。",
};

/** Integrations that have an in-site form or workspace card on this page. */
const LAUNCHABLE_ACTIVATIONS = new Set([
  "managed-create",
  "credentialed-create",
  "embedded-workspace",
  "local-tool",
  "local-or-ephemeral-room",
]);

const REGISTRY_PATHS = [
  "/data/tools.json",
  "/data/integrations.json",
  "/data/hosting.json",
  "/data/deliberation-process.json",
  "/data/tool-comparison.json",
];

const OPENAI_KEY_STORAGE_KEY = "delib:openai-key";
const HARMONICA_KEY_STORAGE_KEY = "delib:harmonica-key";
const CALL_IN_STORAGE_KEY = "delib:call-in-instance";
const POCKET_POLIS_STORAGE_KEY = "delib:pocket-polis-instance";
const POCKET_POLIS_DATA_STORAGE_KEY = "delib:pocket-polis-data-source";
// Mirrors RECEIPT_HANDOFF_STORAGE_KEY in receipt-handoff-core.js. The module
// itself is loaded only when a draft is waiting, so the homepage stays light.
const RECEIPT_HANDOFF_STORAGE_KEY = "delib:receipt-handoff";
const COMPARISON_PAGE_SIZE = 8;

let tools = [];
let integrations = new Map();
let hosting = new Map();
let processSteps = [];
let feedbackLoops = [];
let comparisonTools = [];
let registriesReady = false;
let registryFailed = false;
let pendingState = null;
let currentPlan = null;
let currentStep = 0;
let activeFilter = "all";
let activeComparisonFilter = "all";
let comparisonExpanded = false;
let polisDeploymentConnected = false;

const $ = (selector) => document.querySelector(selector);
const plannerDialog = $("#planner-dialog");
const plannerForm = $("#planner-form");
const plannerProgress = $("#planner-progress");
const stepCount = $("#step-count");
const plannerBack = $("#planner-back");
const plannerNext = $("#planner-next");
const plannerSubmit = $("#planner-submit");
const plannerError = $("#planner-error");
const handoffDialog = $("#handoff-dialog");
const resultSection = $("#result");
const resultTitle = $("#result-title");
const actionStatus = $("#action-status");
const agentStatus = $("#agent-status");
const agentOutput = $("#agent-output");
const apiKeyInput = $("#openai-key");
const harmonicaKeyInput = $("#harmonica-key");

// Interactive controls work before any data arrives: the wizard, every launch
// form and every copy button are bound synchronously, then registries load.
bindEvents();
restoreLocalState();
updatePolisMode();
updatePowerRankerMode();
openLaunchCardFromHash();
handleEntryState();
loadPolisStatus();
loadRegistries();

async function loadRegistries() {
  registryFailed = false;
  hideRegistryError();
  try {
    const [registry, integrationRegistry, hostingRegistry, processRegistry, comparisonRegistry] =
      await Promise.all(REGISTRY_PATHS.map(fetchJson));
    tools = Array.isArray(registry.tools) ? registry.tools : [];
    processSteps = Array.isArray(processRegistry.steps) ? processRegistry.steps : [];
    feedbackLoops = Array.isArray(processRegistry.feedbackLoops) ? processRegistry.feedbackLoops : [];
    comparisonTools = Array.isArray(comparisonRegistry.tools) ? comparisonRegistry.tools : [];
    integrations = new Map(
      (Array.isArray(integrationRegistry.integrations) ? integrationRegistry.integrations : []).map((item) => [
        item.toolId,
        item,
      ]),
    );
    hosting = new Map(
      (Array.isArray(hostingRegistry.tools) ? hostingRegistry.tools : []).map((item) => [item.toolId, item]),
    );
    registriesReady = true;
    $("#tool-count").textContent = String(tools.length);
    const comparisonUpdated = $("#comparison-updated");
    if (comparisonUpdated && typeof comparisonRegistry.updatedAt === "string") {
      comparisonUpdated.textContent = comparisonRegistry.updatedAt;
    }
    renderProcessMap();
    renderComparisonTable();
    renderToolLibrary();
    if (pendingState) {
      const state = pendingState;
      pendingState = null;
      renderResult(state, true);
    }
  } catch (error) {
    console.error(error);
    registryFailed = true;
    showRegistryError();
  }
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} responded ${response.status}`);
  return response.json();
}

function showRegistryError() {
  const banner = $("#registry-error");
  if (banner) {
    banner.replaceChildren(
      createElement("span", "", "工具目錄暫時讀不到，推薦與比較表無法顯示；直接啟用的表單仍可使用。"),
      retryButton(),
    );
    banner.hidden = false;
  }
  const library = $("#tool-library");
  if (library) library.replaceChildren(createElement("p", "empty-state", "工具目錄暫時讀不到；請稍後重試。"));
  if (pendingState && resultSection) {
    resultTitle.textContent = "工具目錄暫時讀不到";
    $("#result-summary").replaceChildren(
      document.createTextNode("推薦清單需要工具目錄才能產生。你的選擇已保留，"),
      retryButton(),
    );
  }
}

function retryButton() {
  const button = createElement("button", "text-button", "重試讀取");
  button.type = "button";
  button.addEventListener("click", loadRegistries);
  return button;
}

function hideRegistryError() {
  const banner = $("#registry-error");
  if (banner) {
    banner.hidden = true;
    banner.replaceChildren();
  }
}

function restoreLocalState() {
  apiKeyInput.value = storageGet(OPENAI_KEY_STORAGE_KEY) || "";
  harmonicaKeyInput.value = storageGet(HARMONICA_KEY_STORAGE_KEY) || "";
  restoreCallInInstance();
  restorePocketPolisInstance();
  restoreReceiptHandoff();
}

function handleEntryState() {
  const state = stateFromSearch(location.search);
  if (state) {
    renderResult(state, true);
    return;
  }
  const params = new URLSearchParams(location.search);
  const requestedGoal = params.get("start") || "";
  if (location.hash === "#start" || requestedGoal) {
    openPlanner(Object.hasOwn(OPTIONS.goal, requestedGoal) ? requestedGoal : null);
  }
}

function bindEvents() {
  document.querySelectorAll("[data-start]").forEach((button) => {
    button.addEventListener("click", () => openPlanner(button.dataset.start || null));
  });
  document.querySelectorAll("[data-start-handoff]").forEach((button) => {
    button.addEventListener("click", openHandoffDialog);
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog")?.close());
  });
  for (const dialog of [plannerDialog, handoffDialog]) {
    dialog?.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }
  plannerBack.addEventListener("click", () => showStep(currentStep - 1));
  plannerNext.addEventListener("click", () => {
    if (!validateStep(currentStep)) return;
    showStep(currentStep + 1);
  });
  plannerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateStep(currentStep)) return;
    // Enter on a radio button submits the form; treat that as "next" until the last step.
    if (currentStep < 3) {
      showStep(currentStep + 1);
      return;
    }
    const state = formState();
    if (!normalizeState(state)) {
      plannerError.textContent = "還有一個選擇沒有完成。";
      return;
    }
    const query = stateToSearch(state);
    history.pushState({}, "", `${location.pathname}?${query}#result`);
    plannerDialog.close();
    renderResult(state, true);
  });

  $("#handoff-plan")?.addEventListener("click", () => {
    handoffDialog?.close();
    openPlanner("followup");
  });
  $("#handoff-open-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const target = resolveResultUrl($("#handoff-url").value);
    const error = $("#handoff-error");
    if (!target) {
      error.textContent = "只接受本站的成果頁網址，例如 /r/ 開頭的短網址或 /results/ 開頭的完整連結。";
      $("#handoff-url").focus();
      return;
    }
    error.textContent = "";
    location.assign(target);
  });

  $("#copy-link").addEventListener("click", copyShareLink);
  $("#download-json").addEventListener("click", downloadBundle);
  $("#download-markdown").addEventListener("click", downloadRunbook);
  document.querySelectorAll("[data-open-agent], [data-start-agent]").forEach((button) => {
    button.addEventListener("click", () => {
      $("#agent").scrollIntoView();
      queueMicrotask(() => $("#openai-model")?.focus({ preventScroll: true }));
    });
  });

  $("#tool-search").addEventListener("input", renderToolLibrary);
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((candidate) => {
        candidate.classList.toggle("active", candidate === button);
        candidate.setAttribute("aria-pressed", candidate === button ? "true" : "false");
      });
      renderToolLibrary();
    });
  });
  document.querySelectorAll("[data-comparison-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      activeComparisonFilter = button.dataset.comparisonFilter;
      comparisonExpanded = false;
      document.querySelectorAll("[data-comparison-filter]").forEach((candidate) => {
        candidate.classList.toggle("active", candidate === button);
        candidate.setAttribute("aria-pressed", candidate === button ? "true" : "false");
      });
      renderComparisonTable();
    });
  });
  $("#comparison-more").addEventListener("click", () => {
    comparisonExpanded = !comparisonExpanded;
    renderComparisonTable();
  });
  document.querySelectorAll(".launch-card").forEach((card) => {
    card.addEventListener("toggle", () => {
      if (!card.open) return;
      document.querySelectorAll(".launch-card[open]").forEach((candidate) => {
        if (candidate !== card) candidate.open = false;
      });
    });
  });
  window.addEventListener("hashchange", openLaunchCardFromHash);

  apiKeyInput.addEventListener("input", () => {
    const key = apiKeyInput.value.trim();
    if (key) storageSet(OPENAI_KEY_STORAGE_KEY, key);
    else storageRemove(OPENAI_KEY_STORAGE_KEY);
  });
  $("#clear-key").addEventListener("click", () => {
    storageRemove(OPENAI_KEY_STORAGE_KEY);
    apiKeyInput.value = "";
    apiKeyInput.focus();
    agentStatus.textContent = "這個分頁裡的金鑰已清除。";
  });
  $("#run-agent").addEventListener("click", runAgent);
  $("#call-in-form").addEventListener("submit", createCallIn);
  $("#pocket-polis-form").addEventListener("submit", createPocketPolis);
  $("#polis-form").addEventListener("submit", preparePolis);
  $("#agora-form").addEventListener("submit", prepareAgora);
  $("#heyform-form").addEventListener("submit", prepareHeyForm);
  $("#tttc-form").addEventListener("submit", prepareTttc);
  $("#harmonica-form").addEventListener("submit", createHarmonica);
  $("#power-ranker-form").addEventListener("submit", preparePowerRanker);
  $("#copy-power-ranker-link").addEventListener("click", copyPowerRankerLink);
  $("#copy-power-ranker-manage").addEventListener("click", copyPowerRankerManageLink);
  document.querySelectorAll('input[name="power-ranker-mode"]').forEach((input) => {
    input.addEventListener("change", updatePowerRankerMode);
  });
  harmonicaKeyInput.addEventListener("input", () => {
    const key = harmonicaKeyInput.value.trim();
    if (key) storageSet(HARMONICA_KEY_STORAGE_KEY, key);
    else storageRemove(HARMONICA_KEY_STORAGE_KEY);
  });
  $("#clear-harmonica-key").addEventListener("click", () => {
    storageRemove(HARMONICA_KEY_STORAGE_KEY);
    harmonicaKeyInput.value = "";
    harmonicaKeyInput.focus();
    $("#harmonica-status").textContent = "這個分頁裡的 Harmonica 金鑰已清除。";
  });
  $("#copy-harmonica-agent").addEventListener("click", () =>
    copyText(
      "請使用 Harmonica MCP 幫我設計並建立一個審議 session。先問清楚主題、目標、參與者、資料邊界、人工複核與結束條件；建立外部 session 前讓我確認。可用 npx harmonica-mcp 啟動，API key 只放在本機環境，不要貼進對話或網址。",
      $("#harmonica-status"),
      "Harmonica MCP 啟動提示已複製。",
    ),
  );
  $("#copy-polis-agent").addEventListener("click", () =>
    copyText(
      "請幫我連接 Delib 與 Pol.is：先開啟 Pol.is 的帳號整合頁；若需要登入就停下來讓我操作。登入後找出帳號自動產生的 Site ID，再讓我選擇貼進 Delib，或設成 Cloudflare Worker 的 POLIS_SITE_ID。不要讀取、保存或回傳我的密碼與 session cookie。",
      $("#polis-status"),
      "Agent 連接指令已複製；請貼到支援瀏覽器操作的 Agent。",
    ),
  );
  $("#copy-pocket-polis-agent").addEventListener("click", () =>
    copyText(
      "請先閱讀 https://github.com/mashbean/pocket-polis/blob/main/AGENT.md，協助我設計一輪 Pocket Polis 口袋審議。請問清楚主題、參與者、後續回覆責任與資料公開範圍，草擬 5–15 句彼此不重複、每句只有一個觀點的起始陳述；建立前列出標題、說明、陳述、投稿審核與 openData 設定讓我確認。只有我確認後，才能在我擁有的 https://polis.mashbean.net 建立；私人 admin URL 只回傳給我，不要貼到公開文件或 log。也可以用 npx --yes github:mashbean/pocket-polis install-skill 安裝 skill。",
      $("#pocket-polis-status"),
      "Pocket Polis Agent 提示已複製；建立外部活動前仍會請你確認。",
    ),
  );
  document.querySelectorAll('input[name="polis-mode"]').forEach((input) => {
    input.addEventListener("change", updatePolisMode);
  });
  document.querySelectorAll("[data-copy-command]").forEach((button) => {
    button.addEventListener("click", () =>
      copyText("npx --yes github:mashbean/delib install-skill", agentStatus, "安裝指令已複製。"));
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
      pendingState = null;
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
  if (!plannerDialog.open) plannerDialog.showModal();
  const firstChoice = plannerForm.querySelector('[data-step="0"] input:checked') || plannerForm.querySelector('[data-step="0"] input');
  queueMicrotask(() => firstChoice?.focus());
}

function openHandoffDialog() {
  if (!handoffDialog) {
    openPlanner("followup");
    return;
  }
  $("#handoff-error").textContent = "";
  if (!handoffDialog.open) handoffDialog.showModal();
  queueMicrotask(() => handoffDialog.querySelector(".handoff-option")?.focus());
}

function resolveResultUrl(value) {
  try {
    const url = new URL(String(value || "").trim(), location.origin);
    if (url.origin !== location.origin) return null;
    if (!/^\/(r\/[a-f0-9]{16}|results\/(pocket-polis|power-ranker)(\.html)?)$/.test(url.pathname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function fillForm(state) {
  for (const name of ["goal", "format", "scale", "privacy", "output"]) {
    const input = plannerForm.querySelector(`input[name="${name}"][value="${state[name]}"]`);
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
  const normalized = normalizeState(state);
  if (!normalized) return;
  resultSection.hidden = false;
  if (!registriesReady) {
    pendingState = normalized;
    resultTitle.textContent = registryFailed ? "工具目錄暫時讀不到" : "正在準備你的審議拼圖…";
    $("#result-summary").textContent = registryFailed
      ? "推薦清單需要工具目錄才能產生；請按上方的「重試讀取」。"
      : "正在讀取工具目錄，通常幾秒內完成。";
    if (registryFailed) showRegistryError();
    if (scroll) focusResult();
    return;
  }

  currentPlan = buildPlan(normalized, tools);
  resultTitle.textContent = RESULT_TITLES[currentPlan.goal];
  $("#result-summary").textContent = `${currentPlan.labels.format} · ${currentPlan.labels.scale} · ${currentPlan.labels.privacy}。目標是留下${currentPlan.labels.output}。`;
  $("#sensitive-warning").hidden = currentPlan.privacy !== "sensitive";

  const gearRoot = $("#offline-gears");
  gearRoot.replaceChildren(
    ...currentPlan.offlineGears.map((gear) => {
      const node = createElement("article", "gear");
      node.append(createElement("strong", "", gear.title), createElement("p", "", gear.description));
      return node;
    }),
  );

  const toolRoot = $("#recommended-tools");
  if (currentPlan.tools.length) {
    toolRoot.replaceChildren(...currentPlan.tools.map(renderRecommendation));
  } else {
    toolRoot.replaceChildren(
      createElement(
        "p",
        "empty-state",
        "目錄裡還沒有完全符合這組條件的工具。先用線下齒輪開始，或放寬人數與資料條件再試一次。",
      ),
    );
  }
  const shareInput = $("#share-url");
  if (shareInput) shareInput.value = shareUrl();
  actionStatus.textContent = "";
  if (scroll) focusResult();
}

function focusResult() {
  resultSection.scrollIntoView({ block: "start" });
  queueMicrotask(() => resultTitle.focus({ preventScroll: true }));
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

function renderProcessMap() {
  const track = $("#process-track");
  const loopContainer = $("#feedback-loops");
  if (!track || !loopContainer || !processSteps.length) return;

  const nodes = processSteps.map((step, index) => {
    const button = createElement("button", `process-step process-step-${index + 1}`);
    button.type = "button";
    button.dataset.processStep = step.id;
    if (index === 0) button.setAttribute("aria-current", "step");
    const heading = createElement("span", "process-step-heading");
    heading.append(
      createProcessIcon(step.icon),
      createElement("span", "process-step-number", step.number),
      createElement("strong", "process-step-title", step.title),
    );
    button.append(heading);

    const humanLine = createElement("span", "process-flow-line process-flow-people");
    humanLine.append(createElement("b", "", "人流"), document.createTextNode(step.humanFlow));
    const dataLine = createElement("span", "process-flow-line process-flow-data");
    dataLine.append(createElement("b", "", "資料流"), document.createTextNode(step.dataFlow));
    const toolList = createElement("span", "process-tool-list");
    for (const tool of step.tools || []) toolList.append(createElement("span", "", tool));
    const connector = createElement("span", "process-connector");
    connector.setAttribute("aria-hidden", "true");
    const arrow = index < 3 ? "→" : index === 3 ? "↓" : index < 7 ? "←" : "↑";
    connector.append(
      createElement("i", "process-connector-people", arrow),
      createElement("i", "process-connector-data", arrow),
    );
    button.append(humanLine, dataLine, toolList, connector);
    button.addEventListener("click", () => selectProcessStep(step.id));
    return button;
  });
  track.replaceChildren(...nodes);

  loopContainer.replaceChildren(
    ...feedbackLoops.map((loop, index) => {
      const article = createElement("article", "feedback-loop-card");
      article.append(
        createElement("span", "feedback-loop-number", `LOOP ${String(index + 1).padStart(2, "0")}`),
        createElement("strong", "", loop.audience),
        createElement("p", "", loop.action),
      );
      return article;
    }),
  );
  selectProcessStep(processSteps[0].id);
}

function createProcessIcon(iconName) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "process-step-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `/assets/process-icons.svg#${iconName}`);
  svg.append(use);
  return svg;
}

function selectProcessStep(stepId) {
  const step = processSteps.find((item) => item.id === stepId);
  if (!step) return;
  document.querySelectorAll("[data-process-step]").forEach((button) => {
    if (button.dataset.processStep === stepId) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  $("#process-detail-title").textContent = `${step.number} · ${step.title}`;
  $("#process-detail-description").textContent = step.detail;
  $("#process-detail-tools").textContent = (step.tools || []).join("、");
  $("#process-detail-gate").textContent = step.gate;
  $("#process-detail-output").textContent = step.output;
}

function renderComparisonTable() {
  const body = $("#comparison-body");
  const empty = $("#comparison-empty");
  if (!body || !empty) return;
  const matches = comparisonTools.filter(matchesComparisonFilter);
  const visible = comparisonExpanded ? matches : matches.slice(0, COMPARISON_PAGE_SIZE);
  body.replaceChildren(...visible.map(renderComparisonRow));
  empty.hidden = matches.length > 0;
  const more = $("#comparison-more");
  more.hidden = matches.length <= COMPARISON_PAGE_SIZE;
  more.textContent = comparisonExpanded
    ? "收起工具列表"
    : `顯示另外 ${matches.length - COMPARISON_PAGE_SIZE} 個工具`;
  more.setAttribute("aria-expanded", comparisonExpanded ? "true" : "false");
}

function matchesComparisonFilter(tool) {
  switch (activeComparisonFilter) {
    case "one-click":
      return ["one-click", "bundled"].includes(tool.deploymentRoute);
    case "direct":
      return ["direct", "connected"].includes(tool.delibMode);
    case "data":
      return ["implemented", "partial"].includes(tool.interopLevel);
    case "shared-host":
      return ["shared-host", "rehabilitation"].includes(tool.deploymentRoute);
    case "upstream":
      return ["upstream-service", "upstream-or-self-host"].includes(tool.deploymentRoute);
    case "early":
      return ["early-stage", "rehabilitation"].includes(tool.deploymentRoute);
    default:
      return true;
  }
}

function renderComparisonRow(tool) {
  const row = document.createElement("tr");

  const identity = document.createElement("th");
  identity.scope = "row";
  identity.dataset.label = "工具與用途";
  const name = externalLink(tool.name, tool.url);
  name.className = "comparison-tool-name";
  const steps = createElement("span", "comparison-step-list");
  for (const step of tool.steps || []) steps.append(createElement("span", "", step));
  identity.append(name, createElement("span", "comparison-summary", tool.summary), steps);

  const delib = document.createElement("td");
  delib.dataset.label = "怎麼開始";
  delib.append(
    createElement("span", `comparison-use comparison-use-${comparisonUseMode(tool)}`, comparisonUseLabel(tool)),
    createElement("p", "comparison-use-detail", comparisonUseDetail(tool)),
  );
  const technical = document.createElement("details");
  technical.className = "comparison-technical";
  technical.append(createElement("summary", "", "部署與開源細節"));
  const technicalList = document.createElement("dl");
  technicalList.append(
    comparisonDetail("部署", `${tool.deploymentLabel}。${tool.deploymentDetail}`),
    comparisonDetail("主機責任", tool.serviceBoundary),
    comparisonDetail("原始碼", `${comparisonSourceLabel(tool.openSource)} · ${tool.license}`),
  );
  technical.append(technicalList, externalLink("查看官方依據 ↗", tool.source));
  delib.append(technical);

  const interop = document.createElement("td");
  interop.dataset.label = "資料能帶去哪裡";
  interop.append(createElement("span", `interop-state interop-state-${tool.interopLevel}`, comparisonInteropLabel(tool.interopLevel)));
  const formats = createElement("ul", "comparison-list");
  for (const item of tool.interop || []) formats.append(createElement("li", "", item));
  interop.append(formats);

  row.append(identity, delib, interop);
  return row;
}

function comparisonDetail(term, description) {
  const group = document.createElement("div");
  group.append(createElement("dt", "", term), createElement("dd", "", description));
  return group;
}

function comparisonUseMode(tool) {
  if (tool.delibMode === "direct") return "direct";
  if (tool.delibMode === "connected") return "connected";
  if (["upstream-service", "upstream-or-self-host"].includes(tool.deploymentRoute)) return "service";
  if (tool.deploymentRoute === "shared-host") return "shared-host";
  return "technical";
}

function comparisonUseLabel(tool) {
  const mode = comparisonUseMode(tool);
  if (mode === "direct") return "在 Delib 直接用";
  if (mode === "connected") return "從 Delib 開啟";
  if (mode === "service") return "使用官方服務";
  if (mode === "shared-host") return "使用共用主機";
  return "需要技術團隊";
}

function comparisonUseDetail(tool) {
  return ["direct", "connected"].includes(tool.delibMode) ? tool.delibPath : tool.deploymentDetail;
}

function comparisonInteropLabel(level) {
  return level === "implemented" ? "已實作" : level === "partial" ? "部分可接" : "尚待轉接";
}

function comparisonSourceLabel(status) {
  if (status === "yes") return "開源";
  if (status === "partial") return "部分公開";
  return "授權未確認";
}

function renderToolLibrary() {
  if (!tools.length) return;
  const term = $("#tool-search")?.value.trim().toLocaleLowerCase("zh-Hant") || "";
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
  $("#tool-library").replaceChildren(...matches.map(renderToolCard));
  $("#no-tools").hidden = matches.length > 0;
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
  if (!integration || !LAUNCHABLE_ACTIVATIONS.has(integration.activation)) return null;
  return document.getElementById(`launch-${toolId}`) ? integration : null;
}

function launchButton(toolId, integration) {
  const button = createElement(
    "button",
    "direct-launch",
    ["managed-create", "credentialed-create"].includes(integration.activation)
      ? "在這裡建立"
      : ["local-tool", "local-or-ephemeral-room"].includes(integration.activation)
        ? "在這裡使用"
        : "在這裡開啟",
  );
  button.type = "button";
  button.addEventListener("click", () => launchTool(toolId));
  return button;
}

function launchTool(toolId) {
  const target = document.getElementById(`launch-${toolId}`);
  if (!target) return;
  openLaunchCard(target);
  if (currentPlan) {
    const suggestedTitle = RESULT_TITLES[currentPlan.goal];
    const prefill = {
      "call-in": "#call-in-title",
      polis: "#polis-title",
      "pocket-polis": "#pocket-polis-title",
      "talk-to-the-city": "#tttc-title",
      harmonica: "#harmonica-topic",
      "power-ranker": "#power-ranker-title",
    }[toolId];
    const field = prefill ? $(prefill) : null;
    if (field && !field.value) field.value = suggestedTitle;
    if (toolId === "harmonica" && !$("#harmonica-goal").value) {
      $("#harmonica-goal").value = currentPlan.tools
        .map((tool) => tool.summary)
        .filter(Boolean)
        .slice(0, 2)
        .join(" ");
    }
  }
  target.scrollIntoView({ block: "start" });
  const firstInput = target.querySelector("input:not([type=checkbox]):not([type=radio])");
  queueMicrotask(() => firstInput?.focus({ preventScroll: true }));
}

function openLaunchCard(card) {
  if (!(card instanceof HTMLDetailsElement)) return;
  card.open = true;
}

function openLaunchCardFromHash() {
  if (!location.hash.startsWith("#launch-")) return;
  const card = document.getElementById(location.hash.slice(1));
  if (card?.classList.contains("launch-card")) openLaunchCard(card);
}

function updatePowerRankerMode() {
  const roomMode = $('input[name="power-ranker-mode"]:checked')?.value === "room";
  $("#power-ranker-room-fields").hidden = !roomMode;
  $("#power-ranker-local-preview").hidden = roomMode;
  $("#power-ranker-room-preview").hidden = !roomMode;
  $("#prepare-power-ranker").textContent = roomMode ? "建立短期收件室" : "準備排序頁";
}

async function preparePowerRanker(event) {
  event.preventDefault();
  const status = $("#power-ranker-status");
  const confirm = $("#power-ranker-confirm");
  if (!confirm.checked) {
    status.textContent = "先確認決策權限與題目資料邊界，再準備分享連結。";
    confirm.focus();
    return;
  }

  const button = $("#prepare-power-ranker");
  button.disabled = true;
  try {
    const { normalizeRankingConfig, rankingConfigToHash } = await import("./power-ranker-core.js");
    const config = normalizeRankingConfig({
      title: $("#power-ranker-title").value,
      items: $("#power-ranker-items").value.split(/\r?\n/),
    });
    if (!config) {
      status.textContent = "請填入問題與 3–10 個不重複項目；每個項目都要獨立一行。";
      $("#power-ranker-items").focus();
      return;
    }

    const mode = $('input[name="power-ranker-mode"]:checked')?.value || "local";
    if (mode === "room") {
      status.textContent = "正在建立短期收件室；只會送出題目、選項與清除期限。";
      const data = await postJson("/api/integrations/power-ranker/rooms", {
        title: config.title,
        items: config.items,
        retentionHours: Number($("#power-ranker-retention").value),
        confirmed: true,
      });
      renderPowerRankerInstance(data);
      status.textContent = "收件室已建立。先保存私人管理連結，再分享公開參與連結。";
    } else {
      const workspace = new URL("/integrations/power-ranker", location.origin);
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
  $("#power-ranker-workspace").href = data.participantUrl;
  const linkInput = $("#power-ranker-link");
  if (linkInput) {
    linkInput.value = data.participantUrl;
    linkInput.hidden = false;
  }
  $("#power-ranker-result-heading").textContent = roomMode
    ? "短期收件室準備好了"
    : "排序頁準備好了";
  $("#power-ranker-result-copy").textContent = roomMode
    ? "先自己測試，再把公開連結分享給參與者；私人管理連結可以看彙整與提前刪除。"
    : "先自己試排一次，再分享給參與者；主辦者可在排序頁匯入多人結果。";
  const privateLinks = $("#power-ranker-private-links");
  privateLinks.hidden = !roomMode;
  if (roomMode) {
    $("#power-ranker-manage").href = data.manageUrl;
    $("#power-ranker-expiry").textContent = `資料預計保留到 ${formatDateTime(data.expiresAt)}，也可以提前刪除。`;
  }
  $("#power-ranker-result").hidden = false;
}

function copyPowerRankerLink() {
  const link = $("#power-ranker-workspace");
  if (!link.href) return;
  copyText(link.href, $("#power-ranker-status"), "參與連結已複製。", $("#power-ranker-link"));
}

function copyPowerRankerManageLink() {
  const link = $("#power-ranker-manage");
  if (!link.href) return;
  copyText(link.href, $("#power-ranker-status"), "私人管理連結已複製，請放在安全的地方。");
}

async function createCallIn(event) {
  event.preventDefault();
  const status = $("#call-in-status");
  const confirm = $("#call-in-confirm");
  if (!confirm.checked) {
    status.textContent = "先看完建立預覽，再勾選確認；這一步只是避免誤建活動。";
    confirm.focus();
    return;
  }

  const button = $("#create-call-in");
  button.disabled = true;
  button.textContent = "正在建立，大概幾秒鐘…";
  status.textContent = "只會送出活動名稱、說明與公開簡報網址；不會送出你的審議拼圖。";
  try {
    const data = await postJson("/api/integrations/call-in", {
      title: $("#call-in-title").value.trim(),
      description: $("#call-in-description").value.trim(),
      deckUrl: $("#call-in-deck").value.trim(),
      locale: "zh-Hant-TW",
      confirmed: true,
    });
    storageSet(CALL_IN_STORAGE_KEY, JSON.stringify(data));
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
  const data = storageGetJson(CALL_IN_STORAGE_KEY);
  if (!data) return;
  if (data?.status === "ready" && data?.audienceUrl && data?.setupUrl) renderCallInInstance(data);
  else storageRemove(CALL_IN_STORAGE_KEY);
}

async function restoreReceiptHandoff() {
  const raw = storageGet(RECEIPT_HANDOFF_STORAGE_KEY);
  if (!raw) return;
  storageRemove(RECEIPT_HANDOFF_STORAGE_KEY);
  try {
    const { normalizeReceiptHandoff, RECEIPT_HANDOFF_TARGETS } = await import("./receipt-handoff-core.js");
    const handoff = normalizeReceiptHandoff(JSON.parse(raw));
    if (!handoff) return;
    applyReceiptHandoff(handoff, RECEIPT_HANDOFF_TARGETS);
  } catch {
    // Invalid or expired drafts are consumed without touching any form.
  }
}

function applyReceiptHandoff(handoff, targets) {
  const draft = handoff.draft;
  let focusTarget = null;
  if (handoff.target === "call-in") {
    $("#call-in-title").value = draft.title;
    $("#call-in-description").value = draft.description;
    $("#call-in-form .advanced-fields").open = true;
    $("#call-in-confirm").checked = false;
    $("#call-in-result").hidden = true;
    focusTarget = $("#call-in-deck");
  } else if (handoff.target === "harmonica") {
    $("#harmonica-topic").value = draft.topic;
    $("#harmonica-goal").value = draft.goal;
    $("#harmonica-context").value = draft.context;
    $("#harmonica-critical").value = draft.critical;
    $("#harmonica-questions").value = draft.questions.join("\n");
    $("#harmonica-form .advanced-fields").open = true;
    $("#harmonica-confirm").checked = false;
    $("#harmonica-result").hidden = true;
    focusTarget = $("#harmonica-topic");
  } else if (handoff.target === "talk-to-the-city") {
    $("#tttc-title").value = draft.title;
    $("#tttc-description").value = draft.description;
    $("#tttc-confirm").checked = false;
    $("#tttc-result").hidden = true;
    focusTarget = $("#tttc-title");
  } else {
    const siteMode = $('input[name="polis-mode"][value="site"]');
    siteMode.checked = true;
    $("#polis-title").value = draft.title;
    $("#polis-confirm").checked = false;
    $("#polis-result").hidden = true;
    updatePolisMode();
    focusTarget = $("#polis-title");
  }

  const card = document.getElementById(targets[handoff.target].hash);
  openLaunchCard(card);
  const form = card.querySelector(".launch-form");
  const toast = document.createElement("section");
  toast.className = "handoff-toast";
  toast.setAttribute("role", "status");
  const heading = document.createElement("strong");
  heading.textContent = "已從成果收據帶入草稿";
  const summary = document.createElement("p");
  summary.textContent = `${handoff.source.title} → ${targets[handoff.target].label}`;
  const boundary = document.createElement("p");
  boundary.textContent = "尚未建立任何外部活動，也沒有上傳參與資料。草稿暫存已刪除；請逐欄檢查後再勾選確認。";
  toast.append(heading, summary, boundary);
  form.prepend(toast);
  card.scrollIntoView({ block: "start" });
  queueMicrotask(() => focusTarget?.focus({ preventScroll: true }));
}

function renderCallInInstance(data) {
  $("#call-in-audience").href = data.audienceUrl;
  $("#call-in-presenter").href = data.presenterUrl;
  $("#call-in-setup").href = data.setupUrl;
  $("#call-in-moderator").href = data.moderatorUrl;
  $("#call-in-expiry").textContent = `預計保留到 ${formatDateTime(data.expiresAt)}。`;
  $("#call-in-result").hidden = false;
}

async function createPocketPolis(event) {
  event.preventDefault();
  const status = $("#pocket-polis-status");
  const confirm = $("#pocket-polis-confirm");
  if (!confirm.checked) {
    status.textContent = "先確認起始陳述、審核方式、公開範圍與主辦者責任。";
    confirm.focus();
    return;
  }

  const seedStatements = $("#pocket-polis-seeds")
    .value.split(/\r?\n/)
    .map((statement) => statement.trim())
    .filter(Boolean);
  const button = $("#create-pocket-polis");
  const title = $("#pocket-polis-title").value.trim();
  const description = $("#pocket-polis-description").value.trim();
  button.disabled = true;
  status.textContent = "正在建立口袋審議與三種連結…";
  try {
    const data = await postJson("/api/integrations/pocket-polis", {
      title,
      description,
      seedStatements,
      autoApprove: $("#pocket-polis-auto-approve").checked,
      allowSubmissions: $("#pocket-polis-allow-submissions").checked,
      openData: $("#pocket-polis-open-data").checked,
      confirmed: true,
    });
    // Persist before rendering: the private admin link must survive a display glitch.
    storageSet(POCKET_POLIS_STORAGE_KEY, JSON.stringify(data));
    storageSet(
      POCKET_POLIS_DATA_STORAGE_KEY,
      JSON.stringify({ title, description, reportUrl: data.reportUrl }),
    );
    const rendered = renderPocketPolisInstance(data);
    status.textContent = rendered.strict
      ? "活動已建立；請先測試參與頁，並把私人管理連結交給真正的主辦者。"
      : "活動已建立，但連結格式和預期不同；請先到 Pocket Polis 管理頁確認，再分享參與連結。";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Pocket Polis 暫時沒有完成建立。";
  } finally {
    button.disabled = false;
  }
}

function restorePocketPolisInstance() {
  const data = storageGetJson(POCKET_POLIS_STORAGE_KEY);
  if (!data) return;
  try {
    renderPocketPolisInstance(data);
    if (!storageGet(POCKET_POLIS_DATA_STORAGE_KEY)) {
      storageSet(
        POCKET_POLIS_DATA_STORAGE_KEY,
        JSON.stringify({ title: data.title, description: "", reportUrl: data.reportUrl }),
      );
    }
    $("#pocket-polis-status").textContent = "已復原這個分頁剛建立的三種連結。";
  } catch {
    storageRemove(POCKET_POLIS_STORAGE_KEY);
  }
}

function renderPocketPolisInstance(data) {
  const serviceOrigin = validateServiceOrigin(data.serviceOrigin);
  const strict = {
    participate: validatePocketPolisUrl(data.participateUrl, "c", false, serviceOrigin),
    report: validatePocketPolisUrl(data.reportUrl, "r", false, serviceOrigin),
    admin: validatePocketPolisUrl(data.adminUrl, "a", true, serviceOrigin),
  };
  const isStrict = Boolean(strict.participate && strict.report && strict.admin);
  // Fall back to a plain HTTPS check so an upstream format change never hides
  // the only copy of the organizer's admin link.
  const participateUrl = strict.participate || httpsUrlOrNull(data.participateUrl);
  const reportUrl = strict.report || httpsUrlOrNull(data.reportUrl);
  const adminUrl = strict.admin || httpsUrlOrNull(data.adminUrl);
  if (!participateUrl || !reportUrl || !adminUrl) throw new Error("Pocket Polis 連結格式不完整");
  $("#pocket-polis-participate").href = participateUrl;
  $("#pocket-polis-report").href = reportUrl;
  $("#pocket-polis-admin").href = adminUrl;
  $("#pocket-polis-result").hidden = false;
  return { strict: isStrict };
}

function httpsUrlOrNull(value) {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : null;
  } catch {
    return null;
  }
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
  const mode = $('input[name="polis-mode"]:checked')?.value || "existing";
  const existing = $("#polis-existing-fields");
  const site = $("#polis-site-fields");
  existing.hidden = mode !== "existing";
  site.hidden = mode !== "site";
  $("#polis-conversation").required = mode === "existing";
  $("#polis-site-id").required = mode === "site" && !polisDeploymentConnected;
  $("#polis-title").required = mode === "site";
  $("#open-polis").textContent =
    mode === "existing" ? "開啟 Pol.is 工作區" : "準備新的 Pol.is 對話";
}

async function loadPolisStatus() {
  try {
    const response = await fetch("/api/integrations/polis/status", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    polisDeploymentConnected = data.configured === true;
    if (polisDeploymentConnected) {
      $("#polis-site-id").placeholder = "部署時已連接，可留白";
      $("#polis-site-note").textContent =
        "這個 Delib 部署已連接 Pol.is Site ID；留白即可自動使用。Site ID 是公開識別碼，不是密碼。";
      updatePolisMode();
    }
  } catch {
    // The normal paste-a-Site-ID path remains usable when status lookup fails.
  }
}

async function preparePolis(event) {
  event.preventDefault();
  const status = $("#polis-status");
  const confirm = $("#polis-confirm");
  if (!confirm.checked) {
    status.textContent = "先確認這個畫面會連到 Pol.is；如果是新對話，第一次開啟才會真的建立。";
    confirm.focus();
    return;
  }
  const mode = $('input[name="polis-mode"]:checked')?.value || "existing";
  const button = $("#open-polis");
  button.disabled = true;
  status.textContent = mode === "existing" ? "正在檢查對話網址…" : "正在準備一個可復原的工作區網址…";
  try {
    const data = await postJson("/api/integrations/polis", {
      mode,
      conversation: $("#polis-conversation").value.trim(),
      siteId: $("#polis-site-id").value.trim(),
      title: $("#polis-title").value.trim(),
      confirmed: true,
    });
    $("#polis-workspace").href = data.workspaceUrl;
    $("#polis-result").hidden = false;
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
  const status = $("#heyform-status");
  const confirm = $("#heyform-confirm");
  if (!confirm.checked) {
    status.textContent = "先確認回答會直接交給 HeyForm，而且表單已說明資料用途與保存方式。";
    confirm.focus();
    return;
  }
  const button = $("#open-heyform");
  button.disabled = true;
  status.textContent = "正在檢查公開表單網址…";
  try {
    const data = await postJson("/api/integrations/heyform", {
      form: $("#heyform-url").value.trim(),
      confirmed: true,
    });
    $("#heyform-workspace").href = data.workspaceUrl;
    $("#heyform-result").hidden = false;
    status.textContent = "工作區網址已準備好；Delib 不會接收或保存表單回答。";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "HeyForm 工作區暫時沒有準備好。";
  } finally {
    button.disabled = false;
  }
}

async function prepareAgora(event) {
  event.preventDefault();
  const status = $("#agora-status");
  const confirm = $("#agora-confirm");
  if (!confirm.checked) {
    status.textContent = "先確認登入、意見、比較與投票會直接交給 Agora。";
    confirm.focus();
    return;
  }
  const button = $("#open-agora");
  button.disabled = true;
  status.textContent = "正在檢查官方公開對話網址…";
  try {
    const data = await postJson("/api/integrations/agora", {
      conversation: $("#agora-url").value.trim(),
      confirmed: true,
    });
    $("#agora-workspace").href = data.workspaceUrl;
    $("#agora-result").hidden = false;
    status.textContent = "工作區網址已準備好；Delib 不會接收或保存 Agora 的參與資料。";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Agora 工作區暫時沒有準備好。";
  } finally {
    button.disabled = false;
  }
}

async function prepareTttc(event) {
  event.preventDefault();
  const status = $("#tttc-status");
  const confirm = $("#tttc-confirm");
  if (!confirm.checked) {
    status.textContent = "先確認資料已去識別，且分析結果發布前會有人逐項複核。";
    confirm.focus();
    return;
  }
  const button = $("#open-tttc");
  button.disabled = true;
  status.textContent = "正在準備官方建立工作區；目前不會上傳資料或建立報告…";
  try {
    const data = await postJson("/api/integrations/tttc", {
      title: $("#tttc-title").value.trim(),
      description: $("#tttc-description").value.trim(),
      confirmed: true,
    });
    $("#tttc-workspace").href = data.workspaceUrl;
    $("#tttc-result").hidden = false;
    status.textContent = "工作區已準備好；登入、CSV 與模型處理都不會經過 Delib。";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Talk to the City 工作區暫時沒有準備好。";
  } finally {
    button.disabled = false;
  }
}

async function createHarmonica(event) {
  event.preventDefault();
  const status = $("#harmonica-status");
  const confirm = $("#harmonica-confirm");
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

  const button = $("#create-harmonica");
  button.disabled = true;
  button.textContent = "正在建立，大概幾秒鐘…";
  status.textContent = "主題、目標與選填情境將送到 Harmonica；金鑰不會被 Delib 保存。";
  try {
    const questions = $("#harmonica-questions")
      .value.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8);
    const data = await postJson(
      "/api/integrations/harmonica",
      {
        topic: $("#harmonica-topic").value.trim(),
        goal: $("#harmonica-goal").value.trim(),
        context: $("#harmonica-context").value.trim(),
        critical: $("#harmonica-critical").value.trim(),
        questions,
        crossPollination: false,
        confirmed: true,
      },
      { "X-Harmonica-Key": key },
    );
    $("#harmonica-workspace").href = data.workspaceUrl;
    $("#harmonica-manage").href = data.manageUrl;
    $("#harmonica-result").hidden = false;
    status.textContent = "Session 已建立；先自己走一次參與流程，再分享公開連結。";
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Harmonica 暫時沒有完成建立。";
  } finally {
    button.disabled = false;
    button.textContent = "建立 Harmonica session";
  }
}

async function copyShareLink() {
  if (!currentPlan) {
    actionStatus.textContent = "推薦清單還沒產生，連結稍後再複製。";
    return;
  }
  await copyText(
    shareUrl(),
    actionStatus,
    "成果連結已複製；連結只包含固定選項，沒有自由文字。",
    $("#share-url"),
  );
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
  const consent = $("#agent-consent").checked;
  if (!key) {
    agentStatus.textContent = "請貼上自己的 OpenAI API key，或改用右邊的 skill。";
    apiKeyInput.focus();
    return;
  }
  if (!consent) {
    agentStatus.textContent = "請先確認補充說明的資料邊界。";
    $("#agent-consent").focus();
    return;
  }

  const button = $("#run-agent");
  button.disabled = true;
  button.textContent = "正在整理…";
  agentStatus.textContent = "只送出這次流程與你填的補充說明；不會把金鑰寫進資料庫。";
  agentOutput.hidden = true;

  try {
    const data = await postJson(
      "/api/agent",
      {
        model: $("#openai-model").value.trim(),
        context: $("#agent-context").value.trim(),
        plan: currentPlan,
      },
      { "X-OpenAI-Key": key },
    );
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

function externalLink(label, href) {
  const link = createElement("a", "", label);
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  return link;
}
