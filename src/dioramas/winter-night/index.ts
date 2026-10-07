import { defineDiorama, fire, orbit, pointLight, prefabs, smoke, snow, sparks } from '#sdk';

const HOUSES = [
	{ name: 'house1', x: 24, z: 22, rotate: 180 },
	{ name: 'house2', x: 46, z: 20, rotate: 180 },
	{ name: 'house3', x: 60, z: 60, rotate: 0 },
	{ name: 'house4', x: 40, z: 64, rotate: 0 },
] as const;

const LAMPS = [
	{ name: 'lamp1', x: 34, z: 34 },
	{ name: 'lamp2', x: 54, z: 34 },
	{ name: 'lamp3', x: 50, z: 52 },
] as const;

const FIRE = { x: 44, z: 42 };
const POND = { x: 18, z: 56, r: 8 };

export default defineDiorama({
	meta: {
		title: 'Зимняя ночь',
		createdAt: '2026-10-07',
		description: 'Заснеженная деревня: дым из труб, фонари, костёр с жителями и замёрзший пруд',
		tags: ['зима', 'ночь', 'деревня', 'костёр'],
	},
	seed: 23,
	size: [80, 32, 80],
	palette: {
		snow: '#eef3f8',
		dirt: '#6b5040',
		'pond-bed': '#4a5d6e',
		ice: { color: '#bfe3f5', kind: 'glass' },
	},
	build(w) {
		w.terrain({ noise: 'hills', base: 8, amp: 3, top: 'snow', fill: 'dirt' });

		/** Ровная заснеженная площадка; возвращает y, на который ставить модель. */
		const pad = (x: number, z: number, r: number): number => {
			const y = Math.max(w.heightAt(x, z), 8);
			w.box([x - r, 0, z - r], [x + r, y - 1, z + r], 'dirt');
			w.box([x - r, y, z - r], [x + r, y, z + r], 'snow');
			w.clear([x - r, y + 1, z - r], [x + r, w.size[1] - 1, z + r]);
			return y + 1;
		};

		// Замёрзший пруд: чаша с тёмным дном и стеклянным льдом.
		for (let x = POND.x - POND.r; x <= POND.x + POND.r; x++) {
			for (let z = POND.z - POND.r; z <= POND.z + POND.r; z++) {
				if (Math.hypot(x - POND.x, z - POND.z) > POND.r) continue;
				const top = w.heightAt(x, z);
				if (top >= 6) w.clear([x, 6, z], [x, top, z]);
				w.set([x, 5, z], 'pond-bed');
				w.set([x, 6, z], 'ice');
			}
		}

		for (const h of HOUSES) {
			const y = pad(h.x, h.z, 6);
			w.place(prefabs.house({ roof: '#e3e9f0', rng: w.rng.fork() }), [h.x, y, h.z], {
				rotate: h.rotate,
				name: h.name,
			});
		}
		for (const l of LAMPS) {
			const y = pad(l.x, l.z, 1);
			w.place(prefabs.lantern(), [l.x, y, l.z], { name: l.name });
		}
		const fy = pad(FIRE.x, FIRE.z, 5);
		w.place(prefabs.campfire(), [FIRE.x, fy, FIRE.z], { name: 'campfire' });

		// Ели — по краям, не на площадках и не на пруду.
		w.scatter(prefabs.pine, { count: 10, on: 'snow', minDistance: 6, area: [0, 0, 79, 10] });
		w.scatter(prefabs.pine, { count: 8, on: 'snow', minDistance: 6, area: [70, 0, 79, 79] });
		w.scatter(prefabs.pine, { count: 8, on: 'snow', minDistance: 6, area: [0, 72, 79, 79] });
		w.scatter(prefabs.pine, { count: 4, on: 'snow', minDistance: 6, area: [0, 12, 12, 44] });
	},
	entities: [
		{
			id: 'villagers',
			rig: prefabs.villager(),
			count: 3,
			animate: orbit({ center: 'campfire.fire', radius: 3.5, speed: 0.25 }),
		},
	],
	particles: [
		...HOUSES.map((h) => smoke({ at: `${h.name}.chimney`, rate: 5 })),
		fire({ at: 'campfire.fire', size: 'small' }),
		sparks({ at: 'campfire.fire' }),
		snow({ intensity: 0.6 }),
	],
	lights: [
		pointLight({
			at: 'campfire.fire',
			color: '#ff9a3c',
			intensity: 6,
			distance: 14,
			flicker: true,
		}),
		...LAMPS.map((l) =>
			pointLight({
				at: `${l.name}.light`,
				color: '#ffd28a',
				intensity: 3,
				distance: 10,
				onlyAtNight: true,
			}),
		),
	],
	atmosphere: { time: { start: 21, speed: 0.5 }, sky: 'stylized' },
	camera: { captureTime: 4 },
});
