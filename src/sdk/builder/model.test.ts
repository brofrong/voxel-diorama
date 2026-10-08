import { describe, expect, test } from 'bun:test';
import { normalizeMaterial } from '../materials.ts';
import { type Model, model, modelIndex } from './model.ts';

const count = (m: Model): number => m.data.reduce((n, v) => n + (v !== 0 ? 1 : 0), 0);
const palette = { stone: '#888888', wood: '#6b4a2b' };

describe('примитивы на ModelBuilder', () => {
	test('box включает оба угла и не зависит от их порядка', () => {
		const a = model({ size: [10, 10, 10], palette }, (m) => m.box([1, 1, 1], [2, 3, 4], 'stone'));
		const b = model({ size: [10, 10, 10], palette }, (m) => m.box([2, 3, 4], [1, 1, 1], 'stone'));
		expect(count(a)).toBe(2 * 3 * 4);
		expect(a.data).toEqual(b.data);
	});

	test('sphere радиуса 2 — 33 вокселя', () => {
		const m = model({ size: [9, 9, 9], palette }, (b) => b.sphere([4, 4, 4], 2, 'stone'));
		expect(count(m)).toBe(33);
	});

	test('cylinder радиуса 1 и высоты 3 — 15 вокселей', () => {
		const m = model({ size: [5, 5, 5], palette }, (b) => b.cylinder([2, 0, 2], 1, 3, 'stone'));
		expect(count(m)).toBe(15);
	});

	test('line по диагонали без дыр', () => {
		const m = model({ size: [5, 5, 5], palette }, (b) => b.line([0, 0, 0], [3, 3, 0], 'stone'));
		expect(count(m)).toBe(4);
	});

	test("'air' вырезает, clear очищает", () => {
		const m = model({ size: [5, 5, 5], palette }, (b) => {
			b.box([0, 0, 0], [4, 4, 4], 'stone');
			b.set([2, 2, 2], 'air');
			b.clear([0, 0, 0], [4, 0, 4]);
		});
		expect(count(m)).toBe(125 - 1 - 25);
	});

	test('за границами — молча обрезается', () => {
		const m = model({ size: [4, 4, 4], palette }, (b) => b.box([-3, -3, -3], [10, 0, 10], 'stone'));
		expect(count(m)).toBe(16);
	});

	test('дробные координаты округляются вниз', () => {
		const m = model({ size: [4, 4, 4], palette }, (b) => {
			b.set([1.7, 0.2, 2.9], 'wood');
			expect(b.get([1, 0, 2])).toBe('wood');
		});
		expect(m.data[modelIndex(m.size, 1, 0, 2)]).toBe(2);
	});

	test('неизвестный материал — ошибка со списком доступных', () => {
		expect(() => model({ size: [4, 4, 4], palette }, (b) => b.set([0, 0, 0], 'gold'))).toThrow(
			'неизвестный материал "gold". Доступны: stone, wood',
		);
	});

	test('materials модели нормализованы и упорядочены как палитра', () => {
		const m = model(
			{ size: [1, 1, 1], palette: { glow: { color: '#FFD27A', emissive: 1 } } },
			() => {},
		);
		expect(m.materials).toEqual([
			{ name: 'glow', material: { color: '#ffd27a', emissive: 1, kind: 'solid', vary: 0.06 } },
		]);
	});
});

describe('scale, pivot, anchors', () => {
	test('по умолчанию scale 1, pivot — нижний центр, якорей нет', () => {
		const m = model({ size: [4, 6, 2], palette }, () => {});
		expect(m.scale).toBe(1);
		expect(m.pivot).toEqual([2, 0, 1]);
		expect(m.anchors).toEqual({});
	});

	test('явные scale, pivot и anchors сохраняются', () => {
		const m = model(
			{ size: [3, 3, 3], palette, scale: 0.25, pivot: [1.5, 3, 1.5], anchors: { hub: [1, 2, 0] } },
			() => {},
		);
		expect(m.scale).toBe(0.25);
		expect(m.pivot).toEqual([1.5, 3, 1.5]);
		expect(m.anchors).toEqual({ hub: [1, 2, 0] });
	});

	test('scale вне (0, 1] — ошибка', () => {
		expect(() => model({ size: [1, 1, 1], palette, scale: 0 }, () => {})).toThrow('scale модели');
		expect(() => model({ size: [1, 1, 1], palette, scale: 2 }, () => {})).toThrow('scale модели');
	});

	test('имя якоря модели проверяется', () => {
		expect(() =>
			model({ size: [1, 1, 1], palette, anchors: { 'Bad.name': [0, 0, 0] } }, () => {}),
		).toThrow('имя якоря');
	});
});

describe('normalizeMaterial', () => {
	test('строка → solid без свечения', () => {
		expect(normalizeMaterial('#AABBCC')).toEqual({
			color: '#aabbcc',
			emissive: 0,
			kind: 'solid',
			vary: 0.06,
		});
	});

	test('неверный цвет → ошибка', () => {
		expect(() => normalizeMaterial('red')).toThrow('#rrggbb');
	});

	test('vary: по умолчанию только у solid, явное значение сохраняется, вне 0..0.5 — ошибка', () => {
		expect(normalizeMaterial({ color: '#336699', kind: 'water' }).vary).toBe(0);
		expect(normalizeMaterial({ color: '#336699', kind: 'glass' }).vary).toBe(0);
		expect(normalizeMaterial({ color: '#336699', vary: 0 }).vary).toBe(0);
		expect(normalizeMaterial({ color: '#336699', vary: 0.2 }).vary).toBe(0.2);
		expect(() => normalizeMaterial({ color: '#336699', vary: 0.8 })).toThrow('vary');
	});
});
