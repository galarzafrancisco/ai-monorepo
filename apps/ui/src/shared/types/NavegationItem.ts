import type { LucideIcon } from "lucide-react";

export interface NavegationItem {
  path: string;
  label: string;
  icon: LucideIcon | string;
}
