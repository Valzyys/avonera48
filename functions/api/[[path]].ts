/** Cloudflare Pages Function: the same /api/* handler the Worker uses. */
import { handle, type Env } from "../../worker/handlers";

export const onRequest: PagesFunction<Env> = async (context) => (await handle(context.request, context.env, context)) ?? context.next();
