import type { Vec3 } from '../../engine/types.ts';
import { AIR } from '../materials.ts';

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
}
