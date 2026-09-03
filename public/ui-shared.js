// Shared browser helpers for every Delib page. No framework, no build step.
// Storage access is wrapped because Safari private mode, blocked cookies and
// some embedded browsers throw on the first touch of sessionStorage.

export function storageGet(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function storageRemove(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

export function storageGetJson(key) {
  const raw = storageGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    storageRemove(key);
    return null;
  }
}

/**
 * Copy text and report the outcome. When the clipboard is blocked, the value is
 * shown in `fallbackInput` (a readonly input) and selected so a person can copy
 * it by hand instead of reading a dead-end message.
 */
export async function copyText(value, statusElement, message, fallbackInput = null) {
  try {
    await navigator.clipboard.writeText(value);
    if (statusElement) statusElement.textContent = message;
    return true;
  } catch {
    if (fallbackInput) {
      fallbackInput.hidden = false;
      fallbackInput.value = value;
      fallbackInput.focus();
      fallbackInput.select();
    }
    if (statusElement) {
      statusElement.textContent = fallbackInput
        ? "瀏覽器沒有開放自動複製；網址已幫你選取，按 Ctrl+C 或 ⌘C 複製。"
        : "瀏覽器沒有開放自動複製；請手動選取並複製。";
    }
    return false;
  }
}

export function downloadFile(filename, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type: `${type};charset=utf-8` }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Firefox and Safari can abort the download if the URL is revoked synchronously.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function formatDateTime(value, options = { dateStyle: "long", timeStyle: "short" }) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "時間未知";
  return new Intl.DateTimeFormat("zh-Hant-TW", options).format(parsed);
}

export async function postJson(url, body, extraHeaders = {}) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("目前連不上 Delib 伺服器；請確認網路後再試一次。");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("工具回應不完整，這不是你的輸入問題；稍後再試一次。");
  }
  if (!response.ok) throw new Error(data.error || "工具暫時沒有完成；稍後再試一次。");
  return data;
}

export function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
