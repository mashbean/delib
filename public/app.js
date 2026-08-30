import {
  OPTIONS,
  buildBundle,
  buildMarkdown,
  buildPlan,
  normalizeState,
  stateFromSearch,
  stateToSearch,
} from "./core.js";

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

let tools = [];
let currentPlan = null;
let currentStep = 0;
let activeFilter = "all";

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

init().catch((error) => {
  console.error(error);
  const library = document.querySelector("#tool-library");
  library.replaceChildren(
    createElement("p", "empty-state", "工具目錄暫時讀不到，但你仍可下載 skill 或稍後再試。"),
  );
});

async function init() {
  const response = await fetch("/data/tools.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("tool registry unavailable");
  const registry = await response.json();
  tools = Array.isArray(registry.tools) ? registry.tools : [];
  document.querySelector("#tool-count").textContent = String(tools.length);
  renderToolLibrary();
  bindEvents();

  apiKeyInput.value = sessionStorage.getItem("delib:openai-key") || "";
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
  head.append(
    createElement("h4", "", tool.name),
    createElement("span", "status-chip", STATUS_LABELS[tool.status] || "工具目錄"),
  );
  article.append(head, createElement("p", "", tool.summary));

  const reasons = createElement("div", "match-reasons");
  for (const reason of tool.match.reasons.slice(0, 3)) reasons.append(createElement("span", "reason-chip", reason));
  article.append(reasons);

  const links = createElement("div", "recommendation-links");
  links.append(externalLink("查看工具 ↗", tool.url));
  if (tool.deploy) links.append(externalLink("部署到 Cloudflare ↗", tool.deploy));
  if (tool.source && tool.source !== tool.url) links.append(externalLink("來源", tool.source));
  article.append(links);
  return article;
}

function renderToolLibrary() {
  if (!tools.length) return;
  const term = document.querySelector("#tool-search")?.value.trim().toLocaleLowerCase("zh-Hant") || "";
  const matches = tools.filter((tool) => {
    if (activeFilter !== "all" && tool.status !== activeFilter) return false;
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
  top.append(
    createElement("h3", "", tool.name),
    createElement("span", "status-chip", STATUS_LABELS[tool.status] || "工具目錄"),
  );
  const stages = createElement("div", "stage-list");
  for (const stage of tool.stages || []) stages.append(createElement("span", "", STAGE_LABELS[stage] || stage));
  const links = createElement("div", "tool-card-links");
  links.append(externalLink("查看 ↗", tool.url));
  if (tool.source && tool.source !== tool.url) links.append(externalLink("來源", tool.source));
  article.append(top, createElement("p", "", tool.summary), stages, links);
  return article;
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
