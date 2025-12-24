import * as React from "react";
import { cn } from "~/lib/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-white/20 bg-neutral-900 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:ring-2 focus:ring-white/20",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
