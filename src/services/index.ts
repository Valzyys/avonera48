import { mockService } from "./mockService";
import type { DataService } from "./types";

/**
 * The active data adapter. During the UI phase this is always the preview
 * (mock) adapter. A real source implementing `DataService` can be swapped in
 * here without touching pages or components.
 */
export const api: DataService = mockService;

export * from "./types";
