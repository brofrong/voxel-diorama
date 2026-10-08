import { listCards } from '#lib/server/dioramas.ts';
import { resolve } from '$app/paths';
import type { RequestHandler } from './$types';

export const prerender = true;

/** Карта сайта для поисковиков: главная и все диорамы. */
export const GET: RequestHandler = ({ url }) => {
	const cards = listCards();
	const latest = cards
		.map((c) => c.createdAt)
		.sort()
		.at(-1);
	const entry = (path: string, lastmod?: string): string =>
		`  <url><loc>${new URL(path, url.href).href}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
	const body = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		entry(resolve('/'), latest),
		...cards.map((c) => entry(resolve('/d/[slug]', { slug: c.slug }), c.createdAt)),
		'</urlset>',
	].join('\n');
	return new Response(body, { headers: { 'Content-Type': 'application/xml' } });
};
