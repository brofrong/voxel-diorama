import { defineDiorama, prefabs } from '#sdk';

export default defineDiorama({
	meta: {
		title: 'Тихая долина',
		createdAt: '2026-10-06',
		description: 'Домик у озера среди холмов на закате',
		tags: ['деревня', 'озеро', 'закат'],
	},
	seed: 7,
	size: [96, 40, 96],
	palette: {
		grass: '#6aa84f',
		dirt: '#7a5a3a',
		sand: '#d9c48a',
		water: { color: '#3a7bd5', kind: 'water' },
	},
	build(w) {
		w.terrain({ noise: 'hills', base: 12, amp: 10, top: 'grass', fill: 'dirt' });

		// Песчаный берег у воды.
		for (let x = 0; x < w.size[0]; x++) {
			for (let z = 0; z < w.size[2]; z++) {
				const h = w.heightAt(x, z);
				if (h >= 0 && h <= 11) w.set([x, h, z], 'sand');
			}
		}
		w.water({ level: 10 });

		// Ровная площадка под дом.
		const hx = 62;
		const hz = 40;
		const ground = Math.max(w.heightAt(hx, hz), 12);
		w.box([hx - 6, 0, hz - 6], [hx + 6, ground - 1, hz + 6], 'dirt');
		w.box([hx - 6, ground, hz - 6], [hx + 6, ground, hz + 6], 'grass');
		w.clear([hx - 6, ground + 1, hz - 6], [hx + 6, w.size[1] - 1, hz + 6]);
		w.place(prefabs.house({ roof: '#b5452f', rng: w.rng.fork() }), [hx, ground + 1, hz], {
			rotate: 180,
		});

		w.scatter(prefabs.tree, { count: 28, on: 'grass', minDistance: 6 });
		w.scatter(prefabs.pine, { count: 14, on: 'grass', minDistance: 7, area: [0, 0, 40, 95] });
		w.scatter(prefabs.rock, { count: 10, on: ['grass', 'sand'], minDistance: 5 });
	},
	atmosphere: { time: { fixed: 'sunset' }, fog: 0.003 },
});
