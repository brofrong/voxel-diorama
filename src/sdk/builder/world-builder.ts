import type { Material, Vec3 } from '../../engine/types.ts';
import { MAX_MATERIALS } from '../../engine/voxel/constants.ts';
import { VoxelWorld } from '../../engine/voxel/world.ts';
import { ANCHOR_NAME_RE, rotateFootprint } from '../anchors.ts';
import { AIR, materialSignature } from '../materials.ts';
import { createNoise2D, createNoise3D, type Noise2D } from '../noise.ts';
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

type Area = [number, number, number, number];

export interface GrowOptions {
	/** Материал(ы) поверхности, на которой растёт. */
	on: string | string[];
	/** [x0, z0, x1, z1] включительно. По умолчанию — весь мир. */
	area?: Area;
	/** Доля подходящих клеток поверхности, 0..1. */
	density?: number;
}

export interface GrassOptions extends GrowOptions {
	/** Высота пучка [мин, макс] в вокселях. По умолчанию [1, 1]. */
	height?: [number, number];
}

export interface FlowersOptions extends GrowOptions {
	/** Материал стебля: цветок поднимается на воксель выше. По умолчанию без стебля. */
	stem?: string;
}

export interface MossOptions {
	/** Что обрастает мхом (камень, стены, крыши). */
	on: string | string[];
	area?: Area;
	/** Доля открытой поверхности под мхом, 0..1. По умолчанию 0.4. */
	amount?: number;
	/** Размер пятен в вокселях. По умолчанию 5. */
	scale?: number;
}

export interface VinesOptions {
	/** От чего свисают: низ крон, карнизы, низ острова. */
	from: string | string[];
	area?: Area;
	/** Доля подходящих нижних граней, 0..1. По умолчанию 0.15. */
	density?: number;
	/** Длина [мин, макс] в вокселях. По умолчанию [2, 6]. */
	length?: [number, number];
}

export interface IslandOptions {
	/** Центр в плане [x, z]. */
	center: [number, number];
	/** Радиус верха в вокселях. */
	radius: number;
	/** Средняя высота поверхности (y). */
	top: number;
	/** Глубина «корня» острова под поверхностью. По умолчанию radius × 1.1. */
	depth?: number;
	/** Неровность контура 0..0.6. По умолчанию 0.3. */
	roughness?: number;
	/** Холмистость верха в вокселях. По умолчанию 3. */
	hills?: number;
	/** Верхний слой (трава), почва под ним и камень корня. */
	surface: string;
	soil: string;
	rock: string;
	/** Толщина почвы. По умолчанию 3. */
	soilDepth?: number;
	/** Сколько каменных «сосулек» свисает снизу. По умолчанию radius / 2. */
	spikes?: number;
	/** Якоря `<name>.top` (над центром поверхности) и `<name>.bottom` (кончик корня). */
	name?: string;
}

export interface IslandInfo {
	/** y поверхности в центре. */
	top: number;
	/** Самый нижний y острова. */
	bottom: number;
}

export interface WaterfallOptions {
	/** Верхняя точка струи (обычно у края острова/скалы, снаружи). */
	at: Vec3;
	/** Ширина струи по x и z: [wx, wz]. По умолчанию [2, 1]. */
	width?: [number, number];
	/** Докуда падает (y); по умолчанию — до первого твёрдого вокселя или дна мира. */
	to?: number;
	material?: string;
	/** Якоря `<name>.top` и `<name>.bottom` — для частиц `pour` и `mist`. */
	name?: string;
}

const TERRAIN_PRESETS: Record<TerrainNoise, { amp: number; scale: number; octaves: number }> = {
	flat: { amp: 0, scale: 1, octaves: 1 },
	hills: { amp: 10, scale: 1 / 40, octaves: 4 },
	mountains: { amp: 28, scale: 1 / 64, octaves: 5 },
};

export const DEFAULT_WATER: Material = { color: '#3a7bd5', emissive: 0, kind: 'water', vary: 0 };

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

	protected read(x: number, y: number, z: number): number {
		return this.world.get(x, y, z);
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

	/** Материал воды: из палитры или встроенный `water`. */
	private waterId(name = 'water'): number {
		let id = this.byName.get(name);
		if (id === undefined) {
			if (name !== 'water') id = this.resolve(name);
			else {
				id = this.push('water', DEFAULT_WATER);
				this.byName.set('water', id);
			}
		}
		return id;
	}

	water(options: WaterOptions): void {
		const id = this.waterId(options.material);
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
		if (options.name !== undefined) {
			for (const key of Object.keys(source.anchors)) {
				const full = `${options.name}.${key}`;
				if (this.anchorMap.has(full)) throw new Error(`якорь "${full}" уже есть`);
			}
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

	private resolveSet(names: string | string[]): Set<number> {
		return new Set((Array.isArray(names) ? names : [names]).map((n) => this.resolve(n)));
	}

	/** Колонки области: верхний твёрдый воксель из `on` и пустота над ним. */
	private *surface(on: string | string[], area?: Area): Generator<[number, number, number]> {
		const ids = this.resolveSet(on);
		const [x0, z0, x1, z1] = area ?? [0, 0, this.size[0] - 1, this.size[2] - 1];
		for (let z = Math.max(0, z0); z <= Math.min(this.size[2] - 1, z1); z++) {
			for (let x = Math.max(0, x0); x <= Math.min(this.size[0] - 1, x1); x++) {
				const h = this.heightAt(x, z);
				if (h < 0 || h + 1 >= this.size[1]) continue;
				if (!ids.has(this.world.get(x, h, z)) || this.world.get(x, h + 1, z) !== 0) continue;
				yield [x, h, z];
			}
		}
	}

	/** Пучки травы на поверхности. Несколько материалов — случайный оттенок у каждого пучка. */
	grass(material: string | string[], options: GrassOptions): number {
		const ids = (Array.isArray(material) ? material : [material]).map((m) => this.resolve(m));
		const density = options.density ?? 0.3;
		const [hMin, hMax] = options.height ?? [1, 1];
		let count = 0;
		for (const [x, h, z] of this.surface(options.on, options.area)) {
			if (!this.rng.chance(density)) continue;
			const id = this.rng.pick(ids);
			const height = this.rng.int(hMin, hMax);
			for (let i = 1; i <= height; i++) this.write(x, h + i, z, id);
			count++;
		}
		return count;
	}

	/** Цветы: по воксельной «головке» случайного цвета, при `stem` — на стебле. */
	flowers(colors: string | string[], options: FlowersOptions): number {
		const ids = (Array.isArray(colors) ? colors : [colors]).map((m) => this.resolve(m));
		const stem = options.stem === undefined ? null : this.resolve(options.stem);
		const density = options.density ?? 0.04;
		let count = 0;
		for (const [x, h, z] of this.surface(options.on, options.area)) {
			if (!this.rng.chance(density)) continue;
			if (stem !== null) this.write(x, h + 1, z, stem);
			this.write(x, h + (stem === null ? 1 : 2), z, this.rng.pick(ids));
			count++;
		}
		return count;
	}

	/** Мох пятнами на открытых верхних и боковых гранях (камень, стены, крыши). */
	moss(material: string, options: MossOptions): number {
		const id = this.resolve(material);
		const on = this.resolveSet(options.on);
		const amount = options.amount ?? 0.4;
		const scale = options.scale ?? 5;
		const noise = createNoise3D(this.rng.int(0, 2 ** 31));
		const [x0, z0, x1, z1] = options.area ?? [0, 0, this.size[0] - 1, this.size[2] - 1];
		const changed: Vec3[] = [];
		for (let z = Math.max(0, z0); z <= Math.min(this.size[2] - 1, z1); z++) {
			for (let y = 0; y < this.size[1]; y++) {
				for (let x = Math.max(0, x0); x <= Math.min(this.size[0] - 1, x1); x++) {
					if (!on.has(this.world.get(x, y, z))) continue;
					const top = this.world.get(x, y + 1, z) === 0;
					const side =
						this.world.get(x + 1, y, z) === 0 ||
						this.world.get(x - 1, y, z) === 0 ||
						this.world.get(x, y, z + 1) === 0 ||
						this.world.get(x, y, z - 1) === 0;
					if (!top && !side) continue;
					const n = (noise.fbm(x / scale, y / scale, z / scale, 2) - 0.3) / 0.4;
					// Мох тянется к верху: на верхних гранях его больше.
					if (n < amount + (top ? 0.15 : 0)) changed.push([x, y, z]);
				}
			}
		}
		// Перекрашиваем после обхода, чтобы свежий мох не влиял на соседей.
		for (const [x, y, z] of changed) this.write(x, y, z, id);
		return changed.length;
	}

	/** Лианы и плющ: свисают вниз из-под крон, карнизов, низа острова — пока есть воздух. */
	vines(material: string | string[], options: VinesOptions): number {
		const ids = (Array.isArray(material) ? material : [material]).map((m) => this.resolve(m));
		const from = this.resolveSet(options.from);
		const density = options.density ?? 0.15;
		const [lMin, lMax] = options.length ?? [2, 6];
		const [x0, z0, x1, z1] = options.area ?? [0, 0, this.size[0] - 1, this.size[2] - 1];
		const starts: Vec3[] = [];
		for (let z = Math.max(0, z0); z <= Math.min(this.size[2] - 1, z1); z++) {
			for (let y = 1; y < this.size[1]; y++) {
				for (let x = Math.max(0, x0); x <= Math.min(this.size[0] - 1, x1); x++) {
					if (from.has(this.world.get(x, y, z)) && this.world.get(x, y - 1, z) === 0) {
						starts.push([x, y - 1, z]);
					}
				}
			}
		}
		let count = 0;
		for (const [x, y, z] of starts) {
			if (!this.rng.chance(density)) continue;
			const id = this.rng.pick(ids);
			const length = this.rng.int(lMin, lMax);
			for (let i = 0; i < length && y - i >= 0 && this.world.get(x, y - i, z) === 0; i++) {
				this.write(x, y - i, z, id);
			}
			count++;
		}
		return count;
	}

	/**
	 * Парящий остров: неровный контур, холмистый верх, слои трава/почва/камень и конический
	 * каменный «корень» с сосульками снизу. Вместо среза мира «до дна».
	 */
	island(options: IslandOptions): IslandInfo {
		const { radius, top } = options;
		const [cx, cz] = options.center;
		const depth = options.depth ?? radius * 1.1;
		const roughness = options.roughness ?? 0.3;
		const hills = options.hills ?? 3;
		const soilDepth = options.soilDepth ?? 3;
		const surface = this.resolve(options.surface);
		const soil = this.resolve(options.soil);
		const rock = this.resolve(options.rock);
		const seed = this.rng.int(0, 2 ** 31);
		const outline = createNoise2D(seed);
		const relief = createNoise2D(seed ^ 0x68e31da4);
		const reach = Math.ceil(radius * (1 + roughness));
		let bottom = top;
		let centerTop = top;
		const columns: Array<{ x: number; z: number; low: number; d: number }> = [];
		for (let z = Math.floor(cz - reach); z <= Math.ceil(cz + reach); z++) {
			for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x++) {
				const edge =
					1 + roughness * (outline.fbm(x / (radius * 0.45), z / (radius * 0.45), 3) - 0.5) * 2;
				const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz) / (radius * edge);
				if (d >= 1) continue;
				// Плечо у края: поверхность скругляется вниз, а не обрывается ступенькой.
				const shoulder = Math.round(Math.max(0, d - 0.75) * 8);
				const h = Math.round(
					top + hills * (relief.fbm(x / 18, z / 18, 3) - 0.5) * 2 * (1 - d ** 3) - shoulder,
				);
				const roots = depth * (1 - d) ** 0.8 * (0.7 + 0.6 * relief.fbm(x / 7 + 40, z / 7, 2));
				const low = Math.round(h - Math.max(soilDepth + 1, roots));
				for (let y = low; y <= h; y++) {
					this.write(x, y, z, y === h ? surface : y > h - soilDepth - 1 ? soil : rock);
				}
				if (x === Math.floor(cx) && z === Math.floor(cz)) centerTop = h;
				bottom = Math.min(bottom, low);
				columns.push({ x, z, low, d });
			}
		}
		const spikes = options.spikes ?? Math.round(radius / 2);
		const inner = columns.filter((c) => c.d < 0.75);
		for (let i = 0; i < spikes && inner.length > 0; i++) {
			const c = this.rng.pick(inner);
			const length = this.rng.int(3, Math.max(4, Math.round(depth * 0.35)));
			const r0 = this.rng.float(1, 2.2);
			for (let k = 1; k <= length; k++) {
				const r = r0 * (1 - k / (length + 1));
				const r2 = Math.max(r, 0.5) ** 2;
				for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++) {
					for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
						if (dx * dx + dz * dz <= r2) this.write(c.x + dx, c.low - k, c.z + dz, rock);
					}
				}
			}
			bottom = Math.min(bottom, c.low - length);
		}
		if (options.name !== undefined) {
			if (!ANCHOR_NAME_RE.test(options.name)) {
				throw new Error(`имя "${options.name}": латиница с маленькой буквы, без точек`);
			}
			this.registerAnchor(`${options.name}.top`, [cx, centerTop + 1, cz]);
			this.registerAnchor(`${options.name}.bottom`, [cx, bottom, cz]);
		}
		return { top: centerTop, bottom };
	}

	/** Водопад: струя воды вниз от `at` через воздух. Анимацию даёт `pour` на якорях. */
	waterfall(options: WaterfallOptions): { top: Vec3; bottom: Vec3 } {
		const id = this.waterId(options.material);
		const [wx, wz] = options.width ?? [2, 1];
		const [ax, ay, az] = [
			Math.floor(options.at[0]),
			Math.floor(options.at[1]),
			Math.floor(options.at[2]),
		];
		let lowest = ay;
		for (let dz = 0; dz < wz; dz++) {
			for (let dx = 0; dx < wx; dx++) {
				const x = ax + dx;
				const z = az + dz;
				for (let y = ay; y >= Math.max(0, options.to ?? 0); y--) {
					const v = this.world.get(x, y, z);
					if (v !== 0 && v !== id) break;
					this.write(x, y, z, id);
					lowest = Math.min(lowest, y);
				}
			}
		}
		const top: Vec3 = [ax + wx / 2, ay + 1, az + wz / 2];
		const bottom: Vec3 = [ax + wx / 2, lowest, az + wz / 2];
		if (options.name !== undefined) {
			if (!ANCHOR_NAME_RE.test(options.name)) {
				throw new Error(`имя "${options.name}": латиница с маленькой буквы, без точек`);
			}
			this.registerAnchor(`${options.name}.top`, top);
			this.registerAnchor(`${options.name}.bottom`, bottom);
		}
		return { top, bottom };
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
