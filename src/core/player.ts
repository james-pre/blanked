import type { EntityJSON } from './entity.js';
import { Entity } from './entity.js';

export interface PlayerJSON extends EntityJSON {}

export class Player extends Entity {
	public get owner(): this {
		return this;
	}

	public update(): void {
		this.velocity.scaleInPlace(0.9);
	}
}
