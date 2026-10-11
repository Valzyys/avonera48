import { PlatformMark, StreamThumb } from "@/components/media/Media";
import { LiveFor } from "./Cards";
import { SourceNote } from "./SourceNote";
import { Button, Dialog } from "@/components/ui";
import { api, type LiveItem } from "@/services";
import { formatDateTime, formatDuration, formatRelative } from "@/utils/format";
import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router";

/**
 * Opening a stream: a SHOWROOM live with an on-site player goes straight to
 * its watch page; everything else opens the details dialog.
 */
export function useStreamOpener() {
  const [stream, setStream] = useState<LiveItem | null>(null);
  const navigate = useNavigate();
  const open = useCallback(
    (item: LiveItem | null) => {
      if (item?.status === "live" && item.watchPath) navigate(item.watchPath, { viewTransition: true });
      else setStream(item);
    },
    [navigate],
  );
  return { stream, open, close: useCallback(() => setStream(null), []) };
}

/**
 * Stream details + the outbound action. When the source has no stream URL the
 * "Open" action is disabled with an explanation instead of linking somewhere
 * that does not exist.
 */
export function StreamDialog({ stream, onClose }: { stream: LiveItem | null; onClose: () => void }) {
  const live = stream?.status === "live";
  // Live: the stream's own link, else the member's room on that platform.
  // Finished streams get no outbound button (replays are not linked).
  const room = stream && (stream.platform === "IDN Live" ? (stream.member.idnUsername ? `https://www.idn.app/${stream.member.idnUsername}` : null) : stream.member.socials.find((x) => x.title === "SHOWROOM")?.url);
  const href = stream && live ? (stream.url ?? room) : null;
  const watch = stream && live ? stream.watchPath : undefined;
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
            {watch ? (
              <Link to={watch} viewTransition onClick={onClose} className="btn btn--primary btn--md">
                <span className="btn__label">Watch now</span>
              </Link>
            ) : href ? (
              <a className="btn btn--primary btn--md" href={href} target="_blank" rel="noreferrer noopener">
                <span className="btn__label">Open on {stream.platform}</span>
              </a>
            ) : live ? (
              <Button variant="primary" disabled title="The source has no link for this stream">
                Watch on {stream.platform}
              </Button>
            ) : (
              <Link to={`/recent-live/${encodeURIComponent(stream.id)}`} viewTransition onClick={onClose} className="btn btn--primary btn--md">
                <span className="btn__label">Full stats</span>
              </Link>
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
          <SourceNote />
        </div>
      )}
    </Dialog>
  );
}
