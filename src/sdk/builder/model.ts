import type { Material, Vec3 } from '../../engine/types.ts';
import { MAX_MATERIALS } from '../../engine/voxel/constants.ts';
import { ANCHOR_NAME_RE } from '../anchors.ts';
import { AIR, type MaterialInput, normalizeMaterial } from '../materials.ts';
import { VoxelCanvas } from './canvas.ts';

/** Маленькая воксельная сетка со своей палитрой (префаб, мебель, персонаж…). */
export interface Model {
	readonly size: Vec3;
	/** Локальный индекс i → materials[i - 1]; 0 — пустота. */
	readonly data: Uint8Array;
	readonly materials: ReadonlyArray<{ name: string; material: Material }>;
	/** Размер вокселя модели в единицах мира (1 — как воксели мира). */
	readonly scale: number;
	/** Точка вращения и привязки в координатах модели (вокселях). По умолчанию — нижний центр. */
	readonly pivot: Vec3;
	/** Именованные точки в координатах модели (вокселях). */
	readonly anchors: Readonly<Record<string, Vec3>>;
}

export interface ModelOptions {
	size: Vec3;
	palette: Record<string, MaterialInput>;
	scale?: number;
	pivot?: Vec3;
	anchors?: Record<string, Vec3>;
}

export function isModel(value: unknown): value is Model {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Partial<Model>;
	return (
		Array.isArray(v.size) &&
		v.data instanceof Uint8Array &&
		Array.isArray(v.materials) &&
		typeof v.scale === 'number' &&
		Array.isArray(v.pivot)
	);
}

export const modelIndex = (size: Vec3, x: number, y: number, z: number): number =>
	x + size[0] * (y + size[1] * z);

export class ModelBuilder extends VoxelCanvas {
	readonly size: Vec3;
	readonly scale: number;
	readonly pivot: Vec3;
	private readonly anchors: Record<string, Vec3>;
	private readonly data: Uint8Array;
	private readonly names: string[];
	private readonly materials: Material[];

	constructor(options: ModelOptions) {
		super();
		for (const s of options.size) {
			if (!Number.isInteger(s) || s < 1 || s > 256) {
				throw new Error(
					`размер модели должен быть целым 1..256, получено [${options.size.join(', ')}]`,
				);
			}
		}
		this.size = [options.size[0], options.size[1], options.size[2]];
		const scale = options.scale ?? 1;
		if (!(Number.isFinite(scale) && scale > 0 && scale <= 1)) {
			throw new Error(`scale модели должен быть в (0, 1], получено ${scale}`);
		}
		this.scale = scale;
		this.pivot = options.pivot
			? [options.pivot[0], options.pivot[1], options.pivot[2]]
			: [this.size[0] / 2, 0, this.size[2] / 2];
		this.anchors = {};
		for (const [name, p] of Object.entries(options.anchors ?? {})) {
			if (!ANCHOR_NAME_RE.test(name)) {
				throw new Error(`имя якоря "${name}": латиница с маленькой буквы, без точек`);
			}
			this.anchors[name] = [p[0], p[1], p[2]];
		}
		this.data = new Uint8Array(this.size[0] * this.size[1] * this.size[2]);
		this.names = Object.keys(options.palette);
		if (this.names.length > MAX_MATERIALS) throw new Error('модель: больше 255 материалов');
		this.materials = this.names.map((name) => normalizeMaterial(options.palette[name]));
	}

	protected write(x: number, y: number, z: number, index: number): void {
		const [sx, sy, sz] = this.size;
		if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return;
		this.data[modelIndex(this.size, x, y, z)] = index;
	}

	protected resolve(material: string): number {
		if (material === AIR) return 0;
		const i = this.names.indexOf(material);
		if (i < 0) {
			throw new Error(
				`модель: неизвестный материал "${material}". Доступны: ${this.names.join(', ')}`,
			);
		}
		return i + 1;
	}

	get(p: Vec3): string | null {
		const [x, y, z] = [Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2])];
		const [sx, sy, sz] = this.size;
		if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return null;
		const id = this.data[modelIndex(this.size, x, y, z)];
		return id === 0 ? null : (this.names[id - 1] ?? null);
	}

	toModel(): Model {
		return {
			size: this.size,
			data: this.data,
			materials: this.names.map((name, i) => ({ name, material: this.materials[i] })),
			scale: this.scale,
			pivot: this.pivot,
			anchors: this.anchors,
		};
	}
}

export function model(options: ModelOptions, draw: (m: ModelBuilder) => void): Model {
	const builder = new ModelBuilder(options);
	draw(builder);
	return builder.toModel();
}
