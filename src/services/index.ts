import { snapshotService } from "./snapshotService";
import type { DataService } from "./types";

/**
 * The active data adapter: sample responses from the jkt48connect.com API,
 * replayed at a fixed instant. A live adapter implementing `DataService`
 * (calling the API through the Worker, key kept server-side) can be swapped
 * in here without touching pages or components.
 */
export const api: DataService = snapshotService;

export * from "./types";
