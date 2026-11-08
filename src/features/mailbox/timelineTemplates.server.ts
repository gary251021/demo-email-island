// Human-authored story. These sources and their summaries ship only on the server.
export type TimelineSource = {
  seedKey: string;
  sender: string;
  subject: string;
  bodyText: string;
  receivedAt: string;
};
type TemplateStage = {
  title: string;
  summary: string;
  sourceSeedKeys: string[];
};
export type TimelineTemplate = {
  id: string;
  sourceMails: TimelineSource[];
  stages: [TemplateStage, TemplateStage, TemplateStage];
};

const phaseNotes = [
  [
    "網站只包含首頁、常見問題及聯絡頁。",
    "網站不加入付款或會員帳戶。",
    "三個頁面都需要支援手機閱讀。",
    "導覽與表單都需要支援鍵盤操作。",
    "首頁、常見問題及聯絡頁的範圍保持不變。",
    "付款與會員帳戶仍在本次範圍以外。",
    "手機閱讀的需求已確認，沒有新增頁面。",
    "鍵盤操作的需求已確認，沒有新增功能。",
    "三個頁面的需求清單已完成核對。",
    "需求正式確認：三頁網站，支援手機及鍵盤，不含付款或會員帳戶。",
  ],
  [
    "請把首頁主視覺改為產品照片。",
    "請把聯絡頁的電話欄位改為選填。",
    "常見問題頁維持已確認的內容與版面。",
    "首頁已改用提供的產品照片。",
    "聯絡頁電話欄位已改為選填。",
    "手機版也已套用同一張產品照片。",
    "鍵盤操作已核對，電話選填不影響送出表單。",
    "三頁範圍不變，沒有加入付款或會員帳戶。",
    "修訂版已送審，等待確認。",
    "修訂版已批准：首頁採用產品照片，電話欄位選填；其餘需求不變。",
  ],
  [
    "已按批准的修訂版完成三頁網站，準備交付檢查。",
    "首頁產品照片與批准版本一致。",
    "常見問題頁與批准版本一致。",
    "聯絡表單的電話欄位確認為選填。",
    "三頁網站的手機閱讀檢查通過。",
    "導覽與表單的鍵盤操作檢查通過。",
    "網站仍不包含付款或會員帳戶。",
    "交付檔案及操作說明已寄出。",
    "交付檔案與操作說明已收到，檢查沒有待修項目。",
    "三頁網站已驗收，手機與鍵盤檢查通過；交付完成，沒有待修項目。",
  ],
];
const titles = ["需求確認", "方案修訂", "交付確認"] as const;
const sourceMails = phaseNotes.flatMap((notes, phase) =>
  notes.map((note, index) => ({
    seedKey: `website-story-${phase * 10 + index + 1}`,
    sender:
      phase === 1 ? "陳柏言 <ben@example.com>" : "林曉晴 <clare@example.com>",
    subject: `${titles[phase]} · ${index + 1}`,
    bodyText: `網站專案進度\n\n${note}\n\n請保留這封信作專案紀錄。`,
    receivedAt: new Date(
      Date.UTC(2026, 9, phase * 10 + index + 1, 4),
    ).toISOString(),
  })),
);

export const websiteTimeline: TimelineTemplate = {
  id: "website-delivery-2026-10",
  sourceMails,
  stages: [
    {
      title: "需求確認",
      summary:
        "確認首頁、常見問題及聯絡頁，支援手機閱讀與鍵盤操作。本次不包含付款或會員帳戶。",
      sourceSeedKeys: sourceMails.slice(0, 10).map((mail) => mail.seedKey),
    },
    {
      title: "方案修訂",
      summary:
        "首頁改用產品照片，聯絡頁電話欄位改為選填。修訂版已批准，其餘需求不變。",
      sourceSeedKeys: sourceMails.slice(10, 20).map((mail) => mail.seedKey),
    },
    {
      title: "交付確認",
      summary:
        "三頁網站通過手機與鍵盤檢查，交付檔案及操作說明已收到。網站已驗收，沒有待修項目。",
      sourceSeedKeys: sourceMails.slice(20, 30).map((mail) => mail.seedKey),
    },
  ],
};
export const timelineTemplates = [websiteTimeline];
