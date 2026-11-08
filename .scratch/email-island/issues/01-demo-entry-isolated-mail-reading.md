# UI / Privacy: 群島入口、使用者隔離與基本讀信流程

Status: needs-triage
Progress: resolved
Blocked by: None

## For Human

點「進入群島」即可擁有獨立保存的模擬郵件。入口保留灰色停用的「Google 登入」。從八個領域進入子分類，打開郵件列表及內文，再返回群島。例如閱讀「Q4 報價」的一封未讀郵件後，列表、子分類與領域的未讀數同步更新。

同一瀏覽器重新整理或重開會保留資料，其他瀏覽器各自獨立。身分有效期為 365 日，使用時按每日間隔續期；到期或清除瀏覽器憑證後，再次進入會建立新身分，舊資料保留但不提供復原或跨裝置登入。

本票使用預設分類與固定代表建築。自動分類、建築升級、回覆、封存及道路操作由後續票券處理。

## Verification (E2E)

以下為交付時須實作及執行的驗收，建立 issue 時不撰寫測試或應用程式。

- **AC-1 入口與首次進入**
  - **Given:** 沒有有效身分的新瀏覽器。
  - **When:** 開啟首頁，檢視「Google 登入」，再點「進入群島」。
  - **Then:** Google 按鈕為 disabled；不發出 OAuth 或真實郵箱請求。群島顯示核心專案、團隊溝通、電子報、財務帳單、系統通知、社交活動、網購物流、低優先郵件八個領域，各自有可閱讀的預設分類郵件。

- **AC-2 重複進入保留資料**
  - **Given:** 已進入群島並讀過一封郵件的有效身分。
  - **When:** 重新整理、再次開啟首頁，並對同一 session 重複呼叫初始化請求。
  - **Then:** 回到既有信箱；郵件識別、列表數量與已讀狀態維持，沒有重複匯入或重設。

- **AC-3 兩層導航與讀信**
  - **Given:** 核心專案有「Q4 報價」及「設計審批」子分類，Q4 報價包含「請確認報價項目」。
  - **When:** 選核心專案、Q4 報價、該郵件，依序返回列表、關閉卡片、返回群島；並逐一進入其餘領域。
  - **Then:** 列表與內文屬於所選子分類，標題與寄件人可見；返回後維持正確選取範圍。3D 只有群島與板塊兩層，讀信使用右側卡片。

- **AC-4 未讀同步且只計一次**
  - **Given:** Q4 報價有 3 封未讀，設計審批有 1 封未讀，核心專案合計 4 封。
  - **When:** 載入列表或 hover 郵件，再顯示其中一封未讀的完整內文；等待保存完成後返回，並再次開同一封信。
  - **Then:** 載入與 hover 不改未讀。成功讀信後 Q4 報價為 2、核心專案為 3、設計審批仍為 1，該列不再顯示未讀。重複開啟不再扣減。

- **AC-5 零未讀仍可閱讀**
  - **Given:** 設計審批只有 1 封未讀。
  - **When:** 讀完它，再返回板塊並重新開啟該子分類。
  - **Then:** 標籤顯示未讀 0，該位置與導航仍保留；使用者可繼續查看已讀郵件。

- **AC-6 跨重新啟動保存**
  - **Given:** 使用者已保存已讀狀態，瀏覽器仍持有有效憑證。
  - **When:** 重新整理；關閉並以同一持久憑證重開瀏覽器；以同一資料檔重新啟動應用伺服器。
  - **Then:** 每次開啟都看到相同郵件與已讀狀態，不再次匯入。

- **AC-7 兩位使用者與直接資源隔離**
  - **Given:** A、B 使用獨立 browser contexts，各自進入群島並取得自己的郵件與子分類 ID。
  - **When:** A 讀取自己的郵件，再帶 A 憑證直接請求 B 的列表、內文及標為已讀操作。
  - **Then:** A 的操作只更新 A；B 的未讀與內容維持原狀。跨使用者請求回 NOT_FOUND，回應不包含 B 的郵件內容；B 可正常閱讀自己的郵件。

- **AC-8 無身分與錯誤歸屬**
  - **Given:** 一個沒有有效憑證的 context，以及一個有身分但使用錯誤 domain/subcategory/mail 組合的 context。
  - **When:** 直接呼叫讀取及修改資源；另提交包含 owner_id 的輸入。
  - **Then:** 無身分回 UNAUTHENTICATED，UI 返回入口。錯誤歸屬回 NOT_FOUND；owner_id 輸入被驗證拒絕。畫面不替換成另一封郵件，回應不洩漏他人內容。

- **AC-9 每日續期**
  - **Given:** 同一身分的 365 日 session 尚有效，距上次更新已超過一日；測試可控制伺服器時間。
  - **When:** 重新開啟群島，經真實 client SDK 讀取 session 並完成 POST 續期；其後將時間推進至原到期日之後、續期後到期日之前。
  - **Then:** POST 續期成功；仍能存取原身分及原有已讀狀態，不出現新信箱。

- **AC-10 到期或清除憑證**
  - **Given:** 一個超過 365 日未續期的身分；另一個手動清除 cookie 的瀏覽器。
  - **When:** 各自回到入口並點「進入群島」。
  - **Then:** 各自建立新的匿名身分與初始信箱。舊 ID 不可用新身分存取；沒有找回帳號、重設或跨裝置登入介面。

- **AC-11 儲存失敗與重試**
  - **Given:** 隔離測試儲存層可造成一次初始化交易失敗，或一次標為已讀寫入失敗。
  - **When:** 進入群島或讀信遇到該失敗，再透過畫面「重試」。
  - **Then:** 初始化失敗不進入半份信箱，重試成功後每封 seed 郵件只出現一次。已讀寫入失敗仍可閱讀內文，畫面顯示保存失敗與重試；成功後才更新未讀，重試不重複扣減。

- **AC-12 鍵盤與棋盤互動**
  - **Given:** 16:9 畫面的群島與板塊，標籤可聚焦。
  - **When:** 分別使用 pointer 點建築與鍵盤啟用對應標籤，開啟並關閉郵件卡。
  - **Then:** 兩種操作進入同一領域或子分類；卡片有可辨識的 dialog 名稱。關閉後焦點回到原子分類標籤；沒有固定側邊欄、頂部導航或底部工具列。

- **AC-13 模型與視覺品質 (manual)**
  - **Given:** 相同相機、光線與世界比例的八領域模型對照圖，以及群島、板塊與讀信卡截圖。
  - **When:** 審閱者隱藏標籤比較輪廓，再對照視覺規格與參考圖檢視實際尺寸。
  - **Then:** 各領域依其建築家族可辨識；材質、留白與比例符合規格，模型沒有穿模或遮住操作標籤。記錄具體問題及修正結果。人工判斷造型與桌遊質感，不能以逐像素相同或自動截圖存在代替。

<details>
<summary>For Agent</summary>

### Objective

交付每個匿名使用者獨立保存的 mock 信箱，完成入口、八領域兩層導航、逐封閱讀與未讀更新，並在伺服器驗證所有資源讀寫歸屬。

### Code architecture

Source ref/SHA: `demo` `3e865e109dfa5f1bf97a28d717b011c894a88605`。

此 SHA 是需求調查基線。現況只有 `src/routes/index.tsx#Home` 佔位頁、`src/routes/__root.tsx#RootShell`、`src/router.tsx#getRouter` 與 Tailwind import。郵件、session、資料庫與 3D 場景為 greenfield。交付須以屆時最新本地 `demo` tip 為基線，若相關來源改變須重新核對。

以下為設計契約與未執行的介面示意，不聲稱已實作或通過整合測試。套件、模組歸屬、公開契約及依賴方向為約定；模組內私有 helper 名稱與細部分檔可依責任調整。

#### Approach

沿用 TanStack Start、React Query、React Three Fiber 與 Three。Better Auth 負責匿名身分與續期；應用從驗證後的 user.id 取得 owner，再對 SQLite 的 mailbox 資料做歸屬查詢。React Query 管理各使用者的查詢結果；島嶼只呈現 mailbox 的資料，不自行保存另一份未讀數。郵件內文使用純文字。本票不呼叫 Jev、OAuth 或真實郵箱。

#### Libraries

| Package / runtime | Version | Owns | Rejected alternative |
| --- | --- | --- | --- |
| Node `node:sqlite` | Node 26.10.0 的 `DatabaseSync` | 持久檔、交易、foreign keys、參數化查詢 | better-sqlite3 額外引入 native addon；採官方支援的現有 driver，保留 RC 風險 |
| `better-auth` | 新增，精確 pin 1.7.18 | anonymous、anonymousClient、Start handler、cookie 與續期 | 手寫 token/session 機制沒有已證實的必要缺口 |
| `auth` | 新增 devDependency，精確 pin 1.7.18 | 官方 CLI 產生初始 auth SQL schema | 不維護第二份手寫 auth table schema |
| `@playwright/test` | 新增 devDependency，精確 pin 1.65.0 | 真實 browser contexts 與 app E2E | 單靠 Vitest/jsdom 無法涵蓋真實 cookie、transport 與 WebGL |
| `@tanstack/react-start` / `react` | 沿用 1.169.4 / 19.3.1 | server functions、routing、UI | 不另建 REST transport |
| `@tanstack/react-query` / `zod` | 沿用 5.105.3 / 4.6.7 | owner 分區 cache、輸入 schema | 不另建 client store 或 validator |
| `@react-three/fiber` / `@react-three/drei` / `three` | 沿用 9.8.2 / 10.7.9 / 0.187.0 | 棋盤與 HTML 標籤定位 | 不另行模擬整套 3D renderer |

Auth packages 的 MIT license、匿名功能、Node SQLite adapter、UUID 與 Start 整合已有文件依據；本專案的完整組合仍須在交付驗證。Node SQLite API 在此版本屬 release candidate。固定 `.node-version`，執行測試與建置時須核對實際 Node，不能依不同目錄下的 shell 預設推定版本。

#### Modules and layers

表內 feature 路徑前綴為 `src/features/`。不建立純 re-export barrel；其他模組只能使用明確公開的能力。

| Module | Routing | UI view | UI model | Service | Data access / integration |
| --- | --- | --- | --- | --- | --- |
| session | `/api/auth/$` 委派官方 handler；`/` 與 `/island` 檢查身分 | 無獨立產品畫面 | `session/auth-client.ts` 提供 SDK；在 island route 掛載 SDK session 訂閱以觸發官方續期 | `session/session.functions.ts#getIdentity`；`session/session.server.ts#requireOwner` | `session/auth.server.ts` 配置 Better Auth；官方 adapter/schema 擁有 auth tables |
| mailbox | 入口呼叫 startDemo；island loader 使用 query options | `mailbox/DemoEntry.tsx`、`mailbox/MailPanel.tsx` | `mailbox/mailbox.queries.ts` 的 owner cache；`mailbox/useMailReader.ts` 的讀信及失效更新 | `mailbox/mailbox.functions.ts` 的初始化、列表、詳情與已讀 functions | `mailbox/mailbox.server.ts` 的交易與歸屬查詢；`mailbox/mockSeed.server.ts` 固定 seed |
| island | `/island` search 決定兩層及卡片選取 | `island/IslandExperience.tsx` 組合場景與 MailPanel；`island/IslandScene.tsx` 呈現板塊、固定建築與標籤 | `island/navigation.ts` 的合法選取與返回目的地 | 無 | 無 |

`src/lib/db.server.ts` 擁有共用 connection、檔案位置及 schema 初始化，不決定 owner。`src/lib/session.ts`、`src/lib/mailbox.ts` 放 client/server 共用 Zod schema，型別由 schema 推導。

session 公開 getIdentity、server-only requireOwner 及 auth SDK client。mailbox 公開 server functions、query options、DemoEntry、MailPanel。island 公開 IslandExperience。

依賴方向為 routes → session / mailbox / island；island → mailbox；mailbox server → session server；session/mailbox server → db.server；client/server → shared schemas。session 不讀 mailbox 表，mailbox 不 import island。

#### Routes and presentation

- `/` 顯示「進入群島」及灰色停用的「Google 登入」。已有有效身分且信箱已初始化時導向 `/island`；提交期間停用重複進入。
- `/api/auth/$` 對應 `src/routes/api/auth/$.ts`，GET/POST 委派 Better Auth handler。此 URL transport 為官方 auth 協定所需，不另寫登入 endpoint。
- `/island?domain=…&subcategory=…&mail=…` 由 schema 驗證。無 domain 是群島層；domain 是板塊層；subcategory 開右側列表卡；mail 顯示內文。選取的父子關係必須一致且屬於同 owner。
- 缺有效 session 回入口；錯誤 ID 或父子關係顯示找不到。不要以相似欄位、另一領域或另一封郵件補缺。
- 返回列表、關閉卡片與返回群島保留 history 語意。卡片關閉後恢復原子分類焦點。提供 loading、空列表、錯誤與重試。
- 使用 16:9 全螢幕海洋、七個緊密接邊的 congruent 六角板塊及外圍沙漠，同一正交等角相機。無固定 sidebar、top nav 或 bottom toolbar。
- 建模以 Three 的基本幾何與必要的自訂屋頂形狀組合，六角地形用加厚與斜邊表現。各領域依視覺規格的輪廓、屋頂、材質與結構家族建模；港口使用碼頭與小型貨倉。此票每個領域、子分類使用固定代表建築，等級變化由 03 負責。
- 使用啞面低多邊形材質、柔和陰影、小建築與克制裝飾。HTML 標籤使用已安裝 Drei Html 定位，鍵盤與模型點擊共用導航動作；Canvas 在 client 初始化，SSR 保留可讀載入內容。
- 未讀顯示為「未讀 N」的實際封數，包括 0 與大於 30 的數值。零未讀仍保留位置。本票不定義 2–12 數字圓片語意、不做屋頂待回覆狀態、NPC、船、道路或時間光影切換。
- 按鈕與標題使用玩家可理解的名稱，不顯示 demo/mock/placeholder 或停用狀態的重複字樣。

#### Data and contracts

下列 snippet 為契約示意，交付時以 Zod schema 擁有實際型別。

```ts
const domainIdSchema = z.enum([
  'core-projects', 'internal-team', 'newsletters', 'finance-bills',
  'system-alerts', 'social-events', 'shopping-delivery', 'low-priority',
]);
const idSchema = z.uuid();
const emptyInput = z.strictObject({});
const listMailInput = z.strictObject({ domainId: domainIdSchema, subcategoryId: idSchema });
const mailInput = listMailInput.extend({ mailId: idSchema });
const identitySchema = z.object({ ownerKey: idSchema });
const mailSummarySchema = z.object({
  id: idSchema, subcategoryId: idSchema,
  subject: z.string(), sender: z.string(), receivedAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
});
const mailDetailSchema = mailSummarySchema.extend({ bodyText: z.string() });
type MailDetail = z.infer<typeof mailDetailSchema>;
```

Overview 回傳八領域及其子分類，每項含 id/name/unreadCount。未讀為非負整數，從 mail.readAt 為 null 的封數聚合；readAt 不表示回覆、重要性或封存。

```text
Better Auth: user/session/account/verification 與 anonymous 欄位，由官方 schema 擁有。
mailboxes: { owner_id, seed_version, initialized_at }
subcategories: { id, owner_id, seed_key, domain_id, name }
mails: { id, owner_id, seed_key, subcategory_id,
         sender, subject, body_text, received_at, read_at: string | null }
```

owner_id 來自經認證的 Better Auth user.id。每位使用者的 mail/subcategory 產生新的 UUID；seed_key 只識別模板。同類 entity 的 `(owner_id, seed_key)` 唯一；mail 的 `(owner_id, subcategory_id)` foreign key 限制同 owner 的分類關係。domain 只存於 subcategory，mail 經關聯取得。

固定 seed 在開發時準備，八領域都有內容與預設子分類。至少核心專案有 Q4 報價與設計審批兩個子分類，且未讀數為 3 與 1。整組資料包含已讀、未讀與子分類未讀 0、1、2、3、9、10、29、30，供後續 03 使用。seed_version 記本次匯入來源；重新開頁面或 seed 更新不重新覆蓋既有資料。後續票再加入道路、死線、分類快取及 NPC 所需資料。

```text
GET  getIdentity({}) -> { ownerKey } | null
POST startDemo({}) -> { ownerKey }
GET  getOverview({}) -> Overview
GET  listMail({ domainId, subcategoryId }) -> MailSummary[]
GET  getMail({ domainId, subcategoryId, mailId }) -> MailDetail
POST markMailRead({ domainId, subcategoryId, mailId }) -> { mailId, readAt }
```

全部使用 Start createServerFn 及 Zod validator，包括 strict 空輸入。除 getIdentity 可回 null 外，mailbox functions 一律 requireOwner。client 不傳 owner_id；詳細讀取、列表、更新與聚合皆使用同一 owner 約束。跨 owner 或未知資源回 NOT_FOUND，缺身分回 UNAUTHENTICATED；該錯誤語意必須能由 transport 與 UI 辨識。郵件回應 private/no-store。列表依 receivedAt descending、id 穩定排序。

#### Identity and persistence

以下為設定意圖，非已執行範例：

```ts
betterAuth({
  database: sqliteConnection,
  advanced: { database: { generateId: 'uuid' } },
  session: {
    expiresIn: 60 * 60 * 24 * 365,
    updateAge: 60 * 60 * 24,
    deferSessionRefresh: true,
  },
  plugins: [
    anonymous({ disableDeleteAnonymousUser: true }),
    tanstackStartCookies(),
  ],
});
```

`auth.server.ts` 讀取正確 baseURL、secret 與 trusted origins。cookie 的簽發、驗證、安全屬性、到期與續期交給 Better Auth；不自製 token/hash 表，也不宣稱它只保存 token hash。關閉匿名刪除入口以符合本票保留舊資料的需求；不啟用 email/password、社交 provider 或帳號連結介面。

getIdentity/requireOwner 透過 auth.api.getSession 傳入目前 request headers，取得驗證後的 user.id。deferSessionRefresh 將需要續期的 client session 讀取交由官方 SDK POST refresh；island route 必須實際掛載 authClient.useSession 訂閱，僅呼叫 server loader 不足以保證此流程。client 訂閱接線與每日續期留待交付時驗證。

SQLite 路徑預設 `.data/email-island.sqlite`，允許 `EMAIL_ISLAND_DB_PATH` 覆寫。排除資料檔及 WAL 檔進入版本管理。官方 CLI 從固定 auth 設定產生初始 SQL，fresh DB 初始化套用；不寫舊 prototype migration 或相容分支。運作條件為單一 Node process 與持久本機磁碟。

#### Data flow

1. 入口先查既有身分；有則沿用，沒有才呼叫 authClient.signIn.anonymous。完成後 startDemo 驗證 owner，再在 mailbox 交易中檢查初始化、複製 seed、寫初始化標記。
2. 已初始化的 owner 重複請求直接沿用。交易及唯一約束避免同 owner 的併發 seed 重複；失敗整筆 rollback。auth 建立與 mailbox seed 是兩個邊界，seed 失敗保留已成立的身分供重試。首次無 cookie 的獨立請求不承諾相同 owner，入口防重送。
3. loader/query options 經 Zod → requireOwner → owner-scoped SQLite，回傳 overview、子分類列表及所選內容。
4. 內文成功呈現才送 markMailRead；hover、預取與列表載入不改 readAt。只將 null readAt 設為伺服器時間，重複呼叫保留既有值。
5. 保存成功後 mailbox query model 失效並重讀該 owner 的 overview/list/detail。每個 SSR request 建立獨立 QueryClient，client cache keys 含 ownerKey；ownerKey 只用於 cache 分區，不能授權。session 確認失效或改變時清除先前 cache 並回入口，查詢暫時失敗不冒充登出。
6. 持久化失敗交給 UI 顯示錯誤與重試；不改用記憶體信箱、不吞錯誤回空列表，也不提前宣稱已讀已保存。

沿用 Start 預設 CSRF middleware；若新增 src/start.ts，需接回 createCsrfMiddleware。郵件 mutation 使用 POST。auth handler 使用 Better Auth 自己的 origin/CSRF 機制。

#### Prefactoring

沒有既有業務功能需要先抽離。修改 src/router.tsx，在每次 getRouter 建立 QueryClient 並使用已安裝的 setupRouterSsrQueryIntegration；將 index route 改為入口 adapter，新增 island route 及 auth handler。routeTree.gen.ts 由工具產生，不手改。只調整必要的樣式。

#### Foundations for later tickets

- 02 擴充 mailbox 內容與子分類歸屬，另定義 Jev 分類、版本快取與人工修正。本票不建立 classifier。
- 03 使用 overview 的實際未讀封數及 island 建築呈現位置，新增四級結構與零未讀地基；本票不建立 tier 欄位。
- 07 使用 owner-scoped subcategory ID 與列表能力，另行擁有道路資料及操作。
- 12 在 IslandScene 擴充光影。本票固定日光，不新增時間服務。

#### Testing seams

驗收由後續 ticket01 實作者負責。預定自動 E2E 檔為 `src/features/mailbox/email-island.e2e.ts`，由 `playwright.config.ts` 與新增 `test:e2e` script 管理，避免由 Vitest 收集。

| AC | Planned test name |
| --- | --- |
| AC-1 | entry-disabled-google-and-initialize |
| AC-2 | repeat-entry-preserves-mailbox |
| AC-3 | domain-subcategory-mail-navigation |
| AC-4 | read-updates-all-unread-counts-once |
| AC-5 | zero-unread-keeps-navigation |
| AC-6 | persistence-browser-and-server-restart |
| AC-7 | cross-owner-read-write-isolation |
| AC-8 | resource-auth-and-parent-validation |
| AC-9 | session-daily-renewal |
| AC-10 | expiry-or-cookie-loss-starts-new-owner |
| AC-11 | seed-and-read-persistence-failure |
| AC-12 | keyboard-and-scene-navigation |
| AC-13 | manual-model-and-board-review |

使用真實 UI、router/loaders、Start transport、Better Auth 與隔離的臨時 SQLite；不 mock 身分或 owner 授權。正常路徑無外部郵件／模型服務。AC-9/10 控制伺服器時間，AC-11 只在隔離持久化測試邊界注入一次失敗，不在正式 auth 加測試捷徑。直接 RPC 測試取得真正 generated endpoint/serialization，再以另一 context 重送外部 ID。

Vitest 補充同 owner 重複初始化、seed rollback、重複 markRead 及複合 foreign key。依 acceptance-testing 指引記錄 AC → test → baseline/integrated 結果；型別、build、lint 與依賴檢查使用實際 repository scripts。最終 browser 驗證保留群島／板塊／郵件卡的截圖、鍵盤操作、WebGL 與 console/network 結果。

模型驗收用同相機、光線與世界比例的八領域對照圖，在實際棋盤尺寸檢視；隱藏標籤測輪廓辨識，記錄穿模、遮擋及構圖缺陷。幾何與互動可自動驗證，藝術品質由人工對照規格判斷。

### Constraints and exceptions

- 此 issue 的建立流程只提供文件及來源調查。完整 Node/Start/Better Auth/SQLite 整合、每日 client POST 續期、cookie 與 SSR 接線、錯誤 transport、build 的 server-only 邊界，以及上述 E2E 都尚未完成驗證。交付時實測並記錄結果，不能把設計批准視為測試通過。
- 來源文件確認能力不等於本專案相容性已經驗證。若交付證據迫使改變套件、模組或公開契約，先提出有證據的設計修訂。
- session 有效期為 365 日，使用時按一日 updateAge 續期；瀏覽器仍可能清除 cookie。到期或憑證消失後建立新身分，舊資料保留，沒有復原入口。
- 本票只處理 mock mail、預設分類與基本讀信。圖片為視覺參考，功能與等級門檻以 project.md 為準；本票不實作升級門檻行為。
- 未規劃 serverless、多副本或跨裝置登入。不得把同名／同型別欄位當成另一 domain fact 的 fallback。

### Dependencies and delivery

Blocked by: None。直接後續票為 02、03、07、12，依 tickets.md 規劃基線，沒有讀取或沿用先前 ticket01 產物。

Tracker 為本地 Markdown；此 issue 發布只建立 `.scratch/email-island/issues/01-demo-entry-isolated-mail-reading.md`，不推送 Git 或部署。交付基線為當時最新本地 demo，remote/target/publication authority 須在獨立交付工作中按專案政策確認。此 issue 的批准不授權開始實作。

來源：`project.md`、`reference/email-island/README.md`、`.scratch/email-island/tickets.md`、`docs/agents/architecture/frontend.md`、`docs/agents/architecture/backend.md`。

官方能力依據：[Better Auth anonymous](https://better-auth.com/docs/plugins/anonymous)、[Start integration](https://better-auth.com/docs/integrations/tanstack)、[SQLite adapter](https://better-auth.com/docs/adapters/sqlite)、[session management](https://better-auth.com/docs/concepts/session-management)、[Node 26.10.0 SQLite](https://nodejs.org/download/release/v26.10.0/docs/api/sqlite.html)。這些連結支持選型與設定意圖，不能代替交付結果。

</details>

## Comments

### 2026-11-08 交付開始

使用者以 `$project-deliver-issue ticket 1` 授權開始實作。本次依已批准的本地交付政策，base 與 target 均為本地 `demo`，完整 SHA 為 `3e865e109dfa5f1bf97a28d717b011c894a88605`。沒有依賴票券或 Git remote；本次只準備本地 change-request preview，不推送或部署。

- Feature checkout：`/private/tmp/email-island-ticket-01`，分支 `feat/01-isolated-mail-reading`。
- UI checkout：`/private/tmp/email-island-ticket-01-ui`，detached HEAD，起點為上述完整 SHA。
- 原工作區所有既有、無關修改均保留。
- 使用者已批准安裝 `better-auth@1.7.18`、`auth@1.7.18`、`@playwright/test@1.65.0` 及需要的 Playwright Chromium。
- 主代理 `/root` 僅負責協調；實作與修正由 implementer 負責，獨立 reviewer 保持唯讀。此限制已寫入 `project-deliver-issue` 技能。
- `/root/mailbox_implementation` 負責後端、入口與 AC-1 至 AC-12 的完整 E2E；`/root/island_ui_implementation` 負責場景、讀信卡、導航及相關 focused tests 與截圖。AC-13 的獨立 Spec 人工視覺審查尚待執行。

驗收規劃及執行紀錄位於 `/private/tmp/email-island-01-evidence/orchestration.md`。baseline 與 integrated 驗證均待執行，尚未宣稱通過。

### 2026-11-08 本地交付完成

本地 feature `feat/01-isolated-mail-reading` 停在 `3614cbecf74b797e3939d23de246c6b4bab8efb8`。AC-1 至 AC-12 的完整 E2E 12/12 通過；AC-13 經保留的獨立 Spec reviewer 複審通過。兩輪完整審查結束，最終 Standards／Spec 均 PASS，沒有未解決的 T1／T2／T3 finding。此本地交付里程碑當時尚未發布；後續使用者授權的分支推送結果如下。

### 後續分支發布

使用者要求 "push the branch to remote"，並明確確認 "I approve the remote, I manually configured it"。目的地為 `origin` 的 `git@github-251021:gary251021/demo-email-island.git`。自動審批最初因目的地權限證據不足拒絕推送；使用者明確批准該 remote 後，授權推送成功，exit 0，建立 `origin/feat/01-isolated-mail-reading` 並設定 upstream。協調者以 `git ls-remote` 讀回完整 SHA `3614cbecf74b797e3939d23de246c6b4bab8efb8`，與乾淨的本地 HEAD 一致。Target `demo` 未修改，沒有建立 PR、merge 或部署。

### 已接受的追加範圍：登入／登出導航

使用者在既有交付與發布後要求 "Add nav for login/logout"。本票重新標記為 claimed，延續同一 feature 分支，自 `3614cbecf74b797e3939d23de246c6b4bab8efb8` 實作。先前完成及發布的結果保留為歷史里程碑；以下追加變更尚未驗證、審查或發布。

此追加範圍使用既有匿名登入，不新增 OAuth、帳號復原、套件或後端 API。新增精簡且可存取的 account navigation；使用者明確要求的此導航，限定覆蓋原票「無頂部導航」的限制，其餘棋盤構圖限制維持。既有「Google 登入」保持 disabled，「進入群島」入口保留。

- **NAV-1 登入導航**：使用 pointer 或鍵盤啟用可辨識的「登入」導航，呼叫既有真實 anonymous auth 與 mailbox 初始化，進入包含八個領域的群島。載入期間不重複送出登入或初始化。
- **NAV-2 登出與 session 邊界**：使用官方 SDK 登出，呈現 pending／成功／錯誤狀態；成功後清除舊 owner cache，回入口，真實 session 為 null。返回上一頁、直接進入群島 URL 或重新整理均受登入守衛限制。再次登入建立新的匿名 owner 與初始信箱；舊資料保留，新身分不可讀取。
- **NAV-3 鍵盤、失敗重試與布局**：導航可由鍵盤操作，pending 不重複請求。一次登出 network failure 保留目前群島、session 與資料，顯示錯誤及重試；重試經真實 SDK 成功後回入口。1600px 桌面及 390px 行動 viewport 的群島、Core 板塊與讀信卡，導航不遮擋或碰撞既有控制。

完整應用驗收使用真實 UI、auth、Start 與隔離 SQLite，不 mock 身分；僅在一次登出請求注入 network abort 驗證失敗復原。原有 12 項 E2E 的動作與期望維持，再新增 NAV-1 至 NAV-3 的具名驗收。相同新測試須在獨立的 `3614cbecf74b797e3939d23de246c6b4bab8efb8` baseline checkout 記錄行為結果；完整 suite 預期 15 項，實際分組及數量由實作者記錄，尚未執行完成。

原 UI 實作者 `/root/island_ui_implementation` 為唯一應用寫入者，使用 `/private/tmp/email-island-ticket-01`。責任涵蓋 DemoEntry、IslandExperience、client session navigation、樣式及既有 E2E／必要 fixtures；不修改後端、設定或依賴。主代理僅協調。新證據位於 `/private/tmp/email-island-nav-evidence/`，原交付 MR preview 與 review artifacts 保留原狀。Origin 已獲使用者批准，先前分支已推送；此追加變更是否後續 push，留待驗證後由協調者依授權範圍決定，不建立新票、PR、merge 或部署。

### 登入／登出追加範圍完成並發布

最終 `d535d332b19d8c0683f69381bba066a309aefd4b` 已完成 16/16 E2E、導航第二輪 Standards／Spec PASS 與 mutation PASS，NAV-SPEC-01 已 resolved。沿用先前同一分支／目的地的推送授權，正常 fast-forward push 及 exact-SHA readback 完成；target demo 不變，未建立 PR、merge 或部署。完整追加結果與 artifact 連結見下方 Answer。

## Answer

以下先保留 `3614cbecf74b797e3939d23de246c6b4bab8efb8` 的原交付結果，後接已完成的登入／登出導航追加交付。最終 feature／remote HEAD 為 `d535d332b19d8c0683f69381bba066a309aefd4b`。

已交付匿名獨立信箱、SQLite 保存與資源歸屬驗證、八領域兩層 3D 導航、讀信及未讀同步、保存失敗重試與鍵盤焦點操作。每日續期、憑證失效、跨使用者隔離及跨瀏覽器／伺服器重新啟動保存均有完整應用 E2E 證據。AC-13 的群島與 Core 板塊視覺比較各為 85/100，獨立審查 PASS；兩項原視覺 finding 均已修正並獨立確認。

最終驗證包括 exact HEAD 的 E2E 12/12、typecheck、lint、dependency lint、format check，以及相同 Git tree 的 8/8 應用單元測試與 build。lint 保留一項經 Standards 接受的 Building cohesion advisory。另一次範圍過廣的測試指令掃到未修改的 tooling，產生四個空 suite 及一個 hook assertion failure；沒有 baseline 比較，不能判定其來源，也未宣稱全 repository green。

- [完整本地 change-request preview](/private/tmp/email-island-01-evidence/mr-preview.md)
- [協調者最終驗證與範圍](/private/tmp/email-island-01-evidence/coordinator-final-verification.md)
- [最終 Standards 審查](/private/tmp/email-island-01-evidence/review/standards-round2.md) 與 [最終 Spec 審查](/private/tmp/email-island-01-evidence/review/spec-round2.md)
- [Finding ledger](/private/tmp/email-island-01-evidence/finding-ledger.md) 與 [執行紀錄](/private/tmp/email-island-01-evidence/orchestration.md)
- 應用 checkout：`/private/tmp/email-island-ticket-01`。原工作區的無關修改均保留。
- [可用的最終本地預覽](http://127.0.0.1:3111/)，協調者確認 HTTP 200；早先 round 1 的 3110 URL 僅為歷史證據，已停止。

交付關係為 `demo@3e865e109dfa5f1bf97a28d717b011c894a88605 → feat/01-isolated-mail-reading@3614cbecf74b797e3939d23de246c6b4bab8efb8 → proposed demo target`，沒有依賴票券。後續分類、建築升級、道路及時間光影等票券不在本次實作範圍。主代理未撰寫應用程式碼；角色限制已依使用者指示寫入技能並驗證。

### 發布補記

[來源分支已依後續明確授權推送至 GitHub](https://github.com/gary251021/demo-email-island/tree/feat/01-isolated-mail-reading)，remote readback 與最終審查 SHA 一致，所有原驗證與 review 證據維持有效。Change-request 仍為 preview，target `demo` 未修改，未建立 PR、merge 或部署。使用者對 remote 的手動設定與批准是本次 issue-specific publication authority，已完成，不新增 workflow 規則或重複要求批准。

### 登入／登出導航追加交付完成

已新增可由鍵盤操作的「帳戶導覽」，入口的「登入」沿用匿名 auth／seed，群島及郵件卡的「登出」使用官方 SDK。等待時防重送，失敗保留目前 session／郵件並提供重試，成功清除 owner cache、返回入口；重新進入建立新身分，舊資料保留且不可跨 owner 讀取。桌面及行動導航不遮擋既有控制，原 Google 登入與進入群島 CTA 保留。

最終 `d535d332b19d8c0683f69381bba066a309aefd4b` 完整 E2E 16/16 通過，保留原 12 項及原 NAV 三項，僅依使用者明確需求修訂 AC-12 的 account-nav 例外，再新增一項真實 HTTP-error regression。實際 handler 回 HTTP 400／BAD_REQUEST；曾嘗試的 Origin 預期 403 實際回 200，已捨棄，沒有宣稱為通過證據。新測試不 fake auth response，確認失敗時同一 owner／mail／read state 與 retry，成功重試後 session 為 null。

導航兩輪獨立 Standards／Spec 均完成，最終兩軸 PASS；累計本票四輪完整審查，沒有未解決的 T1／T2／T3。`NAV-SPEC-01` T2 已由新測試及獨立 mutation 確認 resolved。Mutation 的原 guard-removal survivor 已被新測試殺死，原 pending／retry 兩項 kill 保留。最終修正僅新增 78 行 E2E，應用／設定未改，因此 1f 的單元測試、build 與檢查，以及獨立 13-state desktop/mobile live evidence 保持適用；最終 test type/lint/format 與完整 suite 另行通過。原 85/85 世界視覺分數依未改的 geometry／color 保留。

來源分支已沿用先前同一分支與目的地的推送授權，以正常 fast-forward push 從 3614 更新至 d535，exit 0。協調者 `git ls-remote --heads origin refs/heads/feat/01-isolated-mail-reading` 讀回完整 d535，與乾淨的本地 HEAD 一致。未新增 d535-specific 使用者批准，亦未建立 PR、merge 或部署，target `demo` 保持原狀。

- [導航最終 preview](/private/tmp/email-island-nav-evidence/nav-mr-preview.md)
- [導航主代理驗證](/private/tmp/email-island-nav-evidence/main-verification.md) 與 [test-change ledger](/private/tmp/email-island-nav-evidence/test-change-ledger.md)
- [導航 finding ledger](/private/tmp/email-island-nav-evidence/finding-ledger.md)
- [最終 Standards](/private/tmp/email-island-nav-evidence/review/standards-round2.md)、[最終 Spec](/private/tmp/email-island-nav-evidence/review/spec-round2.md)、[最終 mutation](/private/tmp/email-island-nav-evidence/mutation/round2/report.md)

主代理維持只協調，不撰寫應用程式碼。新增導航為 issue-specific 需求；既有 coordinator-only 技能修正已完成，沒有新的全域 workflow 規則更新。
