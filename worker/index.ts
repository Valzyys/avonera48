/**
 * AVONERA48 Worker entry. Static assets (the React app) are served by the
 * Workers assets layer; /api/* and /media/* run through ./handlers.
 */
import { handle, type Env } from "./handlers";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return (await handle(request, env, ctx)) ?? env.ASSETS!.fetch(request);
  },
} satisfies ExportedHandler<Env>;
