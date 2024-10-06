/**
 * The current token used for authenication
 */
export let authToken: string;

/**
 * Sets the authenication token
 * @param token the new token
 */
export function auth(token: string): void {
	authToken = token;
}
