import { forwardRef, type InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={`w-full rounded-lg border border-(--surface-border) bg-(--surface) px-3 py-2 placeholder:text-(--text-muted-2) focus:outline-none focus:ring-2 focus:ring-(--brand) focus:border-(--brand) ${className}`}
        {...props}
      />
    );
  }
);
