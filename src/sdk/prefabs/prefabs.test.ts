import { describe, expect, test } from 'bun:test';
import type { Model } from '../builder/model.ts';
import { modelIndex } from '../builder/model.ts';
import { createRng } from '../rng.ts';
import { house, pine, rock, tree } from './index.ts';

const factories = { tree, pine, house, rock } as const;

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
