import { describe, expect, test } from 'bun:test';
import { normalizeMaterial } from '../materials.ts';
import { model } from './model.ts';
import { DEFAULT_WATER, WorldBuilder } from './world-builder.ts';

const palette = {
	grass: normalizeMaterial('#6aa84f'),
	dirt: normalizeMaterial('#7a5a3a'),
	sand: normalizeMaterial('#d9c48a'),
};

const flatWorld = (size: [number, number, number] = [32, 16, 32], seed = 1) => {
	const w = new WorldBuilder(size, palette, seed);
	w.terrain({ noise: 'flat', base: 2, top: 'grass', fill: 'dirt' });
	return w;
};

describe('WorldBuilder: материалы', () => {
	test('неизвестный материал — ошибка с именем и палитрой', () => {
		const w = new WorldBuilder([8, 8, 8], palette, 1);
		expect(() => w.box([0, 0, 0], [1, 1, 1], 'lava')).toThrow(
			'неизвестный материал "lava". В палитре: grass, dirt, sand',
		);
	});

	test('запись за границами считается, но не падает', () => {
		const w = new WorldBuilder([4, 4, 4], palette, 1);
		w.box([-2, 0, 0], [5, 0, 0], 'grass');
		expect(w.outOfBounds).toBe(4);
		expect(w.world.countVoxels()).toBe(4);
	});
});

describe('WorldBuilder: рельеф и вода', () => {
	test('flat: ровная поверхность top поверх fill', () => {
		const w = flatWorld([8, 8, 8]);
		for (let x = 0; x < 8; x++) {
			for (let z = 0; z < 8; z++) {
				expect(w.heightAt(x, z)).toBe(2);
				expect(w.get([x, 2, z])).toBe('grass');
				expect(w.get([x, 1, z])).toBe('dirt');
				expect(w.get([x, 3, z])).toBeNull();
			}
		}
	});

	test('hills: высота меняется, остаётся в границах и детерминирована', () => {
		const make = () => {
			const w = new WorldBuilder([64, 32, 64], palette, 5);
			w.terrain({ noise: 'hills', base: 12, amp: 10, top: 'grass', fill: 'dirt' });
			return w;
		};
		const a = make();
		const b = make();
		const heights = new Set<number>();
		for (let x = 0; x < 64; x += 3) {
			for (let z = 0; z < 64; z += 3) {
				const h = a.heightAt(x, z);
				expect(h).toBe(b.heightAt(x, z));
				expect(h >= 0 && h < 32).toBe(true);
				heights.add(h);
			}
		}
		expect(heights.size).toBeGreaterThan(3);
	});

	test('water заполняет только пустоту ниже уровня; heightAt игнорирует воду', () => {
		const w = flatWorld([8, 12, 8]);
		w.water({ level: 5 });
		expect(w.get([3, 2, 3])).toBe('grass');
		expect(w.get([3, 5, 3])).toBe('water');
		expect(w.get([3, 6, 3])).toBeNull();
		expect(w.heightAt(3, 3)).toBe(2);
		expect(w.materialList.at(-1)).toEqual(DEFAULT_WATER);
	});
});

describe('WorldBuilder: place', () => {
	const box3x2x1 = model({ size: [3, 2, 1], palette: { wood: '#6b4a2b' } }, (m) =>
		m.box([0, 0, 0], [2, 1, 0], 'wood'),
	);

	test('at — нижний центр модели', () => {
		const w = new WorldBuilder([32, 16, 32], palette, 1);
		w.place(box3x2x1, [10, 5, 10]);
		expect(w.get([9, 5, 10])).toBe('wood');
		expect(w.get([11, 6, 10])).toBe('wood');
		expect(w.get([12, 5, 10])).toBeNull();
		expect(w.get([10, 4, 10])).toBeNull();
	});

	test('rotate 90 поворачивает вокруг Y', () => {
		const marked = model({ size: [3, 1, 1], palette: { a: '#ff0000', b: '#0000ff' } }, (m) => {
			m.set([0, 0, 0], 'a');
			m.box([1, 0, 0], [2, 0, 0], 'b');
		});
		const w = new WorldBuilder([32, 16, 32], palette, 1);
		w.place(marked, [10, 0, 10], { rotate: 90 });
		expect(w.get([10, 0, 9])).toBe('a');
		expect(w.get([10, 0, 10])).toBe('b');
		expect(w.get([10, 0, 11])).toBe('b');
	});

	test('палитра диорамы переопределяет материал префаба с тем же именем', () => {
		const red = model({ size: [1, 1, 1], palette: { grass: '#ff0000' } }, (m) =>
			m.set([0, 0, 0], 'grass'),
		);
		const w = new WorldBuilder([8, 8, 8], palette, 1);
		w.place(red, [4, 0, 4]);
		expect(w.get([4, 0, 4])).toBe('grass');
		expect(w.materialList.length).toBe(3);
	});

	test('одноимённые материалы с разными цветами — разные материалы', () => {
		const roof = (color: string) =>
			model({ size: [1, 1, 1], palette: { roof: color } }, (m) => m.set([0, 0, 0], 'roof'));
		const w = new WorldBuilder([8, 8, 8], palette, 1);
		w.place(roof('#aa0000'), [1, 0, 1]);
		w.place(roof('#0000aa'), [3, 0, 3]);
		w.place(roof('#aa0000'), [5, 0, 5]);
		expect(w.materialList.length).toBe(5);
	});

	test('больше 255 материалов — понятная ошибка', () => {
		const w = new WorldBuilder([8, 8, 8], palette, 1);
		expect(() => {
			for (let i = 0; i < 300; i++) {
				const color = `#${i.toString(16).padStart(6, '0')}`;
				w.place(
					model({ size: [1, 1, 1], palette: { c: color } }, (m) => m.set([0, 0, 0], 'c')),
					[0, 0, 0],
				);
			}
		}).toThrow('слишком много материалов');
	});
});

describe('WorldBuilder: scatter', () => {
	const pole = model({ size: [1, 3, 1], palette: { wood: '#6b4a2b' } }, (m) =>
		m.box([0, 0, 0], [0, 2, 0], 'wood'),
	);

	test('ставит нужное число объектов на нужный материал с минимальной дистанцией', () => {
		const w = flatWorld();
		const placed = w.scatter(pole, { count: 5, on: 'grass', minDistance: 4 });
		expect(placed).toBe(5);
		const spots: Array<[number, number]> = [];
		for (let x = 0; x < 32; x++)
			for (let z = 0; z < 32; z++) if (w.get([x, 3, z]) === 'wood') spots.push([x, z]);
		expect(spots.length).toBe(5);
		for (const [ax, az] of spots)
			for (const [bx, bz] of spots)
				if (ax !== bx || az !== bz)
					expect((ax - bx) ** 2 + (az - bz) ** 2).toBeGreaterThanOrEqual(16);
	});

	test('детерминирован по seed', () => {
		const snapshot = (w: WorldBuilder) => {
			const out: string[] = [];
			for (let x = 0; x < 32; x++)
				for (let z = 0; z < 32; z++) if (w.get([x, 3, z])) out.push(`${x},${z}`);
			return out;
		};
		const a = flatWorld([32, 16, 32], 9);
		const b = flatWorld([32, 16, 32], 9);
		a.scatter(pole, { count: 6, on: 'grass' });
		b.scatter(pole, { count: 6, on: 'grass' });
		expect(snapshot(a)).toEqual(snapshot(b));
	});

	test('нет подходящей поверхности — 0 объектов', () => {
		expect(flatWorld().scatter(pole, { count: 5, on: 'sand' })).toBe(0);
	});

	test('неизвестный материал в on — ошибка', () => {
		expect(() => flatWorld().scatter(pole, { count: 5, on: 'snow' })).toThrow('"snow"');
	});

	test('фабрика получает rng', () => {
		const w = flatWorld();
		let calls = 0;
		w.scatter(
			({ rng }) => {
				calls++;
				expect(typeof rng.next()).toBe('number');
				return pole;
			},
			{ count: 3, on: 'grass' },
		);
		expect(calls).toBe(3);
	});
});

describe('WorldBuilder: якоря', () => {
	const marker = model(
		{ size: [3, 1, 2], palette: { wood: '#6b4a2b' }, anchors: { a: [0.5, 0, 0.5] } },
		(m) => m.set([0, 0, 0], 'wood'),
	);

	test.each([
		[0, [9.5, 0, 9.5]],
		[90, [10.5, 0, 9.5]],
		[180, [11.5, 0, 10.5]],
		[270, [9.5, 0, 11.5]],
	] as const)('rotate %i переводит якорь в мир', (rotate, expected) => {
		const w = new WorldBuilder([32, 16, 32], palette, 1);
		expect(w.place(marker, [10, 0, 10], { rotate }).anchors.a).toEqual([...expected]);
	});

	test('якорь в центре вокселя остаётся в этом вокселе после поворота', () => {
		const w = new WorldBuilder([32, 16, 32], palette, 1);
		const [x, y, z] = w.place(marker, [10, 0, 10], { rotate: 90 }).anchors.a;
		expect(w.get([x, y, z])).toBe('wood');
	});

	test('name регистрирует якоря как <name>.<якорь>', () => {
		const w = new WorldBuilder([32, 16, 32], palette, 1);
		w.place(marker, [10, 0, 10], { name: 'mill' });
		expect(w.anchors['mill.a']).toEqual([9.5, 0, 9.5]);
	});

	test('w.anchor, дубликаты и неверные имена', () => {
		const w = new WorldBuilder([32, 16, 32], palette, 1);
		w.anchor('well', [1, 2, 3]);
		expect(w.anchors.well).toEqual([1, 2, 3]);
		expect(() => w.anchor('well', [0, 0, 0])).toThrow('якорь "well" уже есть');
		expect(() => w.anchor('a.b', [0, 0, 0])).toThrow('имя якоря');
		w.place(marker, [5, 0, 5], { name: 'mill' });
		expect(() => w.place(marker, [20, 0, 20], { name: 'mill' })).toThrow('якорь "mill.a" уже есть');
	});

	test('place не принимает модели с scale ≠ 1', () => {
		const small = model({ size: [1, 1, 1], palette: { wood: '#6b4a2b' }, scale: 0.25 }, (m) =>
			m.set([0, 0, 0], 'wood'),
		);
		const w = new WorldBuilder([8, 8, 8], palette, 1);
		expect(() => w.place(small, [4, 0, 4])).toThrow('scale ≠ 1');
	});
});
