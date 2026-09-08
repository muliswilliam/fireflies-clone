import { Mic } from "lucide-react";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Firefly Notes</h1>
      </header>

      <section
        aria-labelledby="empty-state-title"
        className="mt-10 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-20 text-center"
      >
        <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
          <Mic aria-hidden="true" className="size-5" />
        </span>
        <h2 id="empty-state-title" className="mt-5 text-lg font-medium">
          No meetings yet
        </h2>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6">
          Meetings you record will appear here with their transcript, summary
          and action items.
        </p>
      </section>
    </main>
  );
}
