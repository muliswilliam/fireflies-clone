import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-4xl items-center px-6 sm:px-8">
        <Link
          href="/"
          className="font-semibold tracking-tight hover:opacity-80"
        >
          Firefly Notes
        </Link>
      </div>
    </header>
  );
}
