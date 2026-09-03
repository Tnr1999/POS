import { forwardRef, type SelectHTMLAttributes } from "react";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = "", ...props }, ref) {
    return (
      <select
        ref={ref}
        className={`w-full rounded-lg border border-(--surface-border) bg-(--surface) px-3 py-2 focus:outline-none focus:ring-2 focus:ring-(--brand) focus:border-(--brand) ${className}`}
        {...props}
      />
    );
  }
);
