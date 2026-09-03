const recipesRoot = document.querySelector("#deployment-recipes");
const operatorRoot = document.querySelector("#operator-paths");
recipesRoot.replaceChildren(loadingNote("正在讀取部署配方…"));

try {
  const response = await fetch("/data/deployments.json");
  if (!response.ok) throw new Error(`deployment registry responded ${response.status}`);
  const registry = await response.json();
  document.querySelector("#deployment-updated").textContent = `最後查核 ${registry.updatedAt}`;
  const lede = document.querySelector("#deployment-lede");
  if (lede) {
    lede.textContent = `目前有 ${registry.recipes.length} 個可重現的 Cloudflare 部署配方，涵蓋 ${new Set(registry.recipes.flatMap((recipe) => recipe.gears || [recipe.id])).size} 個站內齒輪。其他工具會清楚說明需要共用主機、上游帳號或先整修的原因。`;
  }
  recipesRoot.replaceChildren(...registry.recipes.map((recipe, index) => recipeCard(recipe, index)));
  operatorRoot.replaceChildren(...registry.operatorPaths.map(operatorCard));
} catch (error) {
  console.error(error);
  const failure = document.createElement("div");
  failure.className = "registry-error";
  failure.setAttribute("role", "alert");
  failure.textContent = "部署配方暫時讀不到；請重新整理，或直接到 GitHub 查看 wrangler 設定。";
  recipesRoot.replaceChildren(failure);
}

function loadingNote(text) {
  const note = document.createElement("p");
  note.className = "loading-note";
  note.setAttribute("role", "status");
  note.textContent = text;
  return note;
}

function recipeCard(recipe, index) {
  const article = document.createElement("article");
  article.className = "deployment-card";
  const number = document.createElement("span");
  number.className = "panel-number";
  number.textContent = String(index + 1).padStart(2, "0");
  const heading = document.createElement("div");
  const label = document.createElement("span");
  const title = document.createElement("h2");
  const summary = document.createElement("p");
  label.className = "receipt-layer-label receipt-layer-next";
  label.textContent = recipe.verification?.label || "可重現的 Cloudflare 部署配方";
  title.textContent = recipe.name;
  summary.textContent = recipe.summary;
  heading.append(label, title, summary);
  const chips = document.createElement("div");
  chips.className = "deployment-tool-list";
  chips.append(...recipe.tools.map((tool) => {
    const chip = document.createElement("span");
    chip.textContent = tool;
    return chip;
  }));
  const details = document.createElement("dl");
  details.append(
    detail("執行環境", recipe.runtime),
    detail("需要帳號", recipe.account),
    detail("資料邊界", recipe.dataBoundary),
  );
  if (recipe.verification?.summary) details.append(detail("驗證狀態", recipe.verification.summary));
  const actions = document.createElement("div");
  actions.className = "result-actions";
  actions.append(
    link("部署到我的 Cloudflare ↗", recipe.deployUrl, "button button-primary"),
    link("查看原始碼 ↗", recipe.repositoryUrl, "button button-ghost"),
  );
  article.append(number, heading, chips, details, actions);
  return article;
}

function operatorCard(item) {
  const article = document.createElement("article");
  article.className = "operator-card";
  const label = document.createElement("span");
  const title = document.createElement("h3");
  const summary = document.createElement("p");
  const path = document.createElement("p");
  label.className = "status-chip";
  label.textContent = statusLabel(item.status);
  title.textContent = item.name;
  summary.textContent = item.summary;
  path.className = "operator-current-path";
  path.textContent = `現在可走：${item.currentPath}`;
  article.append(label, title, summary, path);
  return article;
}

function detail(term, description) {
  const row = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = term;
  dd.textContent = description;
  row.append(dt, dd);
  return row;
}

function link(text, href, className) {
  const anchor = document.createElement("a");
  anchor.textContent = text;
  anchor.href = href;
  anchor.className = className;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  return anchor;
}

function statusLabel(status) {
  return {
    "shared-host": "需要共用主機",
    connected: "已有連接路徑",
    "needs-rehabilitation": "需先整修",
  }[status] || status;
}
