import { listCards } from '#lib/server/dioramas.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ cards: listCards() });
