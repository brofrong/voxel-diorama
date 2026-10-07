import { describe, expect, test } from 'bun:test';
import { hexToRgb8 } from '../voxel/palette.ts';
import {
	DayClock,
	directionalLight,
	emissiveScale,
	hourAt,
	nightFactor,
	paletteAt,
	sunDirection,
	sunElevation,
	TIME_SYNONYMS,
	wrapHour,
} from './daycycle.ts';
import { LIGHTING } from './presets.ts';

describe('солнце и ночь', () => {
	test('восход в 5 на +x, полдень высоко, закат в 19 на −x', () => {
		expect(sunDirection(5)[0]).toBeGreaterThan(0.9);
		expect(sunElevation(5)).toBeCloseTo(0, 6);
		expect(sunDirection(12)[1]).toBeGreaterThan(0.9);
		expect(sunDirection(19)[0]).toBeLessThan(-0.9);
		expect(sunElevation(19)).toBeCloseTo(0, 6);
		const d = sunDirection(9);
		expect(Math.hypot(...d)).toBeCloseTo(1, 6);
	});

	test('закат 18.5 — солнце ещё над горизонтом, ночь 23 — под', () => {
		expect(sunElevation(TIME_SYNONYMS.sunset)).toBeGreaterThan(0);
		expect(sunElevation(TIME_SYNONYMS.night)).toBeLessThan(0);
	});

	test('ночной коэффициент: 0 днём, 1 ночью, 0.5 на горизонте', () => {
		expect(nightFactor(12)).toBe(0);
		expect(nightFactor(0)).toBe(1);
		expect(nightFactor(5)).toBeCloseTo(0.5, 6);
	});

	test('emissiveScale от 0.6 до 1.5', () => {
		expect(emissiveScale(0)).toBeCloseTo(0.6, 6);
		expect(emissiveScale(1)).toBeCloseTo(1.5, 6);
	});

	test('направленный свет: днём солнце, ночью луна, у горизонта гаснет', () => {
		expect(directionalLight(12).intensityFactor).toBe(1);
		expect(directionalLight(12).direction[1]).toBeGreaterThan(0.9);
		const night = directionalLight(0);
		expect(night.direction[1]).toBeGreaterThan(0.5);
		expect(night.intensityFactor).toBe(1);
		expect(directionalLight(5).intensityFactor).toBeCloseTo(0, 6);
	});
});

describe('палитра', () => {
	test('опорные точки совпадают с пресетами', () => {
		expect(paletteAt(13).horizon).toBe(LIGHTING.day.horizon);
		expect(paletteAt(18.5).sunColor).toBe(LIGHTING.sunset.sunColor);
		expect(paletteAt(6.5).zenith).toBe(LIGHTING.dawn.zenith);
		expect(paletteAt(2).fog).toBe(LIGHTING.night.fog);
		expect(paletteAt(24)).toEqual(paletteAt(0));
	});

	test('непрерывна: шаг 0.01 ч не даёт скачков', () => {
		let prev = paletteAt(0);
		for (let h = 0.01; h <= 24; h += 0.01) {
			const cur = paletteAt(h);
			expect(Math.abs(cur.sunIntensity - prev.sunIntensity)).toBeLessThan(0.05);
			const a = hexToRgb8(cur.horizon);
			const b = hexToRgb8(prev.horizon);
			for (let i = 0; i < 3; i++) expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(3);
			prev = cur;
		}
	});
});

describe('часы суток', () => {
	test('hourAt: стоп, ход и переход через полночь', () => {
		expect(hourAt(100, { start: 13, speed: 0, cycle: 120 })).toBe(13);
		expect(hourAt(60, { start: 13, speed: 1, cycle: 120 })).toBeCloseTo(1, 6);
		expect(hourAt(30, { start: 22, speed: 2, cycle: 120 })).toBeCloseTo(10, 6);
		expect(wrapHour(-1)).toBe(23);
		expect(wrapHour(24)).toBe(0);
	});

	test('DayClock: setHour во время хода — время идёт дальше с нового часа', () => {
		const clock = new DayClock({ start: 10, speed: 1, cycle: 240 });
		clock.advance(10);
		expect(clock.hour).toBeCloseTo(11, 6);
		clock.setHour(23.9);
		expect(clock.hour).toBeCloseTo(23.9, 6);
		clock.advance(2);
		expect(clock.hour).toBeCloseTo(0.1, 6);
	});

	test('DayClock: смена скорости сохраняет текущий час', () => {
		const clock = new DayClock({ start: 8, speed: 1, cycle: 120 });
		clock.advance(5);
		const h = clock.hour;
		clock.setSpeed(0);
		clock.advance(100);
		expect(clock.hour).toBeCloseTo(h, 6);
		clock.setSpeed(2);
		clock.advance(5);
		expect(clock.hour).toBeCloseTo(h + 2, 6);
	});

	test('DayClock.reset возвращает настройки диорамы', () => {
		const clock = new DayClock({ start: 8, speed: 1, cycle: 120 });
		clock.advance(30);
		clock.reset({ start: 18.5, speed: 0, cycle: 60 });
		expect(clock.hour).toBe(18.5);
		expect(clock.speed).toBe(0);
		expect(clock.cycle).toBe(60);
	});
});
