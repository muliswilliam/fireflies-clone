import type { Summary } from "@/lib/meetings";

/** The Summary tab body: the Overview paragraph and the Key Takeaways. */
export function SummaryView({
  summary,
  actions,
}: {
  summary: Summary;
  /** Rendered top-right of the Overview, for the Regenerate control. */
  actions?: React.ReactNode;
}) {
  return (
    <article aria-label="Summary" className="rounded-xl border">
      <section className="p-5">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-sm font-medium">Overview</h3>
          {actions}
        </div>
        <p className="mt-3 text-sm leading-7">{summary.overview}</p>
      </section>
      <section className="border-t p-5">
        <h3 className="text-sm font-medium">Key Takeaways</h3>
        <ul
          aria-label="Key Takeaways"
          className="marker:text-muted-foreground mt-3 list-disc space-y-2 pl-5 text-sm leading-6"
        >
          {summary.keyTakeaways.map((takeaway, index) => (
            <li key={index}>{takeaway}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
