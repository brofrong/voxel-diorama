import { describe, expect, test } from 'bun:test';
import {
	formatHour,
	loadSettings,
	parseSettings,
	resolveSettings,
	saveSettings,
	serializeSettings,
} from './settings.ts';

describe('parseSettings', () => {
	test('мусор и старые форматы — пустые настройки без исключения', () => {
		for (const raw of [
			null,
			'',
			'not json',
			'42',
			'[]',
			'{"quality":"ultra"}',
			'{"particles":"yes"}',
		]) {
			expect(parseSettings(raw)).toEqual({});
		}
	});

	test('валидные поля читаются, лишние игнорируются', () => {
		expect(
			parseSettings('{"quality":"low","particles":false,"autoRotate":true,"speed":2}'),
		).toEqual({
			quality: 'low',
			particles: false,
			autoRotate: true,
		});
		expect(parseSettings('{"quality":"medium","particles":3}')).toEqual({ quality: 'medium' });
	});

	test('serialize ↔ parse', () => {
		const s = { quality: 'high' as const, particles: true, autoRotate: false };
		expect(parseSettings(serializeSettings(s))).toEqual(s);
	});
});

describe('resolveSettings', () => {
	test('по умолчанию: авто, частицы вкл, автоповорот из диорамы', () => {
		expect(resolveSettings({}, { autoRotate: true, reducedMotion: false })).toEqual({
			quality: 'auto',
			particles: true,
			autoRotate: true,
		});
	});

	test('reduced motion выключает автоповорот, если зритель не включал', () => {
		expect(resolveSettings({}, { autoRotate: true, reducedMotion: true }).autoRotate).toBe(false);
		expect(
			resolveSettings({ autoRotate: true }, { autoRotate: true, reducedMotion: true }).autoRotate,
		).toBe(true);
	});
});

test('formatHour', () => {
	expect(formatHour(18.5)).toBe('18:30');
	expect(formatHour(9.25)).toBe('09:15');
	expect(formatHour(0)).toBe('00:00');
	expect(formatHour(23.999)).toBe('00:00');
});

describe('режим скриншота и недоступное хранилище', () => {
	test('capture игнорирует сохранённые частицы и автоповорот', () => {
		const s = resolveSettings(
			{ particles: false, autoRotate: true, quality: 'low' },
			{ autoRotate: true, reducedMotion: false, capture: true },
		);
		expect(s.particles).toBe(true);
		expect(s.autoRotate).toBe(false);
	});

	test('чтение и запись не бросают, если localStorage недоступен', () => {
		const blocked = (): Storage => {
			throw new DOMException('blocked', 'SecurityError');
		};
		expect(loadSettings(blocked)).toEqual({});
		expect(() =>
			saveSettings(blocked, { quality: 'low', particles: true, autoRotate: false }),
		).not.toThrow();
		const full = {
			getItem: () => null,
			setItem: () => {
				throw new DOMException('full', 'QuotaExceededError');
			},
		};
		expect(() =>
			saveSettings(() => full as unknown as Storage, {
				quality: 'low',
				particles: true,
				autoRotate: false,
			}),
		).not.toThrow();
	});
});
