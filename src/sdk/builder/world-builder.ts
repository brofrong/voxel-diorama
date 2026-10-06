import type { Material, Vec3 } from '../../engine/types.ts';
import { MAX_MATERIALS } from '../../engine/voxel/constants.ts';
import { VoxelWorld } from '../../engine/voxel/world.ts';
import { ANCHOR_NAME_RE, rotateFootprint } from '../anchors.ts';
import { AIR, materialSignature } from '../materials.ts';
import { createNoise2D, type Noise2D } from '../noise.ts';
import { createRng, type Rng } from '../rng.ts';
import { VoxelCanvas } from './canvas.ts';
import { type Model, modelIndex } from './model.ts';

export type Rotation = 0 | 90 | 180 | 270;
export type TerrainNoise = 'flat' | 'hills' | 'mountains';

export interface TerrainOptions {
	noise?: TerrainNoise;
	/** Средняя высота поверхности. По умолчанию — четверть высоты мира. */
	base?: number;
	/** Размах высот вокруг base. */
	amp?: number;
	/** Частота шума: меньше — шире холмы. */
	scale?: number;
	top: string;
	fill: string;
}

export interface WaterOptions {
	/** Вода заполняет пустоту на y ≤ level. */
	level: number;
	material?: string;
}

export interface PlaceOptions {
	rotate?: Rotation;
	/** Если задано — якоря модели регистрируются в мире как `<name>.<якорь>`. */
	name?: string;
}

export interface Placed {
	/** Якоря модели в мировых координатах. */
	anchors: Record<string, Vec3>;
}

export type ModelSource = Model | ((options: { rng: Rng }) => Model);

export interface ScatterOptions {
	count: number;
	/** Материал(ы) поверхности, на которую можно ставить. */
	on?: string | string[];
	minDistance?: number;
	/** [x0, z0, x1, z1] включительно. По умолчанию — весь мир. */
	area?: [number, number, number, number];
}

const TERRAIN_PRESETS: Record<TerrainNoise, { amp: number; scale: number; octaves: number }> = {
	flat: { amp: 0, scale: 1, octaves: 1 },
	hills: { amp: 10, scale: 1 / 40, octaves: 4 },
	mountains: { amp: 28, scale: 1 / 64, octaves: 5 },
};

export const DEFAULT_WATER: Material = { color: '#3a7bd5', emissive: 0, kind: 'water' };

const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

/** Строитель мира диорамы — объект `w` в `build(w)`. */
export class WorldBuilder extends VoxelCanvas {
	readonly world: VoxelWorld;
	readonly size: Vec3;
	readonly rng: Rng;
	readonly noise: Noise2D;
	/** Сколько записей отброшено из-за выхода за границы мира. */
	outOfBounds = 0;

	private readonly materials: Material[] = [];
	private readonly names: string[] = [];
	private readonly byName = new Map<string, number>();
	private readonly bySignature = new Map<string, number>();
	private readonly paletteNames: ReadonlySet<string>;
	private readonly anchorMap = new Map<string, Vec3>();

	constructor(size: Vec3, palette: Record<string, Material>, seed: number) {
		super();
		this.size = [size[0], size[1], size[2]];
		this.world = new VoxelWorld(this.size);
		this.rng = createRng(seed);
		this.noise = createNoise2D(seed ^ 0x5bd1e995);
		for (const [name, material] of Object.entries(palette)) {
			this.byName.set(name, this.push(name, material));
		}
		this.paletteNames = new Set(Object.keys(palette));
	}

	/** Материалы в порядке индексов: материал i хранится как i + 1. */
	get materialList(): readonly Material[] {
		return this.materials;
	}

	get materialNames(): readonly string[] {
		return this.names;
	}

	/** Все якоря мира (копия). */
	get anchors(): Record<string, Vec3> {
		return Object.fromEntries([...this.anchorMap].map(([k, p]) => [k, [p[0], p[1], p[2]]]));
	}

	/** Регистрирует именованную точку мира (`well`, `bridge`). */
	anchor(name: string, position: Vec3): void {
		if (!ANCHOR_NAME_RE.test(name)) {
			throw new Error(`имя якоря "${name}": латиница с маленькой буквы, без точек`);
		}
		this.registerAnchor(name, position);
	}

	private registerAnchor(name: string, p: Vec3): void {
		if (this.anchorMap.has(name)) throw new Error(`якорь "${name}" уже есть`);
		this.anchorMap.set(name, [p[0], p[1], p[2]]);
	}

	protected write(x: number, y: number, z: number, index: number): void {
		if (!this.world.set(x, y, z, index)) this.outOfBounds++;
	}

	protected resolve(material: string): number {
		if (material === AIR) return 0;
		const id = this.byName.get(material);
		if (id === undefined) {
			const known = [...this.paletteNames].join(', ') || '(пусто)';
			throw new Error(`неизвестный материал "${material}". В палитре: ${known}`);
		}
		return id;
	}

	private push(name: string, material: Material): number {
		if (this.materials.length >= MAX_MATERIALS) {
			throw new Error(
				`слишком много материалов (максимум ${MAX_MATERIALS}) — сократите палитру или число вариантов префабов`,
			);
		}
		this.materials.push(material);
		this.names.push(name);
		return this.materials.length;
	}

	/** Палитра диорамы переопределяет одноимённый материал префаба; остальные дедуплицируются. */
	private resolveModelMaterial(name: string, material: Material): number {
		if (this.paletteNames.has(name)) return this.resolve(name);
		const signature = materialSignature(name, material);
		const known = this.bySignature.get(signature);
		if (known !== undefined) return known;
		const id = this.push(name, material);
		this.bySignature.set(signature, id);
		return id;
	}

	/** Имя материала в точке; null — пустота или вне мира. */
	get(p: Vec3): string | null {
		const id = this.world.get(Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2]));
		return id === 0 ? null : (this.names[id - 1] ?? null);
	}

	/** y самого верхнего твёрдого (kind 'solid') вокселя в колонке или -1. */
	heightAt(x: number, z: number): number {
		const cx = Math.floor(x);
		const cz = Math.floor(z);
		for (let y = this.size[1] - 1; y >= 0; y--) {
			const id = this.world.get(cx, y, cz);
			if (id !== 0 && this.materials[id - 1]?.kind === 'solid') return y;
		}
		return -1;
	}

	terrain(options: TerrainOptions): void {
		const noiseKind = options.noise ?? 'hills';
		const preset = TERRAIN_PRESETS[noiseKind];
		const amp = options.amp ?? preset.amp;
		const scale = options.scale ?? preset.scale;
		const base = options.base ?? Math.floor(this.size[1] * 0.25);
		const top = this.resolve(options.top);
		const fill = this.resolve(options.fill);
		const [sx, sy, sz] = this.size;
		for (let x = 0; x < sx; x++) {
			for (let z = 0; z < sz; z++) {
				const n = this.noise.fbm(x * scale, z * scale, preset.octaves);
				const h = Math.max(0, Math.min(sy - 1, Math.round(base + amp * (n - 0.5) * 2)));
				for (let y = 0; y < h; y++) this.write(x, y, z, fill);
				this.write(x, h, z, top);
			}
		}
	}

	water(options: WaterOptions): void {
		const name = options.material ?? 'water';
		let id = this.byName.get(name);
		if (id === undefined) {
			if (name !== 'water') id = this.resolve(name);
			else {
				id = this.push('water', DEFAULT_WATER);
				this.byName.set('water', id);
			}
		}
		const [sx, sy, sz] = this.size;
		const level = Math.min(Math.floor(options.level), sy - 1);
		for (let x = 0; x < sx; x++)
			for (let z = 0; z < sz; z++)
				for (let y = 0; y <= level; y++)
					if (this.world.get(x, y, z) === 0) this.world.set(x, y, z, id);
	}

	/** Ставит модель так, что `at` — её нижний центр. Пустота модели не стирает мир. */
	place(source: Model, at: Vec3, options: PlaceOptions = {}): Placed {
		if (source.scale !== 1) {
			throw new Error('модели с scale ≠ 1 ставятся только как сущности (entities), не через place');
		}
		const rotate = options.rotate ?? 0;
		if (!ROTATIONS.includes(rotate)) {
			throw new Error(`rotate должен быть 0, 90, 180 или 270, получено ${rotate}`);
		}
		if (options.name !== undefined && !ANCHOR_NAME_RE.test(options.name)) {
			throw new Error(`имя "${options.name}": латиница с маленькой буквы, без точек`);
		}
		const [sx, sy, sz] = source.size;
		const ids = source.materials.map(({ name, material }) =>
			this.resolveModelMaterial(name, material),
		);
		const sideways = rotate === 90 || rotate === 270;
		const footX = sideways ? sz : sx;
		const footZ = sideways ? sx : sz;
		const ox = Math.floor(at[0]) - Math.floor(footX / 2);
		const oy = Math.floor(at[1]);
		const oz = Math.floor(at[2]) - Math.floor(footZ / 2);
		for (let z = 0; z < sz; z++) {
			for (let y = 0; y < sy; y++) {
				for (let x = 0; x < sx; x++) {
					const local = source.data[modelIndex(source.size, x, y, z)];
					if (local === 0) continue;
					let rx: number;
					let rz: number;
					switch (rotate) {
						case 0:
							rx = x;
							rz = z;
							break;
						case 90:
							rx = sz - 1 - z;
							rz = x;
							break;
						case 180:
							rx = sx - 1 - x;
							rz = sz - 1 - z;
							break;
						case 270:
							rx = z;
							rz = sx - 1 - x;
							break;
						default:
							throw new Error(`rotate должен быть 0, 90, 180 или 270, получено ${rotate}`);
					}
					this.write(ox + rx, oy + y, oz + rz, ids[local - 1]);
				}
			}
		}
		const anchors: Record<string, Vec3> = {};
		for (const [key, p] of Object.entries(source.anchors)) {
			const [rx, rz] = rotateFootprint(p[0], p[2], sx, sz, rotate);
			anchors[key] = [ox + rx, oy + p[1], oz + rz];
			if (options.name !== undefined) this.registerAnchor(`${options.name}.${key}`, anchors[key]);
		}
		return { anchors };
	}

	/** Случайно расставляет модели по поверхности. Возвращает число поставленных. */
	scatter(source: ModelSource, options: ScatterOptions): number {
		const { count, minDistance = 0 } = options;
		const on =
			options.on === undefined
				? null
				: new Set(Array.isArray(options.on) ? options.on : [options.on]);
		for (const name of on ?? []) this.resolve(name);
		const [x0, z0, x1, z1] = options.area ?? [0, 0, this.size[0] - 1, this.size[2] - 1];
		const min2 = minDistance * minDistance;
		const placed: Array<[number, number]> = [];
		let attempts = count * 30;
		while (placed.length < count && attempts > 0) {
			attempts--;
			const x = this.rng.int(x0, x1);
			const z = this.rng.int(z0, z1);
			const h = this.heightAt(x, z);
			if (h < 0 || h + 1 >= this.size[1]) continue;
			if (on && !on.has(this.get([x, h, z]) ?? '')) continue;
			if (this.world.get(x, h + 1, z) !== 0) continue;
			if (placed.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < min2)) continue;
			const m = typeof source === 'function' ? source({ rng: this.rng.fork() }) : source;
			this.place(m, [x, h + 1, z], { rotate: this.rng.pick(ROTATIONS) });
			placed.push([x, z]);
		}
		return placed.length;
	}
}
