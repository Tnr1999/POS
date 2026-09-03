"use client";

import type { InputHTMLAttributes } from "react";
import { SearchIcon } from "./icons";

export function SearchInput({
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted-2)" />
      <input
        type="search"
        className={`w-full rounded-lg border border-(--surface-border) bg-(--surface) pl-9 pr-3 py-2 placeholder:text-(--text-muted-2) focus:outline-none focus:ring-2 focus:ring-(--brand) focus:border-(--brand) ${className}`}
        {...props}
      />
    </div>
  );
}
