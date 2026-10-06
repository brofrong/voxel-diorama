const formatter = new Intl.DateTimeFormat('ru-RU', {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC',
});

/** 'YYYY-MM-DD' → «6 октября 2026 г.» — одинаково на сервере и в браузере. */
export function formatDate(iso: string): string {
	return formatter.format(new Date(`${iso}T00:00:00Z`));
}
