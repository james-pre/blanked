import type { EntityJSON } from './entity';
import { Entity } from './entity';

export type PlayerJSON = EntityJSON;

export class Player extends Entity {
	public get owner(): this {
		return this;
	}

	public update(): void {
		this.velocity.scaleInPlace(0.9);
	}
}
