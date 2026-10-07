import { describe, expect, test } from 'bun:test';
import { pointLight } from './lights.ts';
import {
	dust,
	fire,
	fireflies,
	isParticleDef,
	leaves,
	mist,
	rain,
	smoke,
	snow,
	sparks,
} from './particles.ts';

describe('фабрики частиц', () => {
	test('возвращают описания', () => {
		for (const def of [
			smoke({ at: [1, 1] }),
			fire({ at: 'campfire.fire' }),
			sparks({ attachTo: 'boat' }),
			fireflies(),
			snow({ intensity: 0.5 }),
			rain({ area: [0, 0, 10, 10] }),
			leaves(),
			mist({ height: 3 }),
			dust(),
		]) {
			expect(isParticleDef(def)).toBe(true);
		}
		expect(isParticleDef({ preset: 'smoke' })).toBe(false);
	});

	test('точечному эмиттеру нужно ровно одно из at / attachTo', () => {
		expect(() => smoke({})).toThrow('ровно одно из at или attachTo');
		expect(() => smoke({ at: [1, 1], attachTo: 'boat' })).toThrow('ровно одно из at или attachTo');
	});

	test('проверка параметров', () => {
		expect(() => smoke({ at: [1, 1], rate: 0 })).toThrow('rate');
		expect(() => fire({ at: [1, 1], color: 'red' })).toThrow('#rrggbb');
		expect(() => snow({ area: [10, 0, 5, 5] })).toThrow('area');
		expect(() => snow({ intensity: 3 })).toThrow('intensity');
		expect(() => fireflies({ count: 0 })).toThrow('count');
		expect(() => mist({ height: 0 })).toThrow('height');
	});
});

describe('pointLight', () => {
	test('значения по умолчанию и проверки', () => {
		expect(pointLight({ at: [1, 1] }).options).toMatchObject({
			intensity: 2,
			distance: 10,
			color: '#ffd27a',
		});
		expect(() => pointLight({})).toThrow('ровно одно из at или attachTo');
		expect(() => pointLight({ at: [1, 1], intensity: -1 })).toThrow('intensity');
		expect(() => pointLight({ at: [1, 1], distance: 0 })).toThrow('distance');
	});
});
