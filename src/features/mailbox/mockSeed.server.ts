import type { DomainId } from "../../lib/mailbox";

export const domains: { id: DomainId; name: string }[] = [
  { id: "core-projects", name: "核心專案" },
  { id: "internal-team", name: "團隊溝通" },
  { id: "newsletters", name: "電子報" },
  { id: "finance-bills", name: "財務帳單" },
  { id: "system-alerts", name: "系統通知" },
  { id: "social-events", name: "社交活動" },
  { id: "shopping-delivery", name: "網購物流" },
  { id: "low-priority", name: "低優先郵件" },
];

export const seedCategories: {
  key: string;
  domainId: DomainId;
  name: string;
  unread: number;
  subject: string;
  sender: string;
  body: string;
}[] = [
  {
    key: "q4",
    domainId: "core-projects",
    name: "Q4 報價",
    unread: 3,
    subject: "請確認報價項目",
    sender: "林曉晴 <clare@example.com>",
    body: "你好，\n\n第四季的報價已整理完成，請確認設計、開發及交付項目。\n請在星期五前回覆你的意見，我們會按確認結果安排時程。\n\n謝謝！\n曉晴",
  },
  {
    key: "design",
    domainId: "core-projects",
    name: "設計審批",
    unread: 1,
    subject: "首頁設計等待確認",
    sender: "陳柏言 <ben@example.com>",
    body: "最新的首頁設計已完成。請確認主視覺及文案，審批後便可開始製作。",
  },
  {
    key: "team",
    domainId: "internal-team",
    name: "每週同步",
    unread: 2,
    subject: "本週團隊工作摘要",
    sender: "周穎 <wing@example.com>",
    body: "大家好，本週同步會議安排在星期三下午三時，請帶同進度與需要協助的事項。",
  },
  {
    key: "letters",
    domainId: "newsletters",
    name: "閱讀清單",
    unread: 9,
    subject: "本週值得讀的好文章",
    sender: "編輯室 <editor@example.com>",
    body: "這一期談設計與日常生活。找個安靜的角落，慢慢閱讀吧。",
  },
  {
    key: "bills",
    domainId: "finance-bills",
    name: "待處理帳單",
    unread: 10,
    subject: "本月服務費帳單",
    sender: "帳務團隊 <billing@example.com>",
    body: "本月帳單已備妥，請核對金額與付款日期。如有疑問，請聯絡帳務團隊。",
  },
  {
    key: "alerts",
    domainId: "system-alerts",
    name: "服務報告",
    unread: 29,
    subject: "每日服務健康報告",
    sender: "服務監察 <status@example.com>",
    body: "所有服務正常運作。每日備份已完成，系統沒有待處理的事故。",
  },
  {
    key: "social",
    domainId: "social-events",
    name: "聚會邀請",
    unread: 30,
    subject: "星期六一起去野餐",
    sender: "李樂 <lok@example.com>",
    body: "星期六約好一起去海邊野餐，記得帶水與喜歡的小食。期待見面！",
  },
  {
    key: "shopping",
    domainId: "shopping-delivery",
    name: "包裹追蹤",
    unread: 1,
    subject: "你的包裹已經出發",
    sender: "物流小隊 <delivery@example.com>",
    body: "包裹已離開倉庫，預計明天下午送達。請留意收件通知。",
  },
  {
    key: "low",
    domainId: "low-priority",
    name: "稍後再看",
    unread: 0,
    subject: "上月活動回顧",
    sender: "活動小組 <events@example.com>",
    body: "謝謝你參與上月活動。這封回顧已經讀過，仍可隨時回來查看。",
  },
];
