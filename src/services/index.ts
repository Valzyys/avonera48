import { dataService } from "./dataService";
import type { DataService } from "./types";

/**
 * The active data adapter: the upstream data API through the Worker
 * proxy (key kept server-side), falling back to a bundled snapshot when the
 * API is not reachable.
 */
export const api: DataService = dataService;
export { dataSource } from "./dataService";

export * from "./types";
