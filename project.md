以下為你整理好嘅 中文功能規格書（Functional Specification）。呢份規格書直接將頭先討論嘅「卡坦島 x 政策島」遊戲化設計邏輯，轉化做軟件工程同產品設計（Product Design）嘅明確規格，方便你日後交俾工程團隊或者用黎寫 Prototype：

功能規格書：電郵島（Email Island）

1. 產品概述（Product Overview）

「電郵島」係一個將傳統沉悶嘅收件箱（Inbox）轉化為 3D 立體桌遊棋盤（Tabletop Board Game UI） 嘅生產力應用程式。透過借鏡桌遊《卡坦島》（Catan）嘅地形板塊、建築升級、道路連線同強盜機制，消除用家面對大量文字時嘅視覺疲勞，並精準解決「長文電子報被埋沒」同「跨專案電郵難以串聯」嘅痛點。

2. 核心架構與視覺介面（Visual & Layout Spec）

⚬ 全螢幕沉浸式畫布（Full-Bleed 3D Tabletop View）：
  ⚬ 畫面取消所有傳統 SaaS 後台嘅固定側邊欄（Sidebar）或頂部導航欄，全屏顯示以 Isometric 3D 低多邊形（Low-poly）渲染嘅海洋與中央群島。
⚬ 相連六角形地形（Interlocking Hex Biomes）：
  ⚬ 中央由 7 至 8 個緊密拼接嘅六角形板塊組成，每個板塊代表一個獨立嘅電郵領域（Biome）：
    ⚬ 山脈島（Mountain）：核心專案與緊迫死線（Core Projects）。
    ⚬ 森林島（Forest）：內部團隊日常溝通（Internal Team）。
    ⚬ 農田島（Wheat Field）：電子報與知識文章（Newsletters）。
    ⚬ 金礦島（Gold Mine）：財務單據、發票與帳單（Finance & Bills）。
    ⚬ 磚窯島（Clay Quarry）：系統與開發通知（Jira / GitHub / System Alerts）。
    ⚬ 牧場島（Pasture）：社交、活動邀請與行程（Social & Events）。
    ⚬ 港口／市集（Harbor）：網購與物流追蹤（Shopping & Delivery）。
    ⚬ 沙漠島（Desert）：低優先級推廣信、冷信與垃圾郵件（漂浮喺外圍）。
⚬ 動態時間光影（Day/Night Lighting）：
  ⚬ 支援跟隨現實時間轉變（晨光 \rightarrow 黃昏 \rightarrow 夜晚護眼模式），喺收工時間提供溫馨嘅桌遊檯燈照明。

3. 核心功能與互動機制（Core Functional Mechanics）

3.1 數字圓片與未讀頻率（Circular Number Tokens）

⚬ 每個六角形板塊中央均設有一枚經典卡坦島風格嘅圓形數字標記（2 至 12）。
⚬ 數字代表該分類當前嘅未讀郵件數量或來信頻率；高流量板塊會以紅色大字（如 6、8）連同概率點（Probability Dots）標示，讓用家一秒看出邊個板塊最繁忙。

3.2 建築升級機制（Building Volume Scaling）

島上嘅建築物體積會隨住郵件／對話串（Thread）嘅數量動態升級：

⚬ Lv. 1 帳篷／路牌（Camp）：1–2 封信（OTP 驗證碼、單次通知）。支援滑鼠一掃（Hover）快速封存（Archive）。
⚬ Lv. 2 木屋村莊（Settlement）：3–9 封信（一般日常討論串）。屋頂顏色代表狀態（紅頂＝未讀／待回覆；藍木頂＝已讀）。
⚬ Lv. 3 石造城市／大教堂（City）：10–29 封信（大型專案或拉鋸商討）。點擊後會開啟 AI 演進時間軸，將幾十封信濃縮成 3 個階段，免除人肉捲動。
⚬ Lv. 4 巨型要塞（Metropolis）：30+ 封信（長期積壓嘅訂閱或超大 Thread）。系統會彈出提示，支援一鍵批次封存或分拆為獨立子島。

3.3 高門檻跨島道路（High-Threshold Cross-Hex Roads）

⚬ 為免地圖變成混亂嘅蜘蛛網，系統不會因為單純關鍵字吻合就亂連線。
⚬ 只有當滿足「跨領域業務依賴」（例如：山脈島嘅專案進度，被金礦島未批核嘅 Invoice #402 卡住）時，六角形邊界才會浮現一條發光嘅金色道路，串連兩個相關嘅郵件主題。
⚬ 自動連線：道路由系統自動建立同移除，冇手動開關。只要依賴關係成立，道路就會顯示；依賴解除（例如 Invoice 已批核）後，道路自動消失。
⚬ 判斷方式：「兩個郵件主題應唔應該連線」預計由模型分類（Model Classification）負責（擬用 the jev、typesafe.ai），對候選嘅郵件主題配對輸出類型安全（Type-safe）嘅結構化結果，例如：是否存在依賴、依賴方向（邊個卡住邊個）、依據嘅郵件同信心分數。只有結果判定為依賴、而且信心達到門檻，先會建立道路。

3.4 尋寶獵人 NPC —— 「強盜」機制嘅創新應用（The Robber / Treasure Hunter Nudge）

⚬ 定位：將傳統卡坦島用黎阻礙人嘅「強盜」棋子，重新定義為「幫你發掘優質長文／電子報嘅尋寶 NPC」。
⚬ 運作邏輯：當 AI 偵測到農田島（Newsletter）有一篇好文章，但因為用家太忙導致超過 3 日未開信，尋寶 NPC 就會跳去該建築物屋頂駐紮，並燃點營火。
⚬ 推送時機：為免干擾工作，系統會喺用家設定嘅「專注閱讀時間」（例如星期五下午或夜晚）先至彈出 卡坦島事件卡（Development Card Modal），顯示 3 句 AI 重點摘要，讓用家選擇「一鍵吸取知識並存檔」或「轉發俾團隊」。

4. UI 互動組件規格（UI Component Spec）

1. 事件卡／玩家輔助卷軸（Card & Scroll Modals）：
  ⚬ 當點擊島嶼、建築或尋寶 NPC 時，畫面右側會以極具質感嘅桌遊卡牌或皮革卷軸滑出，入面直接內嵌 AI 摘要與回覆輸入框，保持整體桌遊沈浸感，唔會突然跳返去沉悶嘅傳統郵件介面。
