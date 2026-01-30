import * as React from "react";
import { cn } from "@/lib/utils";

type GradientVariant = "primary" | "success" | "warning";
type GradientElement = "h1" | "h2" | "h3" | "h4" | "span" | "p";

interface GradientTextProps {
  children: React.ReactNode;
  variant?: GradientVariant;
  animated?: boolean;
  as?: GradientElement;
  className?: string;
}

const variantClasses: Record<GradientVariant, string> = {
  primary: "gradient-text-primary",
  success: "gradient-text-success",
  warning: "gradient-text-warning",
};

/**
 * GradientText - Premium gradient text component for titles and headings
 *
 * Variants:
 * - primary: Rose to Gold gradient (default)
 * - success: Green to Teal gradient
 * - warning: Orange to Yellow gradient
 *
 * @example
 * <GradientText as="h1" variant="primary" animated>
 *   Premium Title
 * </GradientText>
 */
export function GradientText({
  children,
  variant = "primary",
  animated = false,
  as: Component = "span",
  className,
}: GradientTextProps) {
  return (
    <Component
      className={cn(
        variantClasses[variant],
        animated && "gradient-text-animated",
        className
      )}
    >
      {children}
    </Component>
  );
}

export { type GradientTextProps, type GradientVariant, type GradientElement };
