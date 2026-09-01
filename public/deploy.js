const response = await fetch("/data/deployments.json", { cache: "no-cache" });
if (!response.ok) throw new Error("deployment registry unavailable");
const registry = await response.json();

document.querySelector("#deployment-updated").textContent = `最後查核 ${registry.updatedAt}`;
document.querySelector("#deployment-recipes").replaceChildren(
  ...registry.recipes.map((recipe, index) => recipeCard(recipe, index)),
);
document.querySelector("#operator-paths").replaceChildren(
  ...registry.operatorPaths.map(operatorCard),
);

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
  label.textContent = "已驗證的 Cloudflare 一鍵路徑";
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
