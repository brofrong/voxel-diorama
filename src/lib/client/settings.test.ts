import { describe, expect, test } from 'bun:test';
import { formatHour, parseSettings, resolveSettings, serializeSettings } from './settings.ts';

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
