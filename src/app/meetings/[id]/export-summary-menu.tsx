"use client";

import { ChevronDown, Copy, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import type { SummaryExport } from "@/lib/meetings";

const DISABLED_REASON = "Available once the Summary is ready";

/**
 * Export the Summary as Markdown: copy it to the clipboard or download a `.md` file.
 * Disabled, with a reason, until there is a Summary to export.
 */
export function ExportSummaryMenu({
  summaryExport,
}: {
  /** `null` while the Meeting has no settled Summary. */
  summaryExport: SummaryExport | null;
}) {
  async function copy() {
    if (!summaryExport) return;
    try {
      await navigator.clipboard.writeText(summaryExport.markdown);
      toast.add({
        type: "success",
        title: "Summary copied",
        description: "The Markdown is on your clipboard.",
      });
    } catch {
      toast.add({
        type: "error",
        title: "Could not copy",
        description: "Your browser refused clipboard access. Download instead.",
      });
    }
  }

  function download() {
    if (!summaryExport) return;
    const url = URL.createObjectURL(
      new Blob([summaryExport.markdown], {
        type: "text/markdown;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = summaryExport.filename;
    // In the document, and revoked only after the click has been handled: Firefox and Safari
    // drop a download whose URL is gone before the navigation starts.
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const disabled = summaryExport === null;
  return (
    <DropdownMenu>
      {/* A disabled button gets no pointer events, so the reason sits on a wrapper that does. */}
      <span
        title={disabled ? DISABLED_REASON : undefined}
        className="inline-flex"
      >
        <DropdownMenuTrigger
          disabled={disabled}
          aria-description={disabled ? DISABLED_REASON : undefined}
          render={<Button type="button" variant="outline" size="sm" />}
        >
          <Download data-icon="inline-start" aria-hidden="true" />
          Export
          <ChevronDown data-icon="inline-end" aria-hidden="true" />
        </DropdownMenuTrigger>
      </span>
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuItem onClick={copy}>
          <Copy aria-hidden="true" />
          Copy as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={download}>
          <Download aria-hidden="true" />
          Download .md
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
