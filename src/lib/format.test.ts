import { expect, test } from 'bun:test';
import { formatAuthor, formatDate } from './format.ts';

test('formatDate по-русски и без сдвига часового пояса', () => {
	const s = formatDate('2026-10-06');
	expect(s).toContain('6 октября');
	expect(s).toContain('2026');
	expect(formatDate('2027-01-01')).toContain('1 января');
});

test('formatAuthor: модель и необязательные effort/context', () => {
	expect(formatAuthor({ model: 'Claude Opus 5.5', effort: 'high', context: '1M' })).toBe(
		'Claude Opus 5.5 · high effort · 1M context',
	);
	expect(formatAuthor({ model: 'GPT-5' })).toBe('GPT-5');
});
