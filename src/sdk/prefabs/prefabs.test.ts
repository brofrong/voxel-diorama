import { describe, expect, test } from 'bun:test';
import type { Model } from '../builder/model.ts';
import { modelIndex } from '../builder/model.ts';
import { createRng } from '../rng.ts';
import {
	archBridge,
	bush,
	house,
	maple,
	pagoda,
	pine,
	rock,
	sakura,
	stoneLantern,
	torii,
	tree,
	willow,
} from './index.ts';

const factories = { tree, pine, house, rock, sakura, willow, maple, bush } as const;

const hasGroundContact = (m: Model): boolean => {
	for (let x = 0; x < m.size[0]; x++)
		for (let z = 0; z < m.size[2]; z++) if (m.data[modelIndex(m.size, x, 0, z)] !== 0) return true;
	return false;
};

describe.each(Object.entries(factories))('%s', (_, make) => {
	test('детерминирован по rng', () => {
		expect(make({ rng: createRng(4) }).data).toEqual(make({ rng: createRng(4) }).data);
	});

	test('не пустой и стоит на земле', () => {
		const m = make({ rng: createRng(8) });
		expect(m.data.some((v) => v !== 0)).toBe(true);
		expect(hasGroundContact(m)).toBe(true);
	});

	test('варьируется между seed', () => {
		const variants = new Set(
			[1, 2, 3, 4, 5, 6].map((s) => Array.from(make({ rng: createRng(s) }).data).join('')),
		);
		expect(variants.size).toBeGreaterThan(1);
	});
});

test('у дома светящиеся окна', () => {
	expect(house().materials.some(({ material }) => material.emissive > 0)).toBe(true);
});

test('цвета префабов настраиваются', () => {
	const leaves = tree({ leaves: '#ff00ff' }).materials.find((m) => m.name === 'leaves');
	expect(leaves?.material.color).toBe('#ff00ff');
	const roof = house({ roof: '#123456' }).materials.find((m) => m.name === 'roof');
	expect(roof?.material.color).toBe('#123456');
});

const count = (m: Model, name: string): number => {
	const index = m.materials.findIndex((x) => x.name === name) + 1;
	return m.data.filter((v) => v === index).length;
};

describe('деревья и кусты: оттенки и форма', () => {
	test('крона в трёх оттенках, ствол есть', () => {
		for (const [make, prefix, bark] of [
			[sakura, 'blossom', 'sakura-bark'],
			[willow, 'willow', 'willow-bark'],
			[maple, 'maple', 'maple-bark'],
		] as const) {
			const m = make({ rng: createRng(3) });
			for (const shade of [`${prefix}-dark`, prefix, `${prefix}-light`]) {
				expect(count(m, shade)).toBeGreaterThan(10);
			}
			expect(count(m, bark)).toBeGreaterThan(5);
		}
	});

	test('ива — с прядями: листва опускается ниже середины высоты', () => {
		const m = willow({ rng: createRng(2) });
		let lowest = m.size[1];
		for (let i = 0; i < m.data.length; i++) {
			const name = m.materials[m.data[i] - 1]?.name ?? '';
			if (name.startsWith('willow') && name !== 'willow-bark') {
				lowest = Math.min(lowest, Math.floor(i / m.size[0]) % m.size[1]);
			}
		}
		expect(lowest).toBeLessThan(m.size[1] / 2);
	});

	test('цвета задаются', () => {
		const m = sakura({ colors: ['#111111', '#222222', '#333333'], bark: '#444444' });
		expect(m.materials.find((x) => x.name === 'blossom')?.material.color).toBe('#222222');
		expect(m.materials.find((x) => x.name === 'sakura-bark')?.material.color).toBe('#444444');
		expect(bush({ flowers: '#ff0000' }).materials.some((x) => x.name === 'bush-flower')).toBe(true);
	});
});

describe('архитектура', () => {
	test('пагода: стоит на земле, ярусы растут в высоту, окна светятся, якоря', () => {
		const low = pagoda({ tiers: 2 });
		const high = pagoda({ tiers: 5 });
		expect(hasGroundContact(high)).toBe(true);
		expect(high.size[1]).toBeGreaterThan(low.size[1]);
		expect(high.materials.some(({ material }) => material.emissive > 0)).toBe(true);
		expect(high.anchors.door[1]).toBe(0);
		expect(high.anchors.top[1]).toBe(high.size[1]);
		// Шпиль не обрезан верхом модели.
		const c = Math.floor(high.size[0] / 2);
		let topmost = -1;
		for (let y = 0; y < high.size[1]; y++)
			if (high.data[modelIndex(high.size, c, y, c)] !== 0) topmost = y;
		expect(topmost).toBeGreaterThan(high.size[1] - 4);
		expect(topmost).toBeLessThan(high.size[1]);
	});

	test('пагода: чётная ширина округляется до нечётной, ярусы ограничены', () => {
		expect(pagoda({ base: 10 }).size[0] % 2).toBe(1);
		expect(pagoda({ tiers: 20 }).size[1]).toBe(pagoda({ tiers: 6 }).size[1]);
	});

	test('тории, мостик и каменный фонарь стоят на земле; у фонаря светится камера', () => {
		for (const m of [torii(), archBridge(), stoneLantern()]) expect(hasGroundContact(m)).toBe(true);
		const lantern = stoneLantern();
		expect(lantern.materials.some(({ material }) => material.emissive > 0)).toBe(true);
		expect(lantern.anchors.light).toEqual([2.5, 4.5, 2.5]);
	});

	test('мостик: середина настила выше концов на подъём арки', () => {
		const m = archBridge({ length: 15, rise: 4 });
		expect(m.anchors.top[1] - m.anchors.start[1]).toBe(4);
		expect(m.anchors.end[0]).toBe(14.5);
	});
});
