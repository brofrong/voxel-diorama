import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

/** Версия файла для URL: первые 10 hex sha256 содержимого; нет файла — null. */
export function contentVersion(file: string): string | null {
	if (!existsSync(file)) return null;
	return createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 10);
}
