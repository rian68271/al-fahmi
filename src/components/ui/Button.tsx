import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = "default", size = "default", ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50",
        {
          "bg-primary text-primary-foreground shadow-[0_14px_30px_-14px_hsl(var(--primary)/0.85)] hover:-translate-y-0.5 hover:bg-primary/95": variant === "default",
          "bg-destructive text-destructive-foreground shadow-[0_14px_30px_-14px_hsl(var(--destructive)/0.75)] hover:-translate-y-0.5 hover:bg-destructive/90": variant === "destructive",
          "border border-border bg-white/80 text-foreground shadow-sm hover:-translate-y-0.5 hover:bg-white hover:shadow-md": variant === "outline",
          "bg-secondary text-secondary-foreground shadow-sm hover:-translate-y-0.5 hover:bg-secondary/90": variant === "secondary",
          "text-muted-foreground hover:bg-accent hover:text-foreground": variant === "ghost",
          "text-primary underline-offset-4 hover:underline": variant === "link",
          "h-11 px-5 py-2.5": size === "default",
          "h-9 rounded-xl px-3.5 text-xs": size === "sm",
          "h-12 rounded-2xl px-8 text-sm": size === "lg",
          "h-11 w-11": size === "icon",
        },
        className,
      )}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button };
