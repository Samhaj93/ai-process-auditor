import type { BottleneckType, Severity, WasteCategory } from "@/lib/schema";

export const WASTE_LABEL: Record<WasteCategory, string> = {
  defects: "Defects",
  overproduction: "Overproduction",
  waiting: "Waiting",
  "non-utilised-talent": "Non-utilised talent",
  transportation: "Transportation",
  inventory: "Inventory",
  motion: "Motion",
  "extra-processing": "Extra-processing",
};

export const BOTTLENECK_LABEL: Record<BottleneckType, string> = {
  capacity: "capacity",
  handoff: "handoff",
  approval: "approval",
  "rework-loop": "rework loop",
  system: "system",
  information: "information",
};

/** High and critical findings carry the accent; lower ones stay quiet. */
export function isSevere(severity: Severity): boolean {
  return severity === "high" || severity === "critical";
}
