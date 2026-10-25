// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TheaterPlayer } from "../src/components/domain/TheaterPlayer";

const mock = vi.hoisted(() => ({ instances: [] as Array<{
  loadingEnabled: boolean; liveSyncPosition: number; startLoad: ReturnType<typeof vi.fn>;
  stopLoad: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; config: Record<string, unknown>;
}> }));
vi.mock("hls.js", () => ({ default: class {
  static isSupported = () => true;
  static Events = { MANIFEST_PARSED: "manifest", LEVEL_SWITCHED: "level", FRAG_LOADED: "fragment", ERROR: "error" };
  static ErrorTypes = { NETWORK_ERROR: "network", MEDIA_ERROR: "media" };
  loadingEnabled = true;
  liveSyncPosition = 40;
  startLoad = vi.fn(); stopLoad = vi.fn(); destroy = vi.fn();
  loadSource = vi.fn(); attachMedia = vi.fn(); on = vi.fn();
  constructor(public config: Record<string, unknown>) { mock.instances.push(this); }
} }));
let root: Root;
let host: HTMLDivElement;
let fatal: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.useFakeTimers();
  mock.instances.length = 0;
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  host = document.createElement("div"); document.body.append(host);
  root = createRoot(host); fatal = vi.fn();
  await act(async () => root.render(createElement(TheaterPlayer, {
    playback: { playlistUrl: "/stream.m3u8", qualities: [] }, title: "Theater", onFatal: fatal,
  })));
  const video = host.querySelector("video")!;
  Object.defineProperty(video, "paused", { configurable: true, value: false });
  Object.defineProperty(video, "buffered", { configurable: true, value: { length: 0 } });
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks();
});
it("does not abort or replace a slow in-flight download at 6, 14 or 30 seconds", async () => {
  const hls = mock.instances[0];
  await act(async () => vi.advanceTimersByTime(32_000));
  expect(hls.startLoad).not.toHaveBeenCalled();
  expect(hls.stopLoad).not.toHaveBeenCalled();
  expect(hls.destroy).not.toHaveBeenCalled();
  expect(host.querySelector("video")!.currentTime).toBe(0);
  expect(fatal).not.toHaveBeenCalled();
  expect(hls.config.capLevelOnFPSDrop).toBe(true);
  await act(async () => vi.advanceTimersByTime(32_000));
  expect(fatal).toHaveBeenCalledTimes(1);
});
it("restarts a stopped loader rather than an active loader", async () => {
  const hls = mock.instances[0]; hls.loadingEnabled = false;
  await act(async () => vi.advanceTimersByTime(8_000));
  expect(hls.startLoad).toHaveBeenCalledTimes(1);
});
it("can jump to an already buffered live point without aborting the loader", async () => {
  const hls = mock.instances[0];
  Object.defineProperty(host.querySelector("video")!, "buffered", { configurable: true, value: {
    length: 1, start: () => 0, end: () => 45,
  } });
  await act(async () => vi.advanceTimersByTime(16_000));
  expect(host.querySelector("video")!.currentTime).toBe(40);
  expect(hls.stopLoad).not.toHaveBeenCalled();
  expect(hls.startLoad).not.toHaveBeenCalled();
});
