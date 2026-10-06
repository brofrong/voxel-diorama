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
			{ name: 'glow', material: { color: '#ffd27a', emissive: 1, kind: 'solid' } },
		]);
	});
});

describe('normalizeMaterial', () => {
	test('строка → solid без свечения', () => {
		expect(normalizeMaterial('#AABBCC')).toEqual({ color: '#aabbcc', emissive: 0, kind: 'solid' });
	});

	test('неверный цвет → ошибка', () => {
		expect(() => normalizeMaterial('red')).toThrow('#rrggbb');
	});
});
