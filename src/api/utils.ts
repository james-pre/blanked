/**
 * { a: b, c: d } -> [a, b] | [c, d]
 */
export type KeyValue<T> = {
	[K in keyof T]: [K, T[K]];
}[keyof T] &
	[unknown, unknown];
