import { CopyButton } from "@/components/ui";

/** Copies the current page URL (read at click time) — handy for sharing a show or profile in a group chat. */
export function ShareButton() {
  return <CopyButton value="" what="Link" label="Copy link" showLabel size="md" />;
}
