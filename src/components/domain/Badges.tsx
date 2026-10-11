import { Badge, StatusDot, type Tone } from "@/components/ui";
import type { MemberStatus, ShowStatus } from "@/types";

const show: Record<ShowStatus, [string, Tone]> = {
  upcoming: ["Upcoming", "info"],
  completed: ["Completed", "neutral"],
  cancelled: ["Cancelled", "danger"],
};

export function ShowStatusBadge({ status }: { status: ShowStatus }) {
  const [label, tone] = show[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const member: Record<MemberStatus, [string, Tone]> = {
  active: ["Active", "ok"],
  trainee: ["Trainee", "violet"],
  graduated: ["Graduated", "neutral"],
};

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  const [label, tone] = member[status];
  return <Badge tone={tone}>{label}</Badge>;
}

/** "Live" marker: pulsing diamond + text, never color alone. */
export function LiveDot({ label = "Live" }: { label?: string }) {
  return <StatusDot tone="danger" label={label} pulse />;
}
