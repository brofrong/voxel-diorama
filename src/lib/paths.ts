import { resolve } from '$app/paths';

/**
 * Путь к файлу из static/ с учётом base (на Pages сайт живёт на подпути). `path` начинается с /.
 * Через resolve('/'), а не asset(): asset() типизирован списком файлов static/ и не принимает `?v=`.
 */
export function withBase(path: string): string {
	return `${resolve('/')}${path.replace(/^\//, '')}`;
}
