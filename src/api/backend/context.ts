import type { D1Database, EventContext } from '@cloudflare/workers-types';

export interface Env {
	DB: D1Database;
	DEBUG: boolean;
}

export type RequestContext<Params extends string = string, Data = unknown> = EventContext<Env, Params, Data>;
