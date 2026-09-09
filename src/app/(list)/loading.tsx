import { Skeleton } from "@/components/ui/skeleton";

/** The list, before the Meetings arrive: header, search and a few rows in outline. */
export default function HomeLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading meetings"
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6 py-10 sm:px-8"
    >
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      <Skeleton className="mt-6 h-10 w-full rounded-lg" />
      <ul className="mt-6 divide-y rounded-xl border">
        {Array.from({ length: 5 }, (_, index) => (
          <li
            key={index}
            className="flex items-center justify-between gap-4 px-5 py-4"
          >
            <div className="min-w-0 flex-1">
              <Skeleton className="h-5 w-3/5 max-w-72" />
              <Skeleton className="mt-2 h-4 w-2/5 max-w-56" />
            </div>
            <Skeleton className="h-5 w-16 rounded-4xl" />
          </li>
        ))}
      </ul>
    </main>
  );
}
