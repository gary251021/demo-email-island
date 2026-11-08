import type { MailTimeline } from "../../lib/mailbox";

const dates = new Intl.DateTimeFormat("zh-Hant-HK", {
  month: "short",
  day: "numeric",
  timeZone: "Asia/Hong_Kong",
});

export function TimelineSummary({ timeline }: { timeline: MailTimeline }) {
  return (
    <section className="mail-timeline" aria-labelledby="mail-timeline-title">
      <h2 id="mail-timeline-title">郵件時間軸</h2>
      <ol aria-label="三階段時間軸">
        {timeline.stages.map((stage, index) => (
          <li key={stage.title}>
            <span className="timeline-number" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <h3>{stage.title}</h3>
              <p className="timeline-dates">
                <time dateTime={stage.from}>
                  {dates.format(new Date(stage.from))}
                </time>
                <span> 至 </span>
                <time dateTime={stage.to}>
                  {dates.format(new Date(stage.to))}
                </time>
              </p>
              <p>{stage.summary}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
