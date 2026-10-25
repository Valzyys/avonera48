# Theater playback stability

The October 25 investigation started from upstream main `461b381`, including
its buffering/retry and navigation changes. Those settings remain in place.

Two client/proxy interactions could cause unnecessary rebuffering:

- The 6-second watchdog called `hls.startLoad()` while a fragment was still
  downloading. HLS stream-controller `startLoad()` calls `stopLoad()` first,
  aborting that fragment. The 14-second recovery also stopped loading and sought
  to a live position even when there was no buffered data there. These deadlines
  preceded the configured fragment download/retry window.
- AES-GCM references used a fresh IV each time the same upstream URI appeared
  in a playlist refresh. The resulting different key URI defeats hls.js's
  URI-indexed key cache; overlapping media/init URLs also lose browser reuse.

The watchdog now restarts only a stopped loader and jumps only to a buffered
live position. It still falls back to session reconnection after 60 seconds of
no playback progress (previously 30). Fatal network/media errors keep their
existing handling. The longer watchdog window lets a slow segment finish, but
can delay the fallback for a completely hung player. Media recovery counters
reset on playback progress rather than on a successful fragment download.

Auto quality now enables hls.js FPS-drop capping so a browser with fast network
but insufficient decoding capacity can reduce quality. This does not change
explicit user quality selection.

Media references reuse their already encrypted value in a bounded per-viewer
LRU (256 references, at most 64 codecs per isolate). New encryptions continue
using random IVs. References remain opaque, authenticated and viewer-bound;
old references still decrypt after eviction. Cache reuse is best effort and
ends with isolate replacement or eviction. No media is shared across viewers,
no public segment caching is added, and credentials remain server-side.

Validation includes mounted-player tests with a stalled clock/download,
sliding playlist key/segment identity, cache eviction, concurrency, reference
tampering/viewer isolation, and repeated playlists through the Worker proxy.
These are local simulated tests, not measurements of a particular live show.
The environment does not allow the production/partner hosts, so upstream RTT,
real rebuffer rate, codec/FPS and desktop/mobile differences still require
measurement during an authorized live playback session after deployment.
