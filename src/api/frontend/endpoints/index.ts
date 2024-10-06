import { request, type Metadata } from '../index.js';

export * from './account.js';

/**
 * Get metadata about the API
 */
export function metadata(): Promise<Metadata> {
	return request('GET', '/metadata');
}
