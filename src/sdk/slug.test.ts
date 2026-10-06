import { expect, test } from 'bun:test';
import { SLUG_RE, slugFromDioramaPath } from './slug.ts';

test('SLUG_RE принимает kebab-case и отвергает остальное', () => {
	for (const ok of ['quiet-valley', 'a', 'castle-2']) expect(SLUG_RE.test(ok)).toBe(true);
	for (const bad of ['Quiet', 'two--dashes', '-x', 'x-', 'с-кириллицей', 'a_b', '']) {
		expect(SLUG_RE.test(bad)).toBe(false);
	}
});

test('slugFromDioramaPath достаёт имя папки', () => {
	expect(slugFromDioramaPath('../../dioramas/quiet-valley/index.ts')).toBe('quiet-valley');
	expect(slugFromDioramaPath('/src/dioramas/x/models.ts')).toBeNull();
});
