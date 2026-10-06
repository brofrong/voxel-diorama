import { expect, test } from 'bun:test';
import { formatDate } from './format.ts';

test('formatDate по-русски и без сдвига часового пояса', () => {
	const s = formatDate('2026-10-06');
	expect(s).toContain('6 октября');
	expect(s).toContain('2026');
	expect(formatDate('2027-01-01')).toContain('1 января');
});
