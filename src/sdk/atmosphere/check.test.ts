import { describe, expect, test } from 'bun:test';
import { bakeDiorama } from '../bake.ts';
import { type DioramaInput, defineDiorama } from '../schema.ts';
import { atmosphereWarnings, checkAtmosphere } from './check.ts';
import { pointLight } from './lights.ts';
import { smoke, snow } from './particles.ts';

const diorama = (extra: Pick<DioramaInput, 'particles' | 'lights'>) =>
	defineDiorama({
		meta: {
			title: 'Проверка',
			createdAt: '2026-10-07',
			author: { model: 'Тест' },
			launchedBy: { name: 'Тест', url: 'https://example.com' },
		},
		size: [16, 8, 16],
		palette: { grass: '#6aa84f' },
		build(w) {
			w.box([0, 0, 0], [15, 0, 15], 'grass');
			w.anchor('well', [4, 1, 4]);
		},
		...extra,
	});

describe('checkAtmosphere', () => {
	test('считает эмиттеры, частицы и свет', () => {
		const d = diorama({
			particles: [smoke({ at: 'well' }), snow()],
			lights: [pointLight({ at: 'well' })],
		});
		const stats = checkAtmosphere(d, bakeDiorama(d));
		expect(stats.emitters).toBe(2);
		expect(stats.lights).toBe(1);
		expect(stats.particles).toBeGreaterThan(0);
	});

	test('без атмосферы — нули', () => {
		const d = diorama({});
		expect(checkAtmosphere(d, bakeDiorama(d))).toEqual({ emitters: 0, particles: 0, lights: 0 });
	});

	test('неизвестный якорь — ошибка с номером эмиттера', () => {
		const d = diorama({ particles: [smoke({ at: 'house.chimney' })] });
		expect(() => checkAtmosphere(d, bakeDiorama(d))).toThrow('particles[0] smoke');
	});

	test('attachTo ссылается на сущности диорамы', () => {
		const d = diorama({ particles: [smoke({ attachTo: 'boat' })] });
		expect(() => checkAtmosphere(d, bakeDiorama(d))).toThrow('boat');
	});
});

describe('atmosphereWarnings', () => {
	test('предупреждение при > 80% каждого лимита', () => {
		expect(atmosphereWarnings({ emitters: 1, particles: 10, lights: 0 })).toEqual([]);
		const warnings = atmosphereWarnings({ emitters: 30, particles: 17_000, lights: 7 });
		expect(warnings).toHaveLength(3);
		expect(warnings.join(' ')).toContain('17000');
	});
});
