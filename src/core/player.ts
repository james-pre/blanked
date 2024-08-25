import type { EntityJSON } from './entity';
import { Entity } from './entity';

export interface PlayerJSON extends EntityJSON {
	_: null;
	// Nothing
}

export class Player extends Entity {
	public get owner(): this {
		return this;
	}

	public update(): void {
		this.velocity.scaleInPlace(0.9);
	}
}
