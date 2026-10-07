/** Кадров в секунду, усреднённо за окно (по умолчанию 0.5 с), чтобы число не дрожало. */
export class FpsMeter {
	private frames = 0;
	private elapsed = 0;
	value = 0;

	constructor(private readonly window = 0.5) {}

	sample(dt: number): void {
		this.frames++;
		this.elapsed += dt;
		if (this.elapsed >= this.window - 1e-9) {
			this.value = Math.round(this.frames / this.elapsed);
			this.frames = 0;
			this.elapsed = 0;
		}
	}

	reset(): void {
		this.frames = 0;
		this.elapsed = 0;
		this.value = 0;
	}
}
