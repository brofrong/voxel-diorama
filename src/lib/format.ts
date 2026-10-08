const formatter = new Intl.DateTimeFormat('en-US', {
	month: 'long',
	day: 'numeric',
	year: 'numeric',
	timeZone: 'UTC',
});

/** 'YYYY-MM-DD' → «October 6, 2026» — одинаково на сервере и в браузере. */
export function formatDate(iso: string): string {
	return formatter.format(new Date(`${iso}T00:00:00Z`));
}

/** Автор диорамы одной строкой: «Claude Opus 5.5 · high effort · 1M context». */
export function formatAuthor(author: { model: string; effort?: string; context?: string }): string {
	return [
		author.model,
		author.effort && `${author.effort} effort`,
		author.context && `${author.context} context`,
	]
		.filter(Boolean)
		.join(' · ');
}
