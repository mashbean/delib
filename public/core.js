export const OPTIONS = {
  goal: {
    listen: "聽見更多人的需要",
    understand: "整理共識與歧見",
    evidence: "用證據形成議程",
    propose: "一起形成提案",
    decide: "排序、投票或作成決定",
    followup: "回覆參與者並啟動下一輪",
  },
  format: {
    hybrid: "線下活動＋線上工具",
    online: "主要在線上進行",
    offline: "主要在線下進行",
  },
  scale: {
    small: "50 人以下",
    medium: "50–300 人",
    large: "300 人以上",
  },
  privacy: {
    public: "可以公開的意見",
    pseudonymous: "需要匿名或化名",
    sensitive: "含敏感／高風險內容",
  },
  output: {
    questions: "問題池與待回答事項",
    insights: "共識、歧見與少數聲音",
    evidence: "可追溯的證據與議題地圖",
    proposals: "提案與修正紀錄",
    decision: "排序、投票或正式決定",
    receipt: "成果收據與下一輪承諾",
  },
};

const REQUIRED_KEYS = ["goal", "format", "scale", "privacy", "output"];

const OFFLINE_GEARS = {
  listen: [
    ["審議前 · 說清楚問題", "和受影響的人一起確認提問方式、招募缺口、知情同意與資料用途。"],
    ["進行中 · 留住少數聲音", "主持人要能暫停節奏、補問脈絡，並讓沒有被按讚的意見仍進入紀錄。"],
    ["結束後 · 回覆每一類問題", "公布聽見了什麼、還沒回答什麼、誰會在什麼時候回覆。"],
  ],
  understand: [
    ["審議前 · 定義什麼算共識", "先寫出聚類、摘要與人工複核方法，避免把安靜誤認為同意。"],
    ["進行中 · 找橋，不抹平歧見", "邀請參與者檢查摘要是否忠實，特別標出橋接觀點與不可調和的衝突。"],
    ["結束後 · 公開方法與限制", "讓人看得到資料範圍、缺席者、演算法處理與主持者判斷。"],
  ],
  evidence: [
    ["審議前 · 建立證據底座", "分開官方資料、當事人經驗與主辦者詮釋，為來源標上日期與責任人。"],
    ["進行中 · 允許質疑證據", "設計補充、反證與不知道的入口，不讓資料圖表直接取代價值討論。"],
    ["結束後 · 留下版本", "保存使用過的資料快照、轉換方法、缺漏與之後的更新方式。"],
  ],
  propose: [
    ["審議前 · 說明限制條件", "公開預算、法規、時程與不可變更的邊界，避免提案最後才被宣告不可行。"],
    ["進行中 · 記錄提案怎麼變", "保留原提案、修正原因、反對理由與整合過程。"],
    ["結束後 · 指定下一個負責人", "每個進入下一輪的提案都要有檢核條件、負責人與回報時間。"],
  ],
  decide: [
    ["審議前 · 公開決策權", "說清楚結果是諮詢、排序、共同決定，還是交由機關裁量。"],
    ["進行中 · 先理解再投票", "投票前提供提案比較、少數意見與利害關係揭露。"],
    ["結束後 · 解釋採納與未採納", "公布方法、門檻、結果與理由，讓反對者知道如何申訴或再提。"],
  ],
  followup: [
    ["審議前 · 先承諾回覆格式", "預先告知何時公布、由誰回覆、哪些資訊可以公開。"],
    ["進行中 · 確認紀錄可辨認", "讓參與者看見自己的意見被放在哪裡，並能更正或撤回。"],
    ["結束後 · 發布 closed-loop receipt", "逐項寫出已回答、待回答、未採納與下一輪入口。"],
  ],
};

export function normalizeState(value) {
  const state = {};
  for (const key of REQUIRED_KEYS) {
    const candidate = value?.[key];
    if (!candidate || !Object.hasOwn(OPTIONS[key], candidate)) return null;
    state[key] = candidate;
  }
  return state;
}

export function stateFromSearch(search) {
  const params = new URLSearchParams(search);
  return normalizeState(Object.fromEntries(REQUIRED_KEYS.map((key) => [key, params.get(key)])));
}

export function stateToSearch(state) {
  const normalized = normalizeState(state);
  if (!normalized) throw new Error("incomplete plan state");
  const params = new URLSearchParams();
  for (const key of REQUIRED_KEYS) params.set(key, normalized[key]);
  return params.toString();
}

export function scoreTool(tool, state) {
  let score = 0;
  const reasons = [];
  if (tool.goals?.includes(state.goal)) {
    score += 8;
    reasons.push(`符合「${OPTIONS.goal[state.goal]}」`);
  }
  if (tool.formats?.includes(state.format)) {
    score += 3;
    reasons.push(`適合${OPTIONS.format[state.format]}`);
  }
  if (tool.scales?.includes(state.scale)) score += 2;
  if (tool.privacy?.includes(state.privacy)) {
    score += 3;
    if (state.privacy !== "public") reasons.push(`支援${OPTIONS.privacy[state.privacy]}`);
  } else if (state.privacy === "sensitive") {
    score -= 8;
  }
  if (tool.outputs?.includes(state.output)) {
    score += 5;
    reasons.push(`能留下${OPTIONS.output[state.output]}`);
  }
  if (tool.status === "integrated") score += 2;
  if (tool.status === "adapter") score += 1;
  return { score, reasons };
}

export function recommendTools(tools, state, limit = 4) {
  const normalized = normalizeState(state);
  if (!normalized) throw new Error("incomplete plan state");
  return tools
    .map((tool) => ({ ...tool, match: scoreTool(tool, normalized) }))
    .filter((tool) => tool.match.score > 0)
    .sort((a, b) => b.match.score - a.match.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function buildPlan(state, tools) {
  const normalized = normalizeState(state);
  if (!normalized) throw new Error("incomplete plan state");
  const recommendations = recommendTools(tools, normalized);
  const offlineGears = (OFFLINE_GEARS[normalized.goal] || OFFLINE_GEARS.listen).map(
    ([title, description]) => ({ title, description }),
  );
  return {
    ...normalized,
    labels: Object.fromEntries(REQUIRED_KEYS.map((key) => [key, OPTIONS[key][normalized[key]]])),
    tools: recommendations,
    offlineGears,
    careChecks: [
      { name: "留意", prompt: "最靠近問題的人看見了什麼，還有誰沒有被聽見？" },
      { name: "負責", prompt: "誰有決策權，失敗時由誰回答？" },
      { name: "勝任", prompt: "工具、資料與主持方法如何被驗證？" },
      { name: "回應", prompt: "參與者如何更正、反對、申訴並要求修復？" },
      { name: "團結", prompt: "流程是否鼓勵跨差異合作，而不是平台綁定？" },
      { name: "共生", prompt: "工具權限是否有邊界、能關閉、會到期？" },
    ],
  };
}

export function buildBundle(plan, sourceUrl) {
  return {
    schema: "https://delib.mashbean.net/schemas/delib-bundle/v1.json",
    exportedAt: new Date().toISOString(),
    source: {
      generator: "Delib · 審議拼圖",
      url: sourceUrl,
      persisted: false,
    },
    request: {
      goal: plan.goal,
      format: plan.format,
      scale: plan.scale,
      privacy: plan.privacy,
      output: plan.output,
    },
    recipe: {
      offlineGears: plan.offlineGears,
      tools: plan.tools.map(({ id, name, url, status, summary, source }) => ({
        id,
        name,
        url,
        status,
        summary,
        source,
      })),
      careChecks: plan.careChecks,
    },
    dataCard: {
      containsParticipantData: false,
      containsFreeText: false,
      publicationStatus: "local-plan-only",
      limitations: [
        "工具推薦來自規則與公開資料，不代表工具維護者背書。",
        "這份流程不能取代在地招募、主持、知情同意與決策責任。",
        "AI 協作輸出若被使用，必須由人類複核並在成果頁揭露。",
      ],
    },
  };
}

export function buildMarkdown(plan, sourceUrl) {
  const tools = plan.tools
    .map((tool, index) => `${index + 1}. [${tool.name}](${tool.url}) — ${tool.summary}`)
    .join("\n");
  const gears = plan.offlineGears
    .map((gear, index) => `${index + 1}. **${gear.title}**：${gear.description}`)
    .join("\n");
  const checks = plan.careChecks.map((item) => `- **${item.name}**：${item.prompt}`).join("\n");
  return `# 審議拼圖執行手冊\n\n產生自：${sourceUrl}\n\n## 需求摘要\n\n- 目標：${plan.labels.goal}\n- 場域：${plan.labels.format}\n- 人數：${plan.labels.scale}\n- 資料：${plan.labels.privacy}\n- 成果：${plan.labels.output}\n\n## 線下齒輪\n\n${gears}\n\n## 線上工具\n\n${tools}\n\n## Civic AI care check\n\n${checks}\n\n## 成果收據至少要回答\n\n- 誰參與、誰缺席？\n- 使用了哪些原始資料與轉換？\n- 哪些內容是參與者原話、AI 整理、主持者判斷與正式決定？\n- 共識、歧見、少數聲音與尚未回答的問題各是什麼？\n- 下一步由誰在什麼時候完成？如何申訴、修正或終止？\n`;
}
