import { Entity, type EntityJSON } from './entity.js';
import { component } from './component.js';

export interface GroupJSON extends EntityJSON {
	members: string[];
}

@component
export class Group<T extends Entity, TOwner extends Entity = Entity> extends Entity {
	protected entities: Set<T> = new Set();

	declare parent: TOwner;

	public get owner(): TOwner {
		return this.parent;
	}

	public set owner(value: TOwner) {
		this.parent = value;
	}

	public get size() {
		return this.entities.size;
	}

	public add(value: T): this {
		value.owner = this.owner;
		value.parent = this;
		this.entities.add(value);
		return this;
	}

	public clear(): void {
		this.entities.clear();
	}

	public delete(value: T): boolean {
		return this.entities.delete(value);
	}

	public has(value: T): boolean {
		return this.entities.has(value);
	}

	[Symbol.iterator](): IterableIterator<T> {
		return this.entities[Symbol.iterator]();
	}

	public at(index: number): T {
		if (Math.abs(index) >= this.size) {
			throw new ReferenceError('Invalid index in fleet: ' + index);
		}

		return [...this].at(index)!;
	}

	public toJSON(): GroupJSON {
		return {
			...super.toJSON(),
			members: Array.from(this).map(s => s.id),
		};
	}

	// NOTE: The member's fromJSON should add the member to the group
}
