import { HeartPulse, LayoutDashboard, ListChecks, MessagesSquare } from "@jordiorriols/ui/icons";

/** The four sections from DEFINITION.md, in navigation order. */
export const SECTIONS = [
  { id: "overview", path: "/", icon: LayoutDashboard },
  { id: "teamPulse", path: "/team-pulse", icon: HeartPulse },
  { id: "retrospectives", path: "/retrospectives", icon: MessagesSquare },
  { id: "actions", path: "/actions", icon: ListChecks },
] as const;

export type Section = (typeof SECTIONS)[number];
