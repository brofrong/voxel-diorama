import { expect, test } from 'bun:test';
import { checkBuildEnv } from './build-env.ts';

test('корректное окружение', () => {
	expect(
		checkBuildEnv({ SITE_ORIGIN: 'https://brofrong.github.io', BASE_PATH: '/voxel-diorama' }),
	).toEqual({
		origin: 'https://brofrong.github.io',
		base: '/voxel-diorama',
	});
	expect(checkBuildEnv({ SITE_ORIGIN: 'http://localhost:4173' })).toEqual({
		origin: 'http://localhost:4173',
		base: '',
	});
});

test('нет SITE_ORIGIN — понятная ошибка', () => {
	expect(() => checkBuildEnv({})).toThrow('SITE_ORIGIN не задан');
});

test('неверный SITE_ORIGIN', () => {
	for (const bad of [
		'brofrong.github.io',
		'https://brofrong.github.io/',
		'https://x.io/path',
		'ftp://x.io',
	]) {
		expect(() => checkBuildEnv({ SITE_ORIGIN: bad })).toThrow('SITE_ORIGIN');
	}
});

test('неверный BASE_PATH', () => {
	for (const bad of ['voxel-diorama', '/voxel-diorama/', '/', '/a b']) {
		expect(() => checkBuildEnv({ SITE_ORIGIN: 'https://x.io', BASE_PATH: bad })).toThrow(
			'BASE_PATH',
		);
	}
	expect(checkBuildEnv({ SITE_ORIGIN: 'https://x.io', BASE_PATH: '' }).base).toBe('');
	expect(checkBuildEnv({ SITE_ORIGIN: 'https://x.io', BASE_PATH: '/a/b-c' }).base).toBe('/a/b-c');
});
