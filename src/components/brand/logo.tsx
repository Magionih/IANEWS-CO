import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import logoLight from "@/assets/ianews-logo.png";
import logoDark from "@/assets/ianews-logo-white.png";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
}

const sizeMap = {
  sm: "h-7",
  md: "h-9",
  lg: "h-11",
};

export function Logo({ className, size = "md", onDark = false }: LogoProps) {
  return (
    <Link
      to="/"
      className={cn("group inline-flex shrink-0 items-center", className)}
      aria-label="IA News — página inicial"
    >
      <img
        src={onDark ? logoDark : logoLight}
        alt="IA News"
        className={cn("w-auto object-contain", sizeMap[size])}
      />
    </Link>
  );
}
