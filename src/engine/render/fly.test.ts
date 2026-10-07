import { describe, expect, test } from 'bun:test';
import type { Vec3 } from '../types.ts';
import { clampPan, type FlyKey, flyKeyOf, flyVelocity, keyAllowed } from './fly.ts';

const v = (...keys: FlyKey[]) => new Set<FlyKey>(keys);
const close = (a: Vec3, b: Vec3): void => {
	for (let i = 0; i < 3; i++) expect(a[i]).toBeCloseTo(b[i], 6);
};

describe('flyVelocity', () => {
	// yaw 0 — камера на +z от цели и смотрит в −z.
	test('W — вперёд по взгляду, S — назад, A/D — вбок', () => {
		close(flyVelocity(v('forward'), 0, 10), [0, 0, -10]);
		close(flyVelocity(v('back'), 0, 10), [0, 0, 10]);
		close(flyVelocity(v('right'), 0, 10), [10, 0, 0]);
		close(flyVelocity(v('left'), 0, 10), [-10, 0, 0]);
	});

	test('направление поворачивается вместе с камерой', () => {
		// yaw π/2 — камера на +x, смотрит в −x.
		close(flyVelocity(v('forward'), Math.PI / 2, 10), [-10, 0, 0]);
		close(flyVelocity(v('right'), Math.PI / 2, 10), [0, 0, -10]);
	});

	test('пробел — вверх, Shift — вниз', () => {
		close(flyVelocity(v('up'), 1.3, 10), [0, 10, 0]);
		close(flyVelocity(v('down'), 1.3, 10), [0, -10, 0]);
	});

	test('по диагонали не быстрее, чем прямо; встречные клавиши гасят друг друга', () => {
		const d = flyVelocity(v('forward', 'right'), 0.7, 10);
		expect(Math.hypot(d[0], d[2])).toBeCloseTo(10, 6);
		close(flyVelocity(v('forward', 'back', 'up', 'down'), 0, 10), [0, 0, 0]);
	});
});

describe('clampPan', () => {
	const box = { min: [0, 0, 0] as Vec3, max: [100, 50, 100] as Vec3 };

	test('внутри коробки сдвиг не меняется', () => {
		expect(clampPan([50, 10, 50], [3, -2, 4], box)).toEqual([3, -2, 4]);
	});

	test('у края цель останавливается на границе по каждой оси отдельно', () => {
		expect(clampPan([98, 1, 50], [5, -4, 2], box)).toEqual([2, -1, 2]);
		expect(clampPan([0, 50, 100], [-1, 1, 1], box)).toEqual([0, 0, 0]);
	});
});

describe('клавиши', () => {
	test('WASD, пробел и оба Shift; прочие — нет', () => {
		expect(flyKeyOf('KeyW')).toBe('forward');
		expect(flyKeyOf('KeyA')).toBe('left');
		expect(flyKeyOf('KeyS')).toBe('back');
		expect(flyKeyOf('KeyD')).toBe('right');
		expect(flyKeyOf('Space')).toBe('up');
		expect(flyKeyOf('ShiftLeft')).toBe('down');
		expect(flyKeyOf('ShiftRight')).toBe('down');
		expect(flyKeyOf('KeyQ')).toBeNull();
	});

	const el = (tagName: string, extra: { type?: string; isContentEditable?: boolean } = {}) => ({
		tagName,
		type: extra.type ?? '',
		isContentEditable: extra.isContentEditable ?? false,
	});

	test('в текстовых полях клавиши не перехватываются', () => {
		expect(keyAllowed('forward', el('INPUT', { type: 'text' }))).toBe(false);
		expect(keyAllowed('forward', el('TEXTAREA'))).toBe(false);
		expect(keyAllowed('forward', el('SELECT'))).toBe(false);
		expect(keyAllowed('forward', el('DIV', { isContentEditable: true }))).toBe(false);
	});

	test('на кнопках и переключателях WASD работают, а пробел остаётся за элементом', () => {
		for (const target of [el('BUTTON'), el('INPUT', { type: 'checkbox' }), el('A')]) {
			expect(keyAllowed('forward', target)).toBe(true);
			expect(keyAllowed('up', target)).toBe(false);
		}
		expect(keyAllowed('forward', el('INPUT', { type: 'range' }))).toBe(true);
	});

	test('на холсте и вне элементов — всё работает', () => {
		expect(keyAllowed('up', el('CANVAS'))).toBe(true);
		expect(keyAllowed('up', el('BODY'))).toBe(true);
		expect(keyAllowed('up', null)).toBe(true);
	});
});
