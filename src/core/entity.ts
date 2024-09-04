import type { IVector3Like } from '@babylonjs/core/Maths/math.like';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { EventEmitter } from 'eventemitter3';
import { assignWithDefaults, pick, randomHex, resolveConstructors } from 'utilium';
import { component, type Component } from './component';
import type { Level } from './level';
import { findPath } from './path';

export interface EntityJSON {
	id: string;
	name: string;
	owner?: string;
	parent?: string;
	entityType: string;
	position: [number, number, number];
	rotation: [number, number, number];
	velocity: [number, number, number];
}

const copy = ['id', 'name', 'entityType'] as const satisfies ReadonlyArray<keyof Entity>;

@component
export class Entity
	extends EventEmitter<{
		update: [];
		created: [];
	}>
	implements Component<EntityJSON>
{
	public get [Symbol.toStringTag](): string {
		return this.constructor.name;
	}

	public name: string = '';

	public get entityType(): string {
		return this.constructor.name;
	}

	public get entityTypes(): string[] {
		return resolveConstructors(this);
	}

	public isType<T extends Entity>(...types: string[]): this is T {
		return types.some(type => this.entityTypes.includes(type));
	}

	public parent?: Entity;

	protected _owner?: Entity;
	public get owner(): Entity | undefined {
		return this._owner;
	}

	public set owner(value: Entity | undefined) {
		this._owner = value;
	}

	/**
	 * Used by path finding to check for collisions
	 * @internal
	 */
	public _pathRadius: number = 1;

	public position: Vector3 = Vector3.Zero();
	public rotation: Vector3 = Vector3.Zero();
	public velocity: Vector3 = Vector3.Zero();

	public get absolutePosition(): Vector3 {
		return this.parent instanceof Entity ? this.parent.absolutePosition.add(this.position) : this.position;
	}

	public get absoluteRotation(): Vector3 {
		return this.parent instanceof Entity ? this.parent.absoluteRotation.add(this.rotation) : this.rotation;
	}

	public get absoluteVelocity(): Vector3 {
		return this.parent instanceof Entity ? this.parent.absoluteVelocity.add(this.rotation) : this.rotation;
	}

	public constructor(
		public id: string = randomHex(32),
		public readonly level: Level
	) {
		super();
		this.id ||= randomHex(32);
		level.entities.add(this);

		setTimeout(() => this.emit('created'));
	}

	public update() {
		if (Math.abs(this.rotation.y) > Math.PI) {
			this.rotation.y += Math.sign(this.rotation.y) * 2 * Math.PI;
		}

		this.position.addInPlace(this.velocity);
		this.emit('update');
	}

	public remove() {
		this.level.entities.delete(this);
		this.level.emit('entity_removed', this.toJSON());
	}

	/**
	 * @param target The position the entity should move to
	 * @param isRelative Wheter the target is a change to the current position (i.e. a "delta" vector) or absolute
	 */
	public moveTo(target: IVector3Like, isRelative = false) {
		const { x, y, z } = target;
		const path = findPath(this.absolutePosition, new Vector3(x, y, z).add(isRelative ? this.absolutePosition : Vector3.Zero()));
		if (!path.length) {
			return;
		}
		this.level.emit(
			'entity_path_start',
			this.id,
			path.map(({ x, y, z }) => ({ x, y, z }))
		);
		this.position = path.at(-1)!.subtract(this.parent?.absolutePosition || Vector3.Zero());
		const rotation = Vector3.PitchYawRollToMoveBetweenPoints(path.at(-2)!, path.at(-1)!);
		rotation.x -= Math.PI / 2;
		this.rotation = rotation;
	}

	public toJSON(): EntityJSON {
		return {
			...pick(this, copy),
			owner: this.owner?.id,
			parent: this.parent?.id,
			position: this.position.asArray(),
			rotation: this.rotation.asArray(),
			velocity: this.velocity.asArray(),
		};
	}

	public fromJSON(data: Partial<EntityJSON>): void {
		assignWithDefaults(this as Entity, {
			...pick(data, copy),
			position: data.position && Vector3.FromArray(data.position),
			rotation: data.rotation && Vector3.FromArray(data.rotation),
			velocity: data.velocity && Vector3.FromArray(data.velocity),
			parent: data.parent ? this.level.getEntityByID(data.parent) : undefined,
			owner: data.owner ? this.level.getEntityByID(data.owner) : undefined,
		});
	}

	public static FromJSON(data: Partial<EntityJSON>, level: Level): Entity {
		const entity = new this(data.id, level);
		entity.fromJSON(data);
		return entity;
	}
}

export function filterEntities(entities: Iterable<Entity>, selector: string): Set<Entity> {
	if (typeof selector != 'string') {
		throw new TypeError('selector must be of type string');
	}

	if (selector == '*') {
		return new Set(entities);
	}

	const selected = new Set<Entity>();
	for (const entity of entities) {
		switch (selector[0]) {
			case '@':
				if (entity.name == selector.slice(1)) selected.add(entity);
				break;
			case '#':
				if (entity.id == selector.slice(1)) selected.add(entity);
				break;
			case '.':
				for (const type of entity.entityTypes) {
					if (type.toLowerCase().includes(selector.slice(1).toLowerCase())) {
						selected.add(entity);
					}
				}
				break;
			default:
				throw new Error('Invalid selector');
		}
	}
	return selected;
}
