import type { Vec3 } from '../types.ts';

/** Полёт камеры с клавиатуры: WASD — по горизонтали относительно взгляда, пробел/Shift — вверх/вниз. */
export type FlyKey = 'forward' | 'back' | 'left' | 'right' | 'up' | 'down';

const KEYS: Readonly<Record<string, FlyKey>> = {
	KeyW: 'forward',
	KeyS: 'back',
	KeyA: 'left',
	KeyD: 'right',
	Space: 'up',
	ShiftLeft: 'down',
	ShiftRight: 'down',
};

/** По `KeyboardEvent.code` (не зависит от раскладки). */
export function flyKeyOf(code: string): FlyKey | null {
	return KEYS[code] ?? null;
}

interface FocusTarget {
	tagName: string;
	type?: string;
	isContentEditable?: boolean;
}

const TEXT_INPUTS = new Set(['', 'text', 'search', 'email', 'url', 'tel', 'password', 'number']);
const PRESSABLE = new Set(['BUTTON', 'A', 'SUMMARY']);

/**
 * Можно ли лететь, когда фокус на `target`. В текстовых полях клавиши — для ввода.
 * Пробел на кнопке/переключателе нажимает её, поэтому там он не перехватывается.
 */
export function keyAllowed(key: FlyKey, target: FocusTarget | null): boolean {
	if (!target) return true;
	const tag = target.tagName.toUpperCase();
	const type = (target.type ?? '').toLowerCase();
	if (target.isContentEditable || tag === 'TEXTAREA' || tag === 'SELECT') return false;
	if (tag === 'INPUT' && TEXT_INPUTS.has(type)) return false;
	if (key === 'up' && (PRESSABLE.has(tag) || tag === 'INPUT')) return false;
	return true;
}

/**
 * Скорость (ед./с). `yaw` — азимут камеры вокруг цели (OrbitControls): при yaw 0 камера на +z
 * и смотрит в −z. По горизонтали нормируется, чтобы по диагонали не было быстрее.
 */
export function flyVelocity(keys: ReadonlySet<FlyKey>, yaw: number, speed: number): Vec3 {
	const f = (keys.has('forward') ? 1 : 0) - (keys.has('back') ? 1 : 0);
	const r = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
	const up = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0);
	const fx = -Math.sin(yaw);
	const fz = -Math.cos(yaw);
	// right = forward × up
	let x = f * fx - r * fz;
	let z = f * fz + r * fx;
	const len = Math.hypot(x, z);
	if (len > 0) {
		x = (x / len) * speed;
		z = (z / len) * speed;
	}
	return [x + 0, up * speed, z + 0];
}

export interface Box {
	min: Vec3;
	max: Vec3;
}

/** Сдвиг, после которого цель остаётся в коробке (по каждой оси отдельно). */
export function clampPan(target: Vec3, delta: Vec3, box: Box): Vec3 {
	return [0, 1, 2].map((i) => {
		const next = Math.min(box.max[i], Math.max(box.min[i], target[i] + delta[i]));
		return next - target[i] + 0; // + 0: без −0
	}) as Vec3;
}

/** Нажатые клавиши полёта. Слушает window; при потере фокуса окна всё отпускается. */
export class FlyInput {
	readonly keys = new Set<FlyKey>();

	constructor(private readonly win: Window) {
		win.addEventListener('keydown', this.down);
		win.addEventListener('keyup', this.up);
		win.addEventListener('blur', this.clear);
		win.document.addEventListener('visibilitychange', this.clear);
	}

	private readonly down = (e: KeyboardEvent): void => {
		const key = flyKeyOf(e.code);
		if (!key || e.ctrlKey || e.metaKey || e.altKey) return;
		if (!keyAllowed(key, e.target instanceof HTMLElement ? e.target : null)) return;
		if (key === 'up') e.preventDefault(); // не прокручивать страницу
		this.keys.add(key);
	};

	private readonly up = (e: KeyboardEvent): void => {
		const key = flyKeyOf(e.code);
		if (!key) return;
		// Второй Shift может быть ещё зажат — отпускаем «вниз» только когда оба отпущены.
		if (key === 'down' && e.shiftKey) return;
		if (key === 'up' && this.keys.has('up')) e.preventDefault();
		this.keys.delete(key);
	};

	private readonly clear = (): void => {
		this.keys.clear();
	};

	dispose(): void {
		this.win.removeEventListener('keydown', this.down);
		this.win.removeEventListener('keyup', this.up);
		this.win.removeEventListener('blur', this.clear);
		this.win.document.removeEventListener('visibilitychange', this.clear);
		this.keys.clear();
	}
}
