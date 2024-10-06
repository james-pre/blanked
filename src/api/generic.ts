/**
 * Miscellaneous code
 */

/**
 * Access level for information
 */
export enum Access {
	PRIVATE = 0,
	PROTECTED = 1,
	PUBLIC = 2,
}

/**
 * A response to an API request
 */
export interface Response<Result> {
	/**
	 * The HTTP status of the response
	 */
	status: number;

	/**
	 * The HTTP status' text
	 */
	statusText: string;

	/**
	 * Whether the request failed (true) or not (false)
	 */
	error: boolean;

	/**
	 * The result of the request.
	 *
	 * @remarks
	 * If the request fails, result will contain the error message
	 */
	result: Result;
}

export interface Metadata {
	/**
	 * Current API version
	 */
	version: string;

	/**
	 * Whether the API has debug features enabled
	 */
	debug: boolean;
}
