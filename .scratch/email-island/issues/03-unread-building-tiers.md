# UI: 未讀封數驅動四級建築

Status: needs-triage
Progress: open
Blocked by: 01

## For Human

群島上的主建築顯示整個領域的未讀積壓；進入板塊後，各建築顯示該子分類的積壓。兩層都以郵件封數計算：1–2 封為 Lv.1、3–9 封為 Lv.2、10–29 封為 Lv.3、30 封以上為 Lv.4。數字圓片顯示實際封數。

讀信後，兩層的數字與建築同步更新。例如 30 封減至 29 封時，建築由 Lv.4 變成 Lv.3。讀到零仍保留可點擊地基，可以進入分類重讀郵件。升降級保留分類位置，各領域沿自己的建築造型增加或減少結構。

建築由已保存的未讀資料推導，不另外保存等級。回覆、封存、屋頂狀態、時間軸、批次處理及回放由後續票負責。

## Verification (E2E)

以下為交付時須實作的自動化測試規格，本次 issue 建立沒有執行應用測試。

- **AC-1 兩層共用未讀門檻**
  - **Given:** 隔離測試信箱依案例配置 0、1、2、3、9、10、29、30、31 封未讀；同一分類中包括主旨相同的多封郵件。
  - **When:** 使用者查看群島，再進入各測試板塊。
  - **Then:** 主建築與子分類建築均顯示對應的實際封數及地基／Lv.1／Lv.2／Lv.3／Lv.4 可存取名稱；同主旨多封信逐封計算。領域總數為子分類封數總和，不是子分類等級之和。
- **AC-2 讀信跨級與兩層同步**
  - **Given:** 分別以 30、10、3、1 封未讀建立測試子分類，同領域其他子分類為零；另有一例其他子分類仍有未讀。
  - **When:** 點子分類、開啟一封未讀郵件，返回板塊及群島，再重開同一封信。
  - **Then:** 已讀保存及總覽更新完成後，子分類數字分別變成 29、9、2、0，建築對應降級或變地基；領域總數也減一並按自己的總數判定等級。重讀不再次扣數。更新不需手動重新整理。
- **AC-3 零未讀保留入口**
  - **Given:** 一個領域未讀總數為零，其中包含有已讀信的子分類及空子分類。
  - **When:** 分別用滑鼠與鍵盤啟動群島地基及子分類標籤。
  - **Then:** 群島地基可進入板塊；有已讀信的子分類可打開列表及內文；空子分類顯示空列表。地基顯示未讀 0 封，不標作 Lv.0。
- **AC-4 持久資料與使用者隔離**
  - **Given:** A、B 為兩個隔離瀏覽器 context，擁有相同初始郵件，各自有 30 封未讀。
  - **When:** A 讀一封後重新整理，並以保存的瀏覽器身分重開；B 查看相同分類。
  - **Then:** A 顯示 29 封及 Lv.3；B 保持 30 封及 Lv.4。身分失效後畫面不能沿用前一身分的建築總覽。
- **AC-5 確切圓片、穩定位置及焦點**
  - **Given:** 分類封數涵蓋 0、1、30、100；其中一個分類即將降級。
  - **When:** 使用者查看圓片，透過鍵盤開信使分類降級，再關閉郵件卡。
  - **Then:** 圓片完整顯示 0、1、30、100，沒有 2–12 限制、概率點或 99+ 截斷。焦點回到原分類標籤，位置及導航目的地保持一致；點模型與標籤開啟相同分類。
- **AC-6 寫入或重新取得總覽失敗**
  - **Given:** 瀏覽器測試分別模擬已讀 mutation 的網路失敗，以及 mutation 成功後 overview 請求失敗。
  - **When:** 使用者讀信，查看錯誤並重試。
  - **Then:** 失敗不把未讀數變成 0 或假裝已更新；保留可讀內文與上一份建築，顯示失敗／未更新提示。恢復後兩層採用同一最新總覽，只計一次已讀。
- **AC-7 八領域結構與可讀性 (manual)**
  - **Given:** 同一相機、光線與世界尺度的八領域地基及四級對照圖，以及 16:9 群島／板塊畫面。
  - **When:** 檢視各級造型及實際棋盤大小，開啟讀信卡。
  - **Then:** 每個家族有可辨識的結構成長，並非只放大同一模型；標籤、圓片、地形與互動目標沒有被建築遮蔽。材質及構圖符合視覺指南。
  - **人工原因:** 家族輪廓與桌遊視覺品質需要人工判斷；互動、封數與名稱另由 AC-1 至 AC-6 自動驗證。

<details>
<summary>For Agent</summary>

### Objective

讓兩層棋盤以目前使用者的未讀郵件封數，呈現一致、可導航且保留位置的四級建築及地基。

### Code architecture

Source ref/SHA: `demo` `3e865e109dfa5f1bf97a28d717b011c894a88605`

#### Approach

目前基線只有 `src/routes/index.tsx#Home` 的標題及 `src/router.tsx#getRouter` 路由骨架，沒有 mailbox、island 或 building 的實作。01 提供 mailbox 授權、未讀總覽及 island 兩層導航。本票新增 building，接收未讀數並推導外形，保留 01 的場景與資料 ownership。

路徑、模組責任、公開介面及依賴方向為設計邊界；私有 family 元件如何拆檔可由實作者決定。01 落地後先核對實際 exported types、overview 與 mutation 行為；重大契約差異須回到設計確認，不能加入猜測 fallback。

#### Libraries

不新增套件，使用已安裝能力。

| Package | Version | Owns | Rejected alternative |
| --- | --- | --- | --- |
| react | 19.3.1 | 元件與現有 UI | 不另建 UI framework |
| @react-three/fiber | 9.8.2 | 宣告式場景、mesh、事件 | 不重寫 renderer 或 raycaster |
| three | 0.187.0 | 幾何與材質 | 使用既有 primitives 組合家族，無自製幾何引擎 |
| @react-three/drei | 10.7.9 | Html 場景標籤定位 | 不自行寫 world-to-screen 投影及 DOM 同步 |
| @tanstack/react-query | 5.105.3 | 沿用 01 的 owner 分區快取 | 不新增 tier store 或另一份未讀快取 |

依據為本地 package manifests、Fiber ThreeElements declarations，以及官方 [Fiber objects](https://r3f.docs.pmnd.rs/api/objects)、[Drei Html](https://drei.docs.pmnd.rs/misc/html) 文件。以上支持現成能力選擇，未代表本專案整合已執行。

#### Modules and layers

| Module | Routing | UI view | UI model | Service | Data access | Integration |
| --- | --- | --- | --- | --- | --- | --- |
| building，新 | 無 | `src/features/building/Building.tsx` 輸出模型／地基與可聚焦標籤；私有 `BuildingFamily.tsx`、`UnreadToken.tsx` | `src/features/building/buildingTier.ts` 的純等級判斷 | 無 | 無 | 無 |
| island，接續 01 | 沿用既有兩層導航，無新 route | `src/features/island/IslandScene.tsx` 組合 Building，持有位置與導航 | 使用同一 overview，沿用選取狀態 | 無 | 無 | 無 |
| mailbox，沿用 01 | 無新增 | 沿用讀信卡 | 沿用成功讀信後重取總覽的流程 | 沿用授權及已讀更新 | 沿用 owner-scoped 未讀彙總 | 無 |

building 公開 `Building` 及 `getBuildingTier`，geometry/token 為私有。依賴為 island → building、island → mailbox；building 只引用 mailbox 的共享 DomainId 型別，不呼叫其 API。mailbox 不依賴 building。沒有新資料表、API、認證或模型呼叫。

#### Data and contracts

以下為設計介面，未當作可執行 proof。DomainId 由 01 的跨邊界 Zod schema 推導，不能重寫另一份領域清單。

```ts
import type { DomainId } from '../../lib/mailbox';
type BuildingTier = 1 | 2 | 3 | 4;
// null 僅表示零未讀的地基。
declare function getBuildingTier(unreadCount: number): BuildingTier | null;
type BuildingProps = {
  domainId: DomainId;
  label: string;
  unreadCount: number;
  onOpen: () => void;
};
```

輸入 unreadCount 是非負整數，來自 01 的 overview。領域總數為該 owner 各子分類的未讀郵件封數加總。tier 不持久保存；readAt、thread 數、回覆狀態、來信頻率各有自己的語意，不能互為 fallback。資料缺失或請求失敗維持 loading/error，不使用 0 代替。

island 以穩定 domainId／subcategoryId 作 React key、位置與選取識別，不以 tier 作 key。外層 group 持有位置 transform；building 僅切換結構。所有正封數按 1–2、3–9、10–29、30+ 判斷；0 回傳地基，地基沿用原分類的 onOpen。

#### Appearance and interaction

全螢幕低多邊形桌遊構圖沿用 `reference/email-island/README.md`。生成參考圖只提供造型與材質方向，圖中的 threads、20+、道路、船及騎士不定義本票功能。

| 領域 | Lv.1 | Lv.2 | Lv.3 | Lv.4 |
| --- | --- | --- | --- | --- |
| 團隊 | 木棚與公告牌 | 木屋 | 雙翼會堂與鐘亭 | 多翼大型公會堂 |
| 核心專案 | 石工棚與路牌 | 石造工作坊 | 多翼石城與方塔 | 多塔大型石造建築群 |
| 電子報 | 小圓風車 | 圓風車與附屋 | 風車與鋸齒頂印刷廳 | 多棟印刷廳與高風車 |
| 財務 | 小型拱頂庫房 | 桶拱金庫 | 圓頂財庫與側翼 | 中央大圓頂與多翼財庫 |
| 系統通知 | 訊號支架 | 支架與磚棚 | 通訊塔與機房 | 高塔與多棟磚造機房 |
| 社交活動 | 單頂小帳篷 | 帳篷與平台 | 相連篷頂與聚會平台 | 多組篷頂與大型平台 |
| 低優先 | 砂岩分揀棚 | 低矮分揀屋 | 多翼貨棚 | 大型分揀倉群 |
| 購物物流 | 貨物棚 | 碼頭小貨倉 | 雙貨倉與裝卸架 | 多倉物流棧與高裝卸架 |

升級增加佔地、高度及屋頂結構，不只縮放同一 mesh。Lv.4 是積壓體量，保持各領域家族。低優先家族延續砂岩與平頂；本票不使用防禦城牆，以免混淆 08 的處理狀態。港口家族依本票補足四級方向。

圓片使用中性色及確切數字，取消舊規格 2–12 限制與概率點，不以紅色暗示重要性或待回覆。100 以上亦完整顯示。視覺標籤只命名分類／動作，沒有 demo、測試或建置說明。可存取名稱包含分類、封數與等級，例如「Q4 報價，未讀 30 封，Lv. 4」及「Q4 報價，未讀 0 封，地基」。模型點擊與 HTML 按鈕使用同一 onOpen；關閉讀信卡恢復分類標籤焦點。

本票直接切換結構，沒有升級慶祝或回放動畫。地基可以開啟已讀列表或空列表，不刪除分類與位置。

#### Data flow

1. 點模型或標籤，由 island 既有導航進板塊或郵件卡。
2. mailbox 成功呈現內文後，沿 01 的 markMailRead 驗證 session 與資源 owner，再保存已讀。
3. mailbox 重取 owner 分區的 overview；island 同次採用其中領域與子分類的數量。
4. building 推導 tier，更新模型、圓片及可存取名稱。返回隱藏層時亦使用這份最新 overview。

不在各畫面自行減一。寫入失敗保留舊建築並沿用錯誤重試；寫入成功但 overview 失敗時標明尚未更新，成功重試才換成最新資料。session 改變時清除舊 owner 快取，避免顯示另一人的總覽，該機制由 01 擁有。

#### Prefactoring

01 完成後，將 IslandScene 的固定建築呈現抽入 building，保留相機、場景、位置與導航 ownership。目前 skeleton 沒有相應程式可抽取，issue 建立不修改程式碼。

#### Foundations for later tickets

04 延伸屋頂及 Lv.1 快速封存；05 使用同一 tier 規則判定 Lv.3 時間軸；11 使用該規則判定回放中的級別變化並自行保存歷史。06 的分拆與批次處理仍依賴 02、04。本票不新增這些功能的空模組或預備欄位。

#### Testing seams

交付時使用 01 的 Playwright 啟動、隔離 session 與資料 fixture。測試檔 `src/features/building/building.e2e.ts`；不另建第二套測試 config，不修改使用者已匯入資料。

| AC | Planned test name |
| --- | --- |
| AC-1 | both layers derive tiers from unread email counts |
| AC-2 | reading crosses every tier boundary once |
| AC-3 | zero foundations remain navigable |
| AC-4 | counts survive reload and remain owner scoped |
| AC-5 | exact tokens and stable placement |
| AC-6 | failed reads and overview refreshes preserve truthful counts |
| AC-7 | 人工檢視同尺度家族圖及棋盤截圖 |

AC-1 至 AC-5 使用實際 UI、route、server functions、授權及隔離資料庫，不 mock tier 或 overview 結果。AC-6 僅攔截指定網路失敗，恢復後走真實請求。沒有外部模型邊界。必要單元測試只補門檻及 null 地基語意；影像差異不能替代 AC-7 的人工家族辨識。

### Constraints and exceptions

建立 issue 僅做文件與靜態示意。尚未測試的整合事項留到交付：01 overview 接線、相同資料快取更新、升降級後焦點及錨點、Drei Html 遮擋與 16:9 可讀性。驗證須觀察 AC 指定結果，不把介面片段或靜態圖當成已通過的執行證據。

### Dependencies and delivery

直接阻擋票為 01。它負責使用者隔離、持久郵件、兩層導航、未讀總覽及讀信更新。本票不依賴 02、BullMQ 或分類模型；上游認證選型由 01 擁有，building 僅消費已授權總覽。

交付基線依政策取當時最新本地 demo tip；上述 SHA 是本次設計調查基線。01 的實際整合 SHA 在交付時記錄並核對相關契約。本地 tracker 路徑為 `.scratch/email-island/issues/03-unread-building-tiers.md`；本次預覽沒有遠端發布或實作授權。

</details>

## Comments

- 本票確定數字圓片顯示實際未讀封數，取代舊功能規格中 2–12 與流量語意的歧義。
