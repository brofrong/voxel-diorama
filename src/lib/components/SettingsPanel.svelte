<script lang="ts">
	import type { QualityLevel, QualitySetting, SkyKind } from '#engine';
	import {
		FLY_SPEED,
		formatHour,
		QUALITY_NAMES,
		QUALITY_OPTIONS,
		SKY_OPTIONS,
		SPEED_OPTIONS,
	} from '#lib/client/settings.ts';

	interface Props {
		hour: number;
		speed: number;
		sky: SkyKind;
		quality: QualitySetting;
		effectiveQuality: QualityLevel;
		particles: boolean;
		autoRotate: boolean;
		showFps: boolean;
		flySpeed: number;
		onHourInput: (hour: number) => void;
		onDrag: (dragging: boolean) => void;
		onSpeed: (speed: number) => void;
		onSky: (sky: SkyKind) => void;
		onQuality: (quality: QualitySetting) => void;
		onParticles: (on: boolean) => void;
		onAutoRotate: (on: boolean) => void;
		onShowFps: (on: boolean) => void;
		onFlySpeed: (multiplier: number) => void;
		onReset: () => void;
	}

	let p: Props = $props();
</script>

<div class="panel" role="dialog" aria-label="Diorama settings">
	<section>
		<label class="title" for="hour">Time of day <span class="value">{formatHour(p.hour)}</span></label>
		<input
			id="hour"
			type="range"
			min="0"
			max="24"
			step="0.05"
			value={p.hour}
			aria-label="Time of day"
			oninput={(e) => p.onHourInput(Number(e.currentTarget.value))}
			onpointerdown={() => p.onDrag(true)}
			onpointerup={() => p.onDrag(false)}
			onchange={() => p.onDrag(false)}
		/>
	</section>

	<section>
		<span class="title" id="speed-label">Day–night cycle speed</span>
		<fieldset class="segmented" aria-labelledby="speed-label">
			{#each SPEED_OPTIONS as option (option.value)}
				<button
					type="button"
					aria-pressed={p.speed === option.value}
					class:active={p.speed === option.value}
					onclick={() => p.onSpeed(option.value)}>{option.label}</button
				>
			{/each}
		</fieldset>
	</section>

	<section>
		<span class="title" id="sky-label">Sky</span>
		<fieldset class="skies" aria-labelledby="sky-label">
			{#each SKY_OPTIONS as option (option.value)}
				<button
					type="button"
					aria-pressed={p.sky === option.value}
					class:active={p.sky === option.value}
					onclick={() => p.onSky(option.value)}
				>
					<span class="swatch" style:background={option.swatch}></span>
					{option.label}
				</button>
			{/each}
		</fieldset>
	</section>

	<section>
		<span class="title" id="quality-label">
			Quality
			{#if p.quality === 'auto'}<span class="value">Auto · {QUALITY_NAMES[p.effectiveQuality]}</span>{/if}
		</span>
		<fieldset class="segmented" aria-labelledby="quality-label">
			{#each QUALITY_OPTIONS as option (option.value)}
				<button
					type="button"
					aria-pressed={p.quality === option.value}
					class:active={p.quality === option.value}
					onclick={() => p.onQuality(option.value)}>{option.label}</button
				>
			{/each}
		</fieldset>
	</section>

	<section class="toggles">
		<label><input type="checkbox" checked={p.particles} onchange={(e) => p.onParticles(e.currentTarget.checked)} /> Particles</label>
		<label><input type="checkbox" checked={p.autoRotate} onchange={(e) => p.onAutoRotate(e.currentTarget.checked)} /> Auto-rotate</label>
		<label><input type="checkbox" checked={p.showFps} onchange={(e) => p.onShowFps(e.currentTarget.checked)} /> FPS</label>
	</section>

	<section class="fly">
		<label class="title" for="fly-speed">
			Flight speed <span class="value">{p.flySpeed.toFixed(2)}×</span>
		</label>
		<input
			id="fly-speed"
			type="range"
			min={FLY_SPEED.min}
			max={FLY_SPEED.max}
			step={FLY_SPEED.step}
			value={p.flySpeed}
			aria-label="Flight speed"
			oninput={(e) => p.onFlySpeed(Number(e.currentTarget.value))}
		/>
		<p class="hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> — fly, <kbd>Space</kbd> / <kbd>Shift</kbd> — up / down</p>
	</section>

	<button type="button" class="reset" onclick={p.onReset}>Reset to diorama defaults</button>
</div>

<style>
	.panel {
		position: absolute;
		top: 64px;
		right: 16px;
		width: 320px;
		padding: 16px;
		border-radius: var(--radius);
		background: rgb(14 15 19 / 0.82);
		backdrop-filter: blur(10px);
		display: grid;
		gap: 14px;
		z-index: 10;
	}
	section {
		display: grid;
		gap: 8px;
	}
	.title {
		font-size: 13px;
		color: var(--muted);
		display: flex;
		justify-content: space-between;
	}
	.value {
		color: var(--text);
	}
	input[type='range'] {
		width: 100%;
		accent-color: var(--accent);
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	.segmented {
		display: grid;
		grid-auto-flow: column;
		gap: 4px;
	}
	.skies {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
	button {
		min-height: 40px;
		border: 0;
		border-radius: 10px;
		background: var(--surface-2);
		color: var(--text);
		font-size: 13px;
		cursor: pointer;
	}
	button.active {
		background: var(--accent);
		color: #1a1206;
	}
	.skies button {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 10px;
	}
	.swatch {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		flex: none;
	}
	.toggles {
		display: flex;
		gap: 16px;
		font-size: 14px;
	}
	.toggles {
		flex-wrap: wrap;
	}
	.hint {
		margin: 0;
		font-size: 12px;
		color: var(--muted);
		line-height: 1.8;
	}
	kbd {
		display: inline-block;
		min-width: 1.6em;
		padding: 0 5px;
		margin-right: 2px;
		border-radius: 5px;
		background: var(--surface-2);
		color: var(--text);
		font: inherit;
		text-align: center;
	}
	/* На тачскрине клавиатуры нет — полёт недоступен. */
	@media (pointer: coarse) {
		.fly {
			display: none;
		}
	}
	.reset {
		background: transparent;
		color: var(--muted);
		text-decoration: underline;
	}
	@media (max-width: 600px) {
		.panel {
			top: auto;
			bottom: 0;
			left: 0;
			right: 0;
			width: auto;
			border-radius: var(--radius) var(--radius) 0 0;
			max-height: 70dvh;
			overflow-y: auto;
		}
	}
</style>
