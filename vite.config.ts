import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { dioramaDev } from './vite/diorama-dev.ts';
import { thumbnailDev } from './vite/thumbnail.ts';

export default defineConfig({
	plugins: [
		dioramaDev(),
		thumbnailDev(),
		sveltekit({
			compilerOptions: {
				// Runes-режим для всего проекта, кроме библиотек.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
			},
			adapter: adapter({ strict: true }),
			// Абсолютные URL (og:image) при prerender. На деплое задаётся SITE_ORIGIN.
			paths: { origin: process.env.SITE_ORIGIN ?? 'http://localhost:5173' },
		}),
	],
});
