const RECEIPT_PATH = /^\/r\/([a-f0-9]{16})$/;
const RETENTION_DAYS = new Set([30, 365, 1095]);

export function receiptSlugFromPath(pathname = location.pathname) {
  return String(pathname).match(RECEIPT_PATH)?.[1] || "";
}

export function receiptDeleteTokenFromHash(hash = location.hash) {
  const token = new URLSearchParams(String(hash).replace(/^#/, "")).get("delete") || "";
  return /^[a-f0-9]{64}$/.test(token) ? token : "";
}

export class StoredReceiptError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "StoredReceiptError";
    this.status = status;
  }
}

/**
 * Load a receipt published under /r/<slug>. Returns null when the page is not
 * a short URL; throws StoredReceiptError with a person-readable message when
 * the short URL exists but cannot be shown (expired, deleted, offline).
 */
export async function loadStoredReceipt(normalize, expectedKind) {
  const slug = receiptSlugFromPath();
  if (!slug) return null;
  let response;
  try {
    response = await fetch(`/api/receipts/${slug}`, { headers: { Accept: "application/json" } });
  } catch {
    throw new StoredReceiptError("目前連不上 Delib 伺服器；請確認網路後重新整理。", 0);
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (response.status === 410) throw new StoredReceiptError("這份公開成果已到期，內容已依承諾清除。", 410);
  if (response.status === 404) throw new StoredReceiptError("找不到這份公開成果；它可能已被主辦者刪除，或網址抄錯了。", 404);
  if (!response.ok || !payload) throw new StoredReceiptError("公開成果暫時無法讀取，請稍後再試。", response.status);
  if (payload.status === "deleted") throw new StoredReceiptError("這份公開成果已由主辦者刪除。", 200);
  const receipt = payload.kind === expectedKind ? normalize(payload.receipt) : null;
  if (!receipt) throw new StoredReceiptError("這個短網址指向的成果格式與這個頁面不符。", 200);
  return {
    receipt,
    createdAt: Number(payload.createdAt),
    expiresAt: Number(payload.expiresAt),
    publicUrl: `${location.origin}/r/${slug}`,
  };
}

export async function publishReceipt(receipt, retentionDays) {
  const days = Number(retentionDays);
  if (!RETENTION_DAYS.has(days)) throw new Error("請選擇保存期限");
  const response = await fetch("/api/receipts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ receipt, retentionDays: days, confirmed: true }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "短網址建立失敗，請稍後再試");
  return payload;
}

export async function deleteStoredReceipt() {
  const slug = receiptSlugFromPath();
  const token = receiptDeleteTokenFromHash();
  if (!slug || !token) throw new Error("這個網址沒有私人刪除權杖");
  const response = await fetch(`/api/receipts/${slug}`, {
    method: "DELETE",
    headers: { "X-Receipt-Admin": token, Accept: "application/json" },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "成果刪除失敗，請稍後再試");
  return payload;
}

export function bindPublicationControls({ receipt, stored, prefix, status }) {
  const panel = document.querySelector(`#${prefix}-publication`);
  const publish = document.querySelector(`#${prefix}-publish`);
  const confirmation = document.querySelector(`#${prefix}-publish-confirm`);
  const retention = document.querySelector(`#${prefix}-retention`);
  const result = document.querySelector(`#${prefix}-publication-result`);
  const publicUrl = document.querySelector(`#${prefix}-public-url`);
  const manageUrl = document.querySelector(`#${prefix}-manage-url`);
  const copyPublic = document.querySelector(`#${prefix}-copy-public`);
  const copyManage = document.querySelector(`#${prefix}-copy-manage`);
  const remove = document.querySelector(`#${prefix}-delete`);
  const stamp = document.querySelector(`#${prefix}-storage-stamp`);

  if (stored) {
    panel.querySelector("[data-publication-create]").hidden = true;
    result.hidden = false;
    publicUrl.value = stored.publicUrl;
    const hasDeleteToken = Boolean(receiptDeleteTokenFromHash());
    manageUrl.closest("label").hidden = !hasDeleteToken;
    copyManage.hidden = !hasDeleteToken;
    if (hasDeleteToken) manageUrl.value = location.href;
    remove.hidden = !hasDeleteToken;
    stamp.textContent = `公開摘要保存至 ${formatDate(stored.expiresAt)}`;
  }

  publish.addEventListener("click", async () => {
    if (!confirmation.checked) {
      status.textContent = "請先確認公開範圍。";
      confirmation.focus();
      return;
    }
    publish.disabled = true;
    status.textContent = "正在建立短網址…";
    try {
      const created = await publishReceipt(receipt, retention.value);
      result.hidden = false;
      publicUrl.value = created.publicUrl;
      manageUrl.value = created.manageUrl;
      manageUrl.closest("label").hidden = false;
      remove.hidden = true;
      status.textContent = "短網址已建立。請另外保存私人刪除網址；Delib 無法替你找回。";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "短網址建立失敗。";
    } finally {
      publish.disabled = false;
    }
  });

  copyPublic.addEventListener("click", () => copyValue(publicUrl, status, "公開短網址已複製。"));
  copyManage.addEventListener("click", () => copyValue(manageUrl, status, "私人刪除網址已複製，請妥善保存。"));
  remove.addEventListener("click", async () => {
    remove.disabled = true;
    status.textContent = "正在刪除公開成果…";
    try {
      await deleteStoredReceipt();
      status.textContent = "公開成果與到期排程已刪除；這個短網址不再可用。";
      result.hidden = true;
      stamp.textContent = "公開摘要已刪除";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "成果刪除失敗。";
      remove.disabled = false;
    }
  });
}

async function copyValue(input, status, message) {
  if (!input.value) return;
  try {
    await navigator.clipboard.writeText(input.value);
    status.textContent = message;
  } catch {
    input.select();
    status.textContent = "瀏覽器未允許自動複製；網址已選取。";
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-Hant-TW", { dateStyle: "long" }).format(new Date(value));
}
