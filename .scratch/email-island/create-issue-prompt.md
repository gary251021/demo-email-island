# 在 Herdr issue pane 建立指定票券

將下方 `{票券編號}` 替換為 1–12，再交給 Codex 執行。票券定義見同目錄的 [tickets.md](tickets.md)，因此新對話也可使用。

```text
請在 Herdr 右側開啟獨立 Codex issue pane，使用專案的
.agents/skills/project-create-issue/SKILL.md，細化並建立
.scratch/email-island/tickets.md 中第 {票券編號} 張票。

先讀取 AGENTS.md、general-workflow 路由技能、project-create-issue
技能及其要求的 tracker／delivery guidance。
讀取 tickets.md 的共同約束、指定票券、依賴及待定事項，並查閱
project.md 與 reference/email-island/README.md。
若保存的修正與舊規格不同，明確保留 tickets.md 記錄的使用者修正。

若已有該票的 issue pane 或 issue 草稿，沿用既有任務與 checkpoint。
否則建立新任務，將上述來源位置與指定票券的完整標題、Blocked by、
交付範圍交接給它，讓新 pane 能在沒有本對話歷史的情況下繼續。
新 pane 負責該票的提案、調查、對齊、驗收條件與 issue 草稿，
遵循技能的 checkpoint 與確認流程，使用繁體中文。
先提出具體預設供我修正，沿用已確認決定，將待定提案清楚標示。

本次只建立一張 issue，不實作功能。保留其他工作者的修改。
完整草稿經我確認後，才依專案設定發布到本地 tracker，
讀回驗證並提供檔案連結。維持 tickets.md 的票券編號與依賴對應；
若 tracker 中已有相同編號或範圍，先核對，避免重複建立或覆寫。

若工具無法指定右側位置，如實說明並提供新任務名稱。
若找不到指定票券定義，先索取內容，不自行猜測。
```
