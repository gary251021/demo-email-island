# Email Island map

## Notes

本頁只記錄 ticket 1 的本地交付結果；完整功能契約保留於各 issue。Tracker 使用 `.scratch/email-island/issues/`，執行狀態與 triage 狀態分開記錄。

## Decisions-so-far

- [01 群島入口、使用者隔離與基本讀信流程](issues/01-demo-entry-isolated-mail-reading.md) 已在 `feat/01-isolated-mail-reading@3614cbecf74b797e3939d23de246c6b4bab8efb8` 交付。AC-1 至 AC-13、完整 E2E 及兩軸獨立審查通過；完整證據與 preview 連結保留於該票的 Answer。來源分支已依後續明確授權推送至使用者手動設定並批准的 GitHub remote，exact-SHA readback 通過；未 merge、建立 PR 或部署。
- 同票的登入／登出導航追加交付已完成，最終 feature／remote HEAD 為 `d535d332b19d8c0683f69381bba066a309aefd4b`。完整 16 項 E2E、導航兩輪獨立審查與 mutation 通過；沿用先前同一分支／目的地授權 fast-forward 推送並完成 readback。原 3614 結果保留為歷史，最終證據見該票 Answer 的導航連結。

## Fog

- 後續分類、建築升級、道路與時間光影等票券未由 ticket 1 實作。
- 範圍過廣的 tooling 測試有失敗，尚無 baseline 比較，來源未確定；本次應用驗收與檢查的實際範圍見 ticket 1 Answer。
- 來源分支的後續 remote 發布已獲批准並完成；PR、merge 與部署未執行。
