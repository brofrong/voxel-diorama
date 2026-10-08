import type { BackdropConfig, Vec3 } from '../types.ts';
import { mulberry32 } from './random.ts';

/** Один куб задника: центр, размеры и яркость (множитель цвета 0..1+). */
export interface BackdropBox {
	center: Vec3;
	size: Vec3;
	shade: number;
}

export interface BackdropLayout {
	/** Облака — в координатах относительно центра диорамы (группа вращается вокруг него). */
	clouds: BackdropBox[];
	cloudSea: BackdropBox[];
	mountains: BackdropBox[];
	/** Снежные шапки гор. */
	snow: BackdropBox[];
}

/** Метрики диорамы, от которых считается задник. */
export function backdropMetrics(size: Vec3): { span: number; radius: number; cell: number } {
	const span = Math.max(size[0], size[2]);
	return {
		span,
		radius: Math.hypot(size[0], size[2]) / 2,
		// Облака и горы — тоже воксели, но крупнее мира: иначе вдали они рябят.
		cell: Math.max(2, Math.round(span / 20)),
	};
}

/**
 * Одно облако: несколько эллипсоидов на сетке cell, плоское дно. Возвращает только
 * поверхностные клетки — внутренние кубы всё равно не видны.
 */
function cloudCells(rnd: () => number, cell: number, center: Vec3): BackdropBox[] {
	const puffs = Array.from({ length: 3 + Math.floor(rnd() * 4) }, (_, i) => ({
		c: [(rnd() - 0.5) * 8, i === 0 ? 0 : rnd() * 1.5, (rnd() - 0.5) * 4] as Vec3,
		r: [3 + rnd() * 3, 1.5 + rnd() * 1.5, 2.5 + rnd() * 2] as Vec3,
	}));
	const inside = (x: number, y: number, z: number): boolean =>
		y >= 0 &&
		puffs.some(
			({ c, r }) =>
				((x - c[0]) / r[0]) ** 2 + ((y - c[1]) / r[1]) ** 2 + ((z - c[2]) / r[2]) ** 2 <= 1,
		);
	const out: BackdropBox[] = [];
	for (let x = -10; x <= 10; x++) {
		for (let y = 0; y <= 5; y++) {
			for (let z = -7; z <= 7; z++) {
				if (!inside(x, y, z)) continue;
				const surface =
					!inside(x + 1, y, z) ||
					!inside(x - 1, y, z) ||
					!inside(x, y + 1, z) ||
					!inside(x, y - 1, z) ||
					!inside(x, y, z + 1) ||
					!inside(x, y, z - 1);
				if (!surface) continue;
				out.push({
					center: [center[0] + x * cell, center[1] + y * cell, center[2] + z * cell],
					size: [cell, cell, cell],
					// Низ облака чуть темнее — как будто он в собственной тени.
					shade: 0.86 + 0.1 * Math.min(1, y / 3) + 0.04 * rnd(),
				});
			}
		}
	}
	return out;
}

/** Детерминированная раскладка задника по seed и размеру диорамы. */
export function backdropLayout(config: BackdropConfig, size: Vec3, seed: number): BackdropLayout {
	const { radius, cell } = backdropMetrics(size);
	const sy = size[1];
	const layout: BackdropLayout = { clouds: [], cloudSea: [], mountains: [], snow: [] };

	if (config.clouds > 0) {
		const rnd = mulberry32(seed ^ 0x6c0d1a57);
		const count = Math.round(4 + 14 * config.clouds);
		for (let i = 0; i < count; i++) {
			const angle = (i / count) * Math.PI * 2 + rnd() * 0.5;
			const distance = radius * (1.7 + 1.8 * rnd());
			const height = sy * (0.05 + 0.95 * rnd());
			const center: Vec3 = [Math.cos(angle) * distance, height, Math.sin(angle) * distance];
			layout.clouds.push(...cloudCells(rnd, cell, center));
		}
	}

	if (config.cloudSea) {
		// Облачное море — не сплошной ковёр, а рваные пятна облаков далеко внизу.
		const rnd = mulberry32(seed ^ 0x3e9a77c1);
		const count = Math.round(10 + radius / 6);
		for (let i = 0; i < count; i++) {
			const angle = rnd() * Math.PI * 2;
			const distance = radius * 4 * Math.sqrt(rnd());
			const center: Vec3 = [
				Math.cos(angle) * distance,
				-radius * (0.9 + 0.5 * rnd()),
				Math.sin(angle) * distance,
			];
			layout.cloudSea.push(...cloudCells(rnd, cell * 1.5, center));
		}
	}

	if (config.mountains > 0) {
		const rnd = mulberry32(seed ^ 0x1b873593);
		const step = cell * 2;
		const bottom = -radius;
		// Горы должны подниматься над линией взгляда изометрической камеры — иначе их не видно.
		const peak = sy * 0.5 + radius * 2.2 * config.mountains;
		// Снеговая линия общая для всех гор: снег только на самых высоких вершинах.
		const snowLine = bottom + (peak - bottom) * 0.62;
		// Объёмные горы-конусы на двух кольцах: ближние ниже, дальние выше — горизонт слоистый.
		const cones: Array<{ x: number; z: number; height: number; base: number }> = [];
		for (const [ring, lift, count] of [
			[radius * 5.5, 0.7, 9],
			[radius * 7, 1, 12],
		] as const) {
			for (let i = 0; i < count; i++) {
				const angle = ((i + rnd() * 0.6) / count) * Math.PI * 2;
				const distance = ring * (0.92 + 0.16 * rnd());
				const height = (peak - bottom) * lift * (0.5 + 0.5 * rnd());
				cones.push({
					x: Math.cos(angle) * distance,
					z: Math.sin(angle) * distance,
					height,
					// Крутой склон: основание чуть меньше высоты.
					base: height * (0.6 + 0.3 * rnd()),
				});
			}
		}
		// Колонки на общей сетке: в каждой — самая высокая из гор, которые её накрывают.
		const columns = new Map<string, { x: number; z: number; top: number }>();
		for (const c of cones) {
			const reach = Math.ceil(c.base / step);
			const gx = Math.round(c.x / step);
			const gz = Math.round(c.z / step);
			for (let dz = -reach; dz <= reach; dz++) {
				for (let dx = -reach; dx <= reach; dx++) {
					const x = (gx + dx) * step;
					const z = (gz + dz) * step;
					const d = Math.hypot(x - c.x, z - c.z) / c.base;
					// Подножия не подходят к диораме ближе 3 радиусов.
					if (d >= 1 || Math.hypot(x, z) < radius * 3) continue;
					const top = bottom + c.height * (1 - d) ** 1.15;
					const key = `${gx + dx},${gz + dz}`;
					const prev = columns.get(key);
					if (!prev || prev.top < top) columns.set(key, { x, z, top });
				}
			}
		}
		for (const { x, z, top } of columns.values()) {
			// Ступенька по высоте кратна клетке, иначе склон выглядит пилой.
			const stepped = Math.round(top / cell) * cell;
			if (stepped <= 0) continue;
			layout.mountains.push({
				center: [x, (bottom + stepped) / 2, z],
				size: [step, stepped - bottom, step],
				// Выше — светлее: у подножия гора темнее, как в тени долины.
				shade: 0.78 + 0.22 * Math.min(1, (stepped - bottom) / (peak - bottom)),
			});
			if (stepped > snowLine) {
				const cap = Math.min(stepped - snowLine, step * 1.5);
				layout.snow.push({
					center: [x, stepped - cap / 2 + 0.05, z],
					size: [step * 1.04, cap, step * 1.04],
					shade: 1,
				});
			}
		}
	}

	return layout;
}
