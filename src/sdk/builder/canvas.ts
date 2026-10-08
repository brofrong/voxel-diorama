import type { Vec3 } from '../../engine/types.ts';
import { AIR } from '../materials.ts';
import { createNoise3D } from '../noise.ts';

export interface BlobOptions {
	/** Неровность края: 0 — гладкий эллипсоид, 0.5 — сильно бугристый. По умолчанию 0.3. */
	roughness?: number;
	/** Размер бугров в вокселях. По умолчанию — половина среднего радиуса. */
	scale?: number;
	/** Seed формы; по умолчанию выводится из центра (разные блобы — разные). */
	seed?: number;
}

export interface ConeOptions {
	/** Радиус верха: 0 — острый конус (по умолчанию), больше — усечённый. */
	top?: number;
}

export interface CurveOptions {
	/** Толщина: 0 — линия в один воксель (по умолчанию), иначе трубка этого радиуса. */
	radius?: number;
	/** Радиус в конце (для сужающихся ветвей и лиан); по умолчанию как `radius`. */
	endRadius?: number;
}

export interface ShadeOptions {
	/** Перекрашивать только эти материалы (по умолчанию — все непустые воксели). */
	only?: string | string[];
	/** Размер пятен в вокселях. По умолчанию 6. */
	scale?: number;
	/** Доля вокселей, берущих случайный оттенок поверх пятен (0..1). По умолчанию 0.2. */
	speckle?: number;
	seed?: number;
}

/** Seed из точки: соседние вызовы кистей получают разную форму без явного seed. */
const seedFrom = (p: Vec3): number =>
	(Math.imul(Math.floor(p[0]), 73856093) ^
		Math.imul(Math.floor(p[1]), 19349663) ^
		Math.imul(Math.floor(p[2]), 83492791)) |
	0;

/** Catmull-Rom через все точки; t ∈ [0, 1] по всему пути. */
function catmullRom(points: readonly Vec3[], t: number): Vec3 {
	const segments = points.length - 1;
	const f = Math.min(segments - 1e-9, Math.max(0, t * segments));
	const i = Math.floor(f);
	const u = f - i;
	const p0 = points[Math.max(0, i - 1)];
	const p1 = points[i];
	const p2 = points[i + 1];
	const p3 = points[Math.min(points.length - 1, i + 2)];
	const out: Vec3 = [0, 0, 0];
	for (let k = 0; k < 3; k++) {
		out[k] =
			0.5 *
			(2 * p1[k] +
				(-p0[k] + p2[k]) * u +
				(2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u +
				(-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u);
	}
	return out;
}

const sorted = (a: number, b: number): [number, number] => {
	const x = Math.floor(a);
	const y = Math.floor(b);
	return x <= y ? [x, y] : [y, x];
};

/**
 * Общие примитивы для мира и моделей. Координаты целые (дробные округляются вниз), Y вверх.
 * Запись за границами молча игнорируется — наследник может её посчитать.
 */
export abstract class VoxelCanvas {
	/** Записать индекс материала (0 — пустота). */
	protected abstract write(x: number, y: number, z: number, index: number): void;
	/** Имя материала → индекс. 'air' → 0. Неизвестное имя — исключение. */
	protected abstract resolve(material: string): number;
	/** Индекс материала в точке (0 — пустота или вне границ). */
	protected abstract read(x: number, y: number, z: number): number;

	set(p: Vec3, material: string): void {
		this.write(Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2]), this.resolve(material));
	}

	/** Параллелепипед, оба угла включительно. */
	box(a: Vec3, b: Vec3, material: string): void {
		const id = this.resolve(material);
		const [x0, x1] = sorted(a[0], b[0]);
		const [y0, y1] = sorted(a[1], b[1]);
		const [z0, z1] = sorted(a[2], b[2]);
		for (let z = z0; z <= z1; z++)
			for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.write(x, y, z, id);
	}

	/** Все воксели, чей центр не дальше radius от center. */
	sphere(center: Vec3, radius: number, material: string): void {
		const id = this.resolve(material);
		const [cx, cy, cz] = center;
		const r2 = radius * radius;
		for (let z = Math.floor(cz - radius); z <= Math.ceil(cz + radius); z++) {
			for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
				for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
					if ((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= r2) this.write(x, y, z, id);
				}
			}
		}
	}

	/** Вертикальный цилиндр: base — центр нижнего слоя. */
	cylinder(base: Vec3, radius: number, height: number, material: string): void {
		const id = this.resolve(material);
		const [cx, by, cz] = base;
		const r2 = radius * radius;
		for (let y = Math.floor(by); y < Math.floor(by) + height; y++) {
			for (let z = Math.floor(cz - radius); z <= Math.ceil(cz + radius); z++) {
				for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
					if ((x - cx) ** 2 + (z - cz) ** 2 <= r2) this.write(x, y, z, id);
				}
			}
		}
	}

	/** Отрезок без разрывов. */
	line(a: Vec3, b: Vec3, material: string): void {
		const id = this.resolve(material);
		const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]));
		for (let i = 0; i <= steps; i++) {
			const t = steps === 0 ? 0 : i / steps;
			this.write(
				Math.round(a[0] + (b[0] - a[0]) * t),
				Math.round(a[1] + (b[1] - a[1]) * t),
				Math.round(a[2] + (b[2] - a[2]) * t),
				id,
			);
		}
	}

	clear(a: Vec3, b: Vec3): void {
		this.box(a, b, AIR);
	}

	/** Эллипсоид с полуосями radii (x, y, z). */
	ellipsoid(center: Vec3, radii: Vec3, material: string): void {
		this.blob(center, radii, material, { roughness: 0 });
	}

	/**
	 * Неровный «пузырь»: эллипсоид, край которого гуляет по шуму. Для крон, облаков, скал,
	 * кустов, сугробов. radius — число или полуоси [x, y, z].
	 */
	blob(center: Vec3, radius: number | Vec3, material: string, options: BlobOptions = {}): void {
		const id = this.resolve(material);
		const [rx, ry, rz] = typeof radius === 'number' ? [radius, radius, radius] : radius;
		const roughness = options.roughness ?? 0.3;
		const scale = options.scale ?? Math.max(1.5, (rx + ry + rz) / 6);
		const noise = createNoise3D(options.seed ?? seedFrom(center));
		const reach = 1 + roughness;
		const [cx, cy, cz] = center;
		for (let z = Math.floor(cz - rz * reach); z <= Math.ceil(cz + rz * reach); z++) {
			for (let y = Math.floor(cy - ry * reach); y <= Math.ceil(cy + ry * reach); y++) {
				for (let x = Math.floor(cx - rx * reach); x <= Math.ceil(cx + rx * reach); x++) {
					// Центр вокселя — +0.5: блоб симметричен вокруг дробного центра.
					const dx = (x + 0.5 - cx) / rx;
					const dy = (y + 0.5 - cy) / ry;
					const dz = (z + 0.5 - cz) / rz;
					const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
					if (d > reach) continue;
					const edge =
						roughness === 0
							? 1
							: 1 + roughness * (noise.fbm(x / scale, y / scale, z / scale, 2) - 0.5) * 2;
					if (d <= edge) this.write(x, y, z, id);
				}
			}
		}
	}

	/** Вертикальный конус (или усечённый — `top`): base — центр нижнего слоя. Крыши, шпили, горы. */
	cone(
		base: Vec3,
		radius: number,
		height: number,
		material: string,
		options: ConeOptions = {},
	): void {
		const id = this.resolve(material);
		const top = options.top ?? 0;
		const [cx, by, cz] = base;
		const y0 = Math.floor(by);
		for (let i = 0; i < height; i++) {
			const r = radius + (top - radius) * (height <= 1 ? 0 : i / (height - 1));
			const r2 = Math.max(r, 0.5) ** 2;
			for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
				for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
					if ((x - cx) ** 2 + (z - cz) ** 2 <= r2) this.write(x, y0 + i, z, id);
				}
			}
		}
	}

	/**
	 * Плавная кривая через точки (Catmull-Rom): ветви, лианы, перила, русла, изгиб крыши.
	 * С `radius` — трубка, можно сужать к концу (`endRadius`).
	 */
	curve(points: readonly Vec3[], material: string, options: CurveOptions = {}): void {
		if (points.length < 2) throw new Error('curve: нужно хотя бы 2 точки');
		const id = this.resolve(material);
		const r0 = options.radius ?? 0;
		const r1 = options.endRadius ?? r0;
		let length = 0;
		for (let i = 1; i < points.length; i++) {
			length += Math.hypot(
				points[i][0] - points[i - 1][0],
				points[i][1] - points[i - 1][1],
				points[i][2] - points[i - 1][2],
			);
		}
		const steps = Math.max(1, Math.ceil(length * 3));
		for (let s = 0; s <= steps; s++) {
			const t = s / steps;
			const [px, py, pz] = catmullRom(points, t);
			const r = r0 + (r1 - r0) * t;
			if (r < 0.5) {
				this.write(Math.round(px), Math.round(py), Math.round(pz), id);
				continue;
			}
			const r2 = r * r;
			for (let z = Math.floor(pz - r); z <= Math.ceil(pz + r); z++) {
				for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
					for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
						if ((x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2 <= r2) this.write(x, y, z, id);
					}
				}
			}
		}
	}

	/**
	 * Перекрашивает уже нарисованное в коробке [a, b] в несколько оттенков: пятнами по шуму
	 * плюс случайная «соль». Так трава, листва, камень и черепица не выглядят пластиком.
	 * shades — материалы от тёмного к светлому (2–5 штук).
	 */
	shade(a: Vec3, b: Vec3, shades: readonly string[], options: ShadeOptions = {}): void {
		if (shades.length === 0) throw new Error('shade: нужен хотя бы один оттенок');
		const ids = shades.map((s) => this.resolve(s));
		const only =
			options.only === undefined
				? null
				: new Set(
						(Array.isArray(options.only) ? options.only : [options.only]).map((m) =>
							this.resolve(m),
						),
					);
		const scale = options.scale ?? 6;
		const speckle = options.speckle ?? 0.2;
		const seed = options.seed ?? seedFrom(a);
		const patches = createNoise3D(seed);
		const salt = createNoise3D(seed ^ 0x2545f491);
		const [x0, x1] = sorted(a[0], b[0]);
		const [y0, y1] = sorted(a[1], b[1]);
		const [z0, z1] = sorted(a[2], b[2]);
		for (let z = z0; z <= z1; z++) {
			for (let y = y0; y <= y1; y++) {
				for (let x = x0; x <= x1; x++) {
					const current = this.read(x, y, z);
					if (current === 0 || (only && !only.has(current))) continue;
					let t: number;
					// Значение шума в целой точке — чистый хеш: случайно, но детерминированно.
					const r = salt.value(x, y, z);
					if (r < speckle) t = r / speckle;
					else {
						// fbm кучкуется у 0.5 — растягиваем, чтобы крайние оттенки тоже встречались.
						const n = patches.fbm(x / scale, y / scale, z / scale, 2);
						t = Math.min(0.999, Math.max(0, (n - 0.3) / 0.4));
					}
					this.write(x, y, z, ids[Math.floor(t * ids.length)]);
				}
			}
		}
	}
}
