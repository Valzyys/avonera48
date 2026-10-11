/** Cloudflare Pages Function: the same /media/* image proxy the Worker uses. */
import { handle, type Env } from "../../worker/handlers";

export const onRequest: PagesFunction<Env> = async (context) => (await handle(context.request, context.env, context)) ?? context.next();
