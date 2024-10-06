import type { Request as CFRequest } from '@cloudflare/workers-types';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { AccountType, type Account } from '../accounts';
import { Access, type Response as APIResponse } from '../generic';
import { getAccount } from './api';

export async function parseBody<V extends Record<string, FormDataEntryValue>>(request: Request): Promise<V> {
	switch (request.headers.get('Content-Type')) {
		case 'application/json':
			return request.json();
		case 'application/x-www-form-urlencoded':
			const formData = await request.formData();
			return Object.fromEntries(formData.entries()) as V;
		default:
			const text = await request.text();
			return JSON.parse(text);
	}
}

export function response<R>(status: StatusCodes = StatusCodes.OK, result?: R, error = false): Response {
	const statusText: ReasonPhrases = ReasonPhrases[StatusCodes[status] as keyof typeof ReasonPhrases];

	const body: APIResponse<R | undefined> = { status, statusText, result, error };
	return new Response(JSON.stringify(body), {
		status,
		statusText,
		headers: {
			'access-control-allow-origin': '*',
			'content-type': 'application/json; charset=utf-8',
		},
	});
}

export function error(status: StatusCodes = StatusCodes.INTERNAL_SERVER_ERROR, message?: string): Response {
	return response(status, message, true);
}

export function parseError(err: Error): Response {
	return error(StatusCodes.INTERNAL_SERVER_ERROR, err.message);
}

export interface AuthorizationOptions {
	auth: string | CFRequest;
	requiredType?: AccountType;
	target?: Account;
	allowIfSame?: boolean;
	access?: Access;
	debug?: boolean;
}

export async function auth({
	auth,
	requiredType = AccountType.ACCOUNT,
	target,
	allowIfSame = false,
	access = Access.PROTECTED,
	debug = false,
}: AuthorizationOptions): Promise<Response | void> {
	try {
		if (access == Access.PUBLIC) {
			return;
		}
		if (!auth || auth === null) {
			return error(StatusCodes.UNAUTHORIZED, 'Missing authorization token');
		}
		if (typeof auth != 'string') {
			if (!auth.headers.has('Authorization')) {
				return error(StatusCodes.UNAUTHORIZED, 'Missing authorization header');
			}
			auth = auth.headers.get('Authorization')!;
		}
		if (auth.startsWith('Bearer ')) {
			auth = auth.substring(7);
		}
		if (!auth) {
			return error(StatusCodes.UNAUTHORIZED, 'Missing authorization token');
		}

		const authUser = await getAccount('token', auth);

		if (!authUser && access < Access.PUBLIC) {
			return error(StatusCodes.UNAUTHORIZED, 'Invalid auth token');
		}

		if (authUser.type < Math.max(requiredType, +(target?.type || 0) + 1) && (target?.id != authUser.id || !allowIfSame) && access < Access.PUBLIC) {
			return error(StatusCodes.FORBIDDEN, 'Permission denied');
		}
	} catch (e: any) {
		return error(StatusCodes.INTERNAL_SERVER_ERROR, 'Authorization failed' + (debug && ': ' + e.message));
	}
}

export async function checkAuth(options: AuthorizationOptions): Promise<void> {
	const result = await auth(options);
	if (result) {
		throw result;
	}
}

export function checkParams<B extends Record<string, unknown>>(body: B, ...params: (keyof B & string)[]): void {
	if (typeof body != 'object') {
		throw error(StatusCodes.BAD_GATEWAY, 'Invalid request body');
	}
	for (const param of params) {
		if (!(param in body)) {
			throw error(StatusCodes.BAD_REQUEST, 'Missing in body: ' + param);
		}
	}
}

/**
 * Merges object intersection T.
 * A function type is used so that editors expand the type.
 */
type Merge<T> = ReturnType<() => { [K in keyof T]: T[K] }>;

export async function checkBody<const B>(request: CFRequest, ...params: (keyof B & string)[]): Promise<Partial<Merge<B>>> {
	const contentType = request.headers.get('Content-Type') ?? '';
	if (request.headers.has('Content-Type') && !['text/json', 'application/json'].includes(contentType)) {
		throw error(StatusCodes.BAD_REQUEST, 'Content-Type "' + contentType + '" not supported');
	}
	let body: Partial<Merge<B>>;
	try {
		body = await request.json();
	} catch (e) {
		throw error(StatusCodes.BAD_REQUEST, 'Missing request body');
	}

	checkParams(body, ...params);
	return body;
}

export async function getAccountFromTokenOrID<const B extends { id?: string; token?: string }>(body: B): Promise<Account> {
	if (!(body.id || body.token)) {
		throw error(StatusCodes.BAD_REQUEST, 'Missing id or token');
	}

	const targetUser = await getAccount(body.token ? 'token' : 'id', (body.token || body.id)!);

	if (!targetUser) {
		throw error(StatusCodes.NOT_FOUND, 'Target user does not exist');
	}

	return targetUser;
}

export async function onRequestOptions() {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': '*',
			'Access-Control-Allow-Methods': '*',
			'Access-Control-Max-Age': '86400',
		},
	});
}
