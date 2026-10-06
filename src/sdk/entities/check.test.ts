import { describe, expect, test } from 'bun:test';
import { bakeDiorama } from '../bake.ts';
import { model } from '../builder/model.ts';
import { type DioramaInput, defineDiorama } from '../schema.ts';
import { custom, spin } from './behaviours.ts';
import { checkEntities, entityWarnings } from './check.ts';

const box = model({ size: [1, 1, 1], palette: { c: '#ffffff' } }, (m) => m.set([0, 0, 0], 'c'));

const diorama = (entities: DioramaInput['entities']) =>
	defineDiorama({
		meta: { title: 'Проверка', createdAt: '2026-10-07' },
		size: [16, 8, 16],
		palette: { grass: '#6aa84f' },
		build(w) {
			w.box([0, 0, 0], [15, 0, 15], 'grass');
			w.anchor('well', [4, 1, 4]);
		},
		entities,
	});

describe('checkEntities', () => {
	test('считает сущности, экземпляры и части', () => {
		const d = diorama([{ model: box, at: 'well', count: 3, animate: spin() }]);
		expect(checkEntities(d, bakeDiorama(d))).toEqual({ entities: 1, instances: 3, parts: 3 });
	});

	test('без сущностей — нули', () => {
		const d = diorama([]);
		expect(checkEntities(d, bakeDiorama(d))).toEqual({ entities: 0, instances: 0, parts: 0 });
	});

	test('опечатка в якоре — ошибка с именем сущности', () => {
		const d = diorama([{ id: 'blades', model: box, at: 'mil.hub' }]);
		expect(() => checkEntities(d, bakeDiorama(d))).toThrow(
			'сущность blades: неизвестный якорь "mil.hub"',
		);
	});

	test('исключение или NaN в позе — ошибка с экземпляром и t', () => {
		const boom = diorama([
			{
				id: 'cart',
				model: box,
				at: [2, 2],
				animate: custom((_, t) => {
					if (t > 3) throw new Error('сломалось');
				}),
			},
		]);
		expect(() => checkEntities(boom, bakeDiorama(boom))).toThrow('сущность cart, t=3.5: сломалось');
		const nan = diorama([
			{
				id: 'ghost',
				model: box,
				at: [2, 2],
				animate: custom((pose) => {
					pose.position[0] = Number.NaN;
				}),
			},
		]);
		expect(() => checkEntities(nan, bakeDiorama(nan))).toThrow('NaN');
	});
});

test('entityWarnings: предупреждение после 80% лимита', () => {
	expect(entityWarnings({ entities: 1, instances: 10, parts: 10 })).toEqual([]);
	expect(entityWarnings({ entities: 5, instances: 210, parts: 100 }).join()).toContain(
		'210 из 256',
	);
	expect(entityWarnings({ entities: 5, instances: 100, parts: 500 }).join()).toContain(
		'500 из 600',
	);
});
