import React from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  description?: string;
  align?: "left" | "between";
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, align = "between", actions, className }: SectionHeaderProps) {
  return (
    <div className={cn("page-header", align === "left" && "lg:justify-start", className)}>
      <div>
        <h2 className="page-title">{title}</h2>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
