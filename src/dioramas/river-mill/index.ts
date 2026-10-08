import {
	bob,
	defineDiorama,
	fireflies,
	flock,
	mist,
	prefabs,
	smoke,
	spin,
	sway,
	walkPath,
	wander,
} from '#sdk';

/** Середина русла по z для колонки x. */
const riverZ = (x: number): number => 38 + 5 * Math.sin(x / 12);

export default defineDiorama({
	meta: {
		title: 'Мельница у реки',
		createdAt: '2026-10-07',
		author: { model: 'Claude Opus 5.5', effort: 'high', context: '1M' },
		launchedBy: { name: 'Brofrong', url: 'https://github.com/brofrong' },
		description:
			'Мельница, житель на тропинке через мост, кот у дома, птицы над рекой; дым, туман и светлячки',
		tags: ['мельница', 'река', 'жители'],
	},
	seed: 11,
	size: [96, 40, 80],
	palette: {
		grass: '#6aa84f',
		dirt: '#7a5a3a',
		sand: '#d9c48a',
		water: { color: '#3a7bd5', kind: 'water' },
		plank: '#9c7a4f',
	},
	build(w) {
		w.terrain({ noise: 'hills', base: 14, amp: 5, top: 'grass', fill: 'dirt' });

		// Русло: глубокая середина и пологие песчаные берега.
		for (let x = 0; x < w.size[0]; x++) {
			const zc = riverZ(x);
			for (let z = Math.floor(zc - 6); z <= Math.ceil(zc + 6); z++) {
				const bottom = Math.abs(z - zc) < 4 ? 9 : 12;
				const top = w.heightAt(x, z);
				if (top > bottom) w.clear([x, bottom + 1, z], [x, top, z]);
				w.set([x, bottom, z], 'sand');
			}
		}
		w.water({ level: 11 });

		// Мост через реку.
		const bx = 50;
		const bz = riverZ(bx);
		w.box([bx - 1, 12, Math.floor(bz - 7)], [bx + 1, 12, Math.ceil(bz + 7)], 'plank');

		// Мельница на северном берегу, фасадом к реке (+z).
		const mx = 40;
		const mz = 18;
		const mh = w.heightAt(mx, mz);
		w.box([mx - 6, 0, mz - 6], [mx + 6, mh, mz + 6], 'grass');
		w.clear([mx - 6, mh + 1, mz - 6], [mx + 6, w.size[1] - 1, mz + 6]);
		w.place(prefabs.windmill(), [mx, mh + 1, mz], { rotate: 180, name: 'mill' });

		// Дом на южном берегу, фасадом к реке (−z).
		const hx = 60;
		const hz = 62;
		const hh = w.heightAt(hx, hz);
		w.box([hx - 6, 0, hz - 6], [hx + 6, hh, hz + 6], 'grass');
		w.clear([hx - 6, hh + 1, hz - 6], [hx + 6, w.size[1] - 1, hz + 6]);
		w.place(prefabs.house({ rng: w.rng.fork() }), [hx, hh + 1, hz], { name: 'house' });

		w.scatter(prefabs.tree, { count: 14, on: 'grass', minDistance: 7, area: [0, 0, 28, 79] });
		w.scatter(prefabs.pine, { count: 8, on: 'grass', minDistance: 6, area: [72, 0, 95, 79] });
		w.scatter(prefabs.rock, { count: 6, on: ['grass', 'sand'], minDistance: 5 });
	},
	entities: [
		{
			id: 'blades',
			model: prefabs.windmillBlades(),
			at: 'mill.hub',
			animate: spin({ axis: 'z', speed: 0.2 }),
		},
		{
			id: 'miller',
			rig: prefabs.villager({ shirt: '#3366cc' }),
			animate: walkPath(['mill.door', [50, 26], [50, 50], 'house.door'], {
				speed: 1.1,
				loop: 'pingpong',
				pause: 2,
			}),
		},
		{
			id: 'cat',
			rig: prefabs.cat({ color: '#e67e22' }),
			animate: wander({ area: [52, 69, 70, 76], speed: 0.6 }),
		},
		{
			id: 'birds',
			rig: prefabs.bird(),
			count: 6,
			animate: flock({ center: [48, 28, 40], radius: 14 }),
		},
		{
			id: 'boat',
			model: prefabs.boat(),
			at: [25, 11.8, 42],
			animate: [bob({ amp: 0.12, period: 3 }), sway({ angle: 3, period: 4 })],
		},
	],
	particles: [
		smoke({ at: 'house.chimney', rate: 5 }),
		mist({ area: [0, 30, 95, 46], height: 1.5 }),
		fireflies({ area: [40, 50, 75, 75], count: 40, onlyAtNight: true }),
	],
	atmosphere: { time: { start: 18.5, speed: 1 }, sky: 'realistic' },
	camera: { captureTime: 3 },
});
