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

/**
 * Export the Summary as Markdown: copy it to the clipboard or download a `.md` file.
 * Disabled, with a reason, until there is a Summary to export.
 */
export function ExportSummaryMenu({
  exported,
}: {
  /** `null` while the Meeting has no Summary yet. */
  exported: SummaryExport | null;
}) {
  async function copy() {
    if (!exported) return;
    try {
      await navigator.clipboard.writeText(exported.markdown);
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
    if (!exported) return;
    const url = URL.createObjectURL(
      new Blob([exported.markdown], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = exported.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={exported === null}
        title={
          exported === null ? "Available once the Summary is ready" : undefined
        }
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <Download data-icon="inline-start" aria-hidden="true" />
        Export
        <ChevronDown data-icon="inline-end" aria-hidden="true" />
      </DropdownMenuTrigger>
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
