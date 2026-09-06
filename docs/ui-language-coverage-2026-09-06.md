# Native tool language coverage · 2026-09-06

本紀錄針對 12 個 upstream 工具的本機原始碼進行唯讀核查。新版 Delib 入口、流程、模擬案例、資料交接與工具外框提供中英文；工具內部的語言支援依各工具而異。這是原始碼查核結果，並非逐一驗證線上部署的完整翻譯覆蓋。

This read-only audit covers the local source of 12 upstream tools. The redesigned Delib hub, workflow, simulation, handoff, and station shell are bilingual. Language support inside each upstream tool varies. These findings describe source behavior, not a complete translation audit of every deployed page.

| Delib route | English interface / 英文介面 | Activation and limitation / 啟用方式與界線 |
| --- | --- | --- |
| `/polis` | Supported / 有支援 | English landing at `/en`; interactive pages read `?lang=en`, with saved preference and browser-language fallback. The station's `/en` mapping is appropriate. / 英文首頁使用 `/en`；互動頁面讀取 `?lang=en`，另有儲存偏好與瀏覽器語言判斷。 |
| `/call-in` | Supported / 有支援 | English landing at `/en/`. Event interfaces follow the event's `config.locale`; set `locale: "en"` when creating the event. A `?lang=en` station parameter does not change an existing event's locale. / 英文首頁使用 `/en/`；活動介面依建立時的 `locale: "en"` 設定，入口參數不能改變既有活動語言。 |
| `/form` | Chinese interface; English content option / 中文介面，可選英文內容 | Creation UI offers `language=en`; this affects form defaults/content, including the alias-field fallback. The interface does not read `?lang=en`. / 建立時可選英文，影響表單預設或內容；不會翻譯整個操作介面。 |
| `/harmonica` | Chinese interface; English output option / 中文介面，可選英文產出 | Creation UI sends `language=en` to the interview configuration/model instruction. It does not activate English interface text. / 設定影響訪談與模型輸出，操作介面未隨之翻譯。 |
| `/reply` | Chinese interface; English output option / 中文介面，可選英文產出 | Creation UI sends `language=en` to the reply pipeline. Status labels and other controls remain Chinese. / 設定影響回應產出，狀態與其他控制介面仍為中文。 |
| `/values` | Chinese interface; English output option / 中文介面，可選英文產出 | Creation UI sends `language=en` to dialogue instructions. Progress and error text remain Chinese. / 設定影響對話指令，進度與錯誤訊息仍為中文。 |
| `/tttc` | Chinese interface; English output option / 中文介面，可選英文產出 | Creation UI offers `language=en` for report generation. Report controls/status text do not switch with `?lang=en`. / 可選英文報告產出，報告控制與狀態文字不會隨入口參數切換。 |
| `/budget` | Chinese interface / 中文介面 | No English UI switch or language-query handling found in the inspected source. / 查閱的原始碼未提供英文介面切換或語言參數處理。 |
| `/checks` | Chinese interface / 中文介面 | No English UI switch or language-query handling found in the inspected source. / 查閱的原始碼未提供英文介面切換或語言參數處理。 |
| `/proposals` | Chinese interface / 中文介面 | No English UI switch or language-query handling found in the inspected source. / 查閱的原始碼未提供英文介面切換或語言參數處理。 |
| `/argument` | Chinese interface / 中文介面 | No English UI switch or language-query handling found in the inspected source. / 查閱的原始碼未提供英文介面切換或語言參數處理。 |
| `/maple` | Chinese interface / 中文介面 | No English UI switch or language-query handling found in the inspected source. / 查閱的原始碼未提供英文介面切換或語言參數處理。 |

## Delivery boundary / 交付界線

- The station uses `/en` for Polis, `/en/` for Call-in, and `?lang=en` for the other upstream destinations. The latter parameter does not translate those ten tools with their current source behavior. / 外框傳給其餘十個工具的 `?lang=en`，依目前原始碼不具介面翻譯效果。
- A content-language selector is distinct from interface localization. Do not describe all upstream tools as fully bilingual. / 內容語言選單與介面翻譯是兩項功能；不可將所有 upstream 工具描述為完整雙語。
- `/rank` is maintained inside Delib and is outside this 12-upstream audit. Its localization is tracked by the hub implementation. / `/rank` 屬 Delib 內建功能，不在本表的十二個 upstream 查核範圍內。
- No upstream app was changed by this audit. / 本次查核未修改任何 upstream 工具。

## Source evidence / 原始碼依據

All paths below are relative to `/Users/mashbean/Developer/repos/`. / 下列路徑相對於工作區的 `repos/`。

- **Polis:** `pocket-polis/src/index.ts` (`/en` routing); `pocket-polis/public/js/i18n.js` (`currentLang`, `applyI18n`, `mountLangSwitch`); `public/en.html` and `public/guide-en.html`.
- **Call-in:** `call-in/src/index.ts` (`normalizeHostedLocale`, event creation, localized demo API); `call-in/public/i18n.js` (`createLocale`); `public/new/new.js` and `public/present/present.js`. The standalone PDF viewer's `lang` parameter does not establish query-based localization for the whole event.
- **Form:** `pocket-form/public/index.html`, `public/app.js`, `public/form.js`, and `src/schema.ts`.
- **Harmonica:** `pocket-harmonica/public/index.html`, `public/app.js`, and `src/interview.ts`.
- **Reply:** `pocket-reply/public/index.html`, `public/app.js`, `public/receipt.js`, `src/index.ts`, and `src/pipeline.ts`.
- **Values:** `pocket-values/public/index.html`, `public/app.js`, session UI, and `src/dialogue.ts`.
- **TTTC:** `tttc-serverless/public/index.html`, `public/app.js`, `public/report.js`, `public/canvas.js`, and `src/index.ts`.
- **Budget, Check, Proposals, Argument, Maple:** respective `pocket-budget`, `pocket-check`, `pocket-proposals`, `pocket-argument`, and `pocket-maple` repositories' public HTML/JavaScript and `src/index.ts`.

This conclusion is frozen for this delivery; future upstream localization should trigger a fresh audit. / 本結論固定於本次交付，日後工具更新翻譯時應重新查核。
