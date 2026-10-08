import { error } from '@sveltejs/kit';
import { dioramas, getViewerPayload } from '#lib/server/dioramas.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => dioramas.map(({ slug }) => ({ slug }));

export const load: PageServerLoad = ({ params }) => {
	const payload = getViewerPayload(params.slug);
	if (!payload) error(404, 'Diorama not found');
	return payload;
};
