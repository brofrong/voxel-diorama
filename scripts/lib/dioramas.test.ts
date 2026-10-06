import { expect, test } from 'bun:test';
import { listSlugs, loadDiorama, today } from './dioramas.ts';

test('today форматирует локальную дату как YYYY-MM-DD', () => {
	expect(today(new Date(2026, 9, 6))).toBe('2026-10-06');
	expect(today(new Date(2027, 0, 1))).toBe('2027-01-01');
});

test('listSlugs находит демо-диораму', () => {
	expect(listSlugs()).toContain('quiet-valley');
});

test('loadDiorama: несуществующая диорама — понятная ошибка', async () => {
	await expect(loadDiorama('no-such-diorama')).rejects.toThrow('нет файла');
});
