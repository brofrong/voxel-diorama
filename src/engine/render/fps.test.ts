import { expect, test } from 'bun:test';
import { FpsMeter } from './fps.ts';

test('до первого полного окна — 0, затем кадров в секунду за окно', () => {
	const fps = new FpsMeter(0.5);
	for (let i = 0; i < 10; i++) fps.sample(1 / 60);
	expect(fps.value).toBe(0);
	for (let i = 0; i < 30; i++) fps.sample(1 / 60);
	expect(fps.value).toBe(60);
});

test('значение обновляется окнами, а не каждым кадром', () => {
	const fps = new FpsMeter(0.5);
	for (let i = 0; i < 30; i++) fps.sample(1 / 60);
	expect(fps.value).toBe(60);
	for (let i = 0; i < 5; i++) fps.sample(1 / 30);
	expect(fps.value).toBe(60);
	for (let i = 0; i < 15; i++) fps.sample(1 / 30);
	expect(fps.value).toBe(30);
});

test('reset — снова 0 (пауза, скрытая вкладка)', () => {
	const fps = new FpsMeter(0.5);
	for (let i = 0; i < 40; i++) fps.sample(1 / 60);
	fps.reset();
	expect(fps.value).toBe(0);
});
