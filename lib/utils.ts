import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn-style classname combiner: clsx + tailwind-merge for proper override */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
