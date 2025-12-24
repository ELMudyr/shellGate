import * as React from "react";
import { cn } from "~/lib/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none h-9 px-4 py-2";
    const variants: Record<string, string> = {
      default: "bg-white text-black hover:bg-white/90",
      outline: "border border-white/20 text-white hover:bg-white/10",
      ghost: "text-white hover:bg-white/10",
    };
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
