"use client";

import { useState } from "react";
import { toast } from "./Toast";
import { CopyIcon } from "./icons";

/** Copies a link to the clipboard with a brief visual + toast confirmation. */
export function CopyLinkButton({ url, className = "" }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("คัดลอกลิงก์แล้ว");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("คัดลอกไม่สำเร็จ", "error");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-(--accent) hover:underline ${className}`}
    >
      <CopyIcon className="w-3.5 h-3.5" />
      {copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}
    </button>
  );
}
