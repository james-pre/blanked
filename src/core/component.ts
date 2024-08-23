import type { Level } from './level.js';
import { logger } from './utils.js';

export interface Component<TJSON = unknown> {
	readonly id?: string;

	update?(): void;

	toJSON(): TJSON;

	fromJSON(data: TJSON): void;
}

export type ComponentData<T extends Component> = T extends Component<infer TJSON> ? TJSON : never;

export interface ComponentStatic<T extends Component = Component> {
	name: string;

	FromJSON(data: ComponentData<T>, level?: Level): T;
}

export const components = new Map<string, ComponentStatic>();

export function component<Class extends ComponentStatic>(target: Class) {
	logger.debug('Registered component: ' + target.name);
	components.set(target.name, target);
}
