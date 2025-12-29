import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  text?: string;
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

const textSizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};

export function LoadingSpinner({ 
  size = "md", 
  className,
  text,
  fullScreen = false 
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={cn(
      "flex flex-col items-center justify-center gap-3",
      fullScreen && "min-h-screen",
      className
    )}>
      <Loader2 className={cn(
        "animate-spin text-primary",
        sizeClasses[size]
      )} />
      {text && (
        <p className={cn(
          "text-muted-foreground animate-pulse",
          textSizeClasses[size]
        )}>
          {text}
        </p>
      )}
    </div>
  );

  return spinner;
}
