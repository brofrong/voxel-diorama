/** Репозиторий сайта на GitHub. */
export const GITHUB_REPO = 'brofrong/voxel-diorama';
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

/** 1234 → «1.2k», 999 → «999». */
export function formatStars(count: number): string {
	if (count < 1000) return String(count);
	const k = count / 1000;
	return `${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}k`;
}
