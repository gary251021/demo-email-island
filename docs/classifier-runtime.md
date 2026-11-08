# 郵件分類的本機執行

Node 26.10.0、Redis 8.10.3，網頁與獨立 worker 共用同一持久 SQLite 檔案。從 repository 根目錄執行，保留 `src/lib/auth-schema.sql`。應用使用 BullMQ 6.7.2、ioredis 6.0.0、@typesafe-ai/sdk 0.7.0，模型固定 `jev-1.14.0`。

Redis 僅綁定 loopback，使用持久磁碟、AOF 與 noeviction。服務採 Redis 的 AGPLv3 授權選項；SDK、BullMQ 與 ioredis 是 MIT。Redis binary 由操作者提供，不需要全域安裝。

```sh
redis-server --bind 127.0.0.1 --port 6402 --appendonly yes --appendfsync everysec --maxmemory-policy noeviction --dir /absolute/persistent/redis
```

在 web 與 worker 兩個終端設定相同環境，`JEV_API_KEY` 是官方 TypeSafe SDK 的 `apiKey`。不要將金鑰寫入前端或版本控制。Better Auth 的 secret 請產生一次並持久保存，重啟 web 時沿用。

```sh
export EMAIL_ISLAND_DB_PATH=/absolute/persistent/email-island.sqlite
export EMAIL_ISLAND_REDIS_URL=redis://127.0.0.1:6402
export BETTER_AUTH_URL=http://127.0.0.1:4202
export BETTER_AUTH_SECRET=your-persistent-random-secret-of-at-least-32-characters
export JEV_API_KEY=your-key
npm run dev -- --host 127.0.0.1 --port 4202 --strictPort
```

第二個終端以相同 DB、Redis 與金鑰啟動：

```sh
npm run worker
```

以 SIGTERM 停止 worker 會等待當前工作；非正常停止由 BullMQ stalled recovery 接手。Redis 保留 AOF 資料。Queue 名稱包含 SQLite 絕對路徑的 SHA-256 前綴，所以不同測試資料檔的 worker 不會取走彼此的工作。兩程序的 DB 路徑必須完全相同。

SQLite ledger 保存分類意圖及結果，BullMQ 負責排程、鎖、stalled 恢復。worker 啟動與每五秒 Job Scheduler 查核未完成意圖，補發缺少的 job，並對映終止的 queue 錯誤。Redis 完全遺失資料時，啟動 worker 會重建 pending 意圖；已成功結果不重算。Redis 中斷後新增的意圖會記為 failed，使用畫面的「重試」恢復。

Jev 每步完整保存 choice、probabilities、confidence 與實際回應的 model。SDK 預設最多兩次 transport retries，應用不另加 provider retry loop。外部回應到 SQLite 提交之間當機，恢復可能再次呼叫 Jev；無法承諾外部 exactly-once 或零重複費用。

規則版本由 `EMAIL_ISLAND_CLASSIFICATION_RULE_VERSION` 設定，預設 `1`。重啟時不搬動舊信，使用者點「更新分類」才重算版本過時的自動結果。人工修改持續優先。

## 驗證

Jev fixture 只取代 provider HTTP 邊界；Start、Better Auth、SQLite、Redis 與 BullMQ 均為真實程序。

```sh
npm run jev:fixture
npm run test -- --run
EMAIL_ISLAND_E2E_PORT=4202 EMAIL_ISLAND_E2E_REPORT=/absolute/evidence/acceptance.json EMAIL_ISLAND_E2E_OUTPUT=/absolute/evidence/artifacts npm run test:e2e
```

E2E fixture 自行啟停 web 與 worker；Redis 與 Jev fixture 須先啟動。E2E 的 Redis 重啟情境需要 `EMAIL_ISLAND_REDIS_BINARY` 指向 8.10.3 的 `redis-server`，相鄰目錄有 `redis-cli`。預設驗證目錄是交付 evidence 的隔離暫存目錄，正式 Redis 資料請使用自己的路徑。測試不可與另一個使用相同 provider fixture 的測試同時執行。

## 06 的讀取介面

`getStoredClassifications(ownerId, mailIds)` 是 server-only。每封回傳 `mailId`、目前 `subcategoryId`、`source`、`override`、`current` 及 `history`。`source` 是 `manual`、`automatic` 或 `unclassified`。`current` 只包含符合目前內容、模型、規則及候選集合的成功結果，過時資料保留於 `history`。兩者均帶內容 hash、版本、兩步原始答案與 requested/resolved model；人工來源不能假稱為 Jev 成功。

mailbox 公開 `getClassificationInputs(ownerId, ids)`、`listClassificationCandidates(ownerId)`、`applyCategory(ownerId, mailId, subcategoryId, expectedRevision)`，後者在呼叫者的 SQLite 交易內驗證 owner 與 revision。`importMail` 提供交易內的 onChanged 回呼，classifier 的 `importClassifiedMail` 用此回呼原子寫入意圖。協調者提交交易後 await `dispatchPending()`。
