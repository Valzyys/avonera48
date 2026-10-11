import { PlatformMark, StreamThumb } from "@/components/media/Media";
import { LiveFor } from "./Cards";
import { Button, Dialog } from "@/components/ui";
import { api, type LiveItem } from "@/services";
import { formatDateTime, formatDuration, formatRelative } from "@/utils/format";
import { Link } from "react-router";

/**
 * Stream details + the outbound action. When the source has no stream URL the
 * "Open" action is disabled with an explanation instead of linking somewhere
 * that does not exist.
 */
export function StreamDialog({ stream, onClose }: { stream: LiveItem | null; onClose: () => void }) {
  const live = stream?.status === "live";
  // Prefer the stream's own link, then a replay, then the member's room on that platform.
  const room = stream && (stream.platform === "IDN Live" ? (stream.member.idnUsername ? `https://www.idn.app/${stream.member.idnUsername}` : null) : stream.member.socials.find((x) => x.title === "SHOWROOM")?.url);
  const href = stream ? (stream.url ?? (live ? room : stream.replayUrl)) : null;
  return (
    <Dialog
      open={!!stream}
      onClose={onClose}
      title={stream ? stream.title : ""}
      description={stream && `${stream.member.name} · ${stream.platform}`}
      footer={
        stream && (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {href ? (
              <a className="btn btn--primary btn--md" href={href} target="_blank" rel="noreferrer noopener">
                <span className="btn__label">{live ? `Open on ${stream.platform}` : "Watch replay"}</span>
              </a>
            ) : (
              <Button variant="primary" disabled title="The source has no link for this stream">
                {live ? `Watch on ${stream.platform}` : "No replay available"}
              </Button>
            )}
          </>
        )
      }
    >
      {stream && (
        <div className="stream-dialog">
          <div className="stream-dialog__thumb">
            <StreamThumb stream={stream} member={stream.member} />
          </div>
          <dl className="def-list">
            <div>
              <dt>Status</dt>
              <dd>{live ? <>Live for <LiveFor since={stream.startedAt} /></> : `Ended ${formatRelative(stream.endedAt!, api.now)}`}</dd>
            </div>
            <div>
              <dt>Platform</dt>
              <dd>
                <PlatformMark platform={stream.platform} />
              </dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>{formatDateTime(stream.startedAt)} WIB</dd>
            </div>
            {stream.endedAt && (
              <div>
                <dt>Duration</dt>
                <dd>{formatDuration(stream.startedAt, stream.endedAt)}</dd>
              </div>
            )}
            {stream.viewers !== undefined && (
              <div>
                <dt>{live ? "Viewers" : "Peak viewers"}</dt>
                <dd className="t-mono">{stream.viewers.toLocaleString("en-US")}</dd>
              </div>
            )}
            <div>
              <dt>Member</dt>
              <dd>
                <Link to={`/members/${stream.member.slug}`} viewTransition onClick={onClose} className="link">
                  {stream.member.name}
                </Link>
              </dd>
            </div>
          </dl>
          <p className="meta">From a sample jkt48connect.com response, replayed at 23:20 WIB on 10 Oct 2026.</p>
        </div>
      )}
    </Dialog>
  );
}
