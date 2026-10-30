/**
 * Client half of the Ctrl + Wheel Zoom bundle.
 *
 * CTRL (or ⌘ on macOS) + mouse wheel zooms the whole Web UI in 10% steps
 * between 50% and 200%. CTRL + `+` / `-` / `0` do the same from the keyboard.
 * A chip pinned to the frame's bottom-right corner reports the level whenever
 * it is not 100%; its `−` / `+` buttons step the level and clicking the
 * percentage resets it.
 *
 * Why CSS `zoom` on the document element: it scales layout, text and fixed
 * overlay layers together like the browser's own page zoom, while the app's
 * own scroll containers keep working. A `transform: scale()` wrapper cannot
 * scroll its oversized content, and a font-size change would only touch text.
 *
 * The wheel listener runs in the capture phase on `window`, so it sees the
 * gesture before the app's scroll containers. While CTRL is held it always
 * calls `preventDefault()`, which also stops the browser's native page zoom
 * from applying a second, independent level. A gesture another component has
 * already handled (`event.defaultPrevented`, e.g. an embedded editor or map
 * with its own CTRL+wheel zoom) is never stolen.
 *
 * Everything the plugin registers lives inside `ctx.effect`, so unloading it
 * removes the chip entry, both listeners, the stylesheet and the applied
 * `zoom` property. The factory itself has no side effects.
 */
window.__ModuleLoader__.load({
	id: 'dsh-ctrl-zoom',
	factory(require) {
		const React = require('react');
		const h = React.createElement;

		/** This package's id: the module-loader id and the stylesheet tag owner. */
		const PLUGIN_ID = 'dsh-ctrl-zoom';

		/** Locale namespace and dictionaries (the zh key set is the source of truth). */
		const NS = 'dsh-ctrl-zoom';
		const ZH = {
			'chip.label': '页面缩放',
			'chip.reset': '恢复 100%',
			'chip.title': '页面缩放 {percent}%',
			'step.in': '放大',
			'step.out': '缩小',
		};
		const EN = {
			'chip.label': 'Page zoom',
			'chip.reset': 'Reset to 100%',
			'chip.title': 'Page zoom {percent}%',
			'step.in': 'Zoom in',
			'step.out': 'Zoom out',
		};

		/** Zoom bounds and step, in percent. */
		const MIN = 50;
		const MAX = 200;
		const DEFAULT = 100;
		const STEP = 10;
		/** Wheel deltas below this accumulate instead of stepping, so trackpads feel right. */
		const WHEEL_THRESHOLD = 40;
		/** Browser-local zoom memory (display state, not a durable profile setting). */
		const STORAGE_KEY = 'dsh.plugin.dsh-ctrl-zoom';
		/** Pre-release key kept so an existing local setting survives the package rename. */
		const LEGACY_STORAGE_KEY = 'dsh.plugin.ctrl-zoom';

		/** Clamp into the zoom range; anything unusable resolves to 100%. */
		function clamp(value) {
			if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT;
			return Math.min(MAX, Math.max(MIN, Math.round(value)));
		}

		/** The document element, or undefined outside a browser. */
		function root() {
			return typeof document === 'undefined' ? undefined : document.documentElement;
		}

		/** Read the remembered zoom, falling back to 100% for corrupted storage. */
		function loadValue() {
			try {
				const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
				if (raw === null) return DEFAULT;
				const value = Number(raw);
				return Number.isFinite(value) ? clamp(value) : DEFAULT;
			} catch (error) {
				return DEFAULT;
			}
		}

		/** Persist the zoom; storage failures (quota, private mode) only lose memory. */
		function saveValue(value) {
			try {
				window.localStorage.setItem(STORAGE_KEY, String(value));
				window.localStorage.removeItem(LEGACY_STORAGE_KEY);
			} catch (error) {
				/* best effort: the zoom still applies for this page */
			}
		}

		/** The chip's styles: one floating pill anchored to the frame's corner, host tokens only. */
		const CHIP_CSS = `
.dshCtrlZoom_anchor{position:fixed;right:16px;bottom:16px;z-index:8;pointer-events:none}
.dshCtrlZoom_chip{box-sizing:border-box;display:inline-flex;align-items:center;gap:2px;padding:3px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 6px 20px color-mix(in srgb,var(--dsw-alias-label-primary) 14%,transparent);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:16px;user-select:none;pointer-events:auto}
.dshCtrlZoom_step{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:15px;line-height:1;cursor:pointer}
.dshCtrlZoom_step:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-label-primary) 9%,transparent);color:var(--dsw-alias-label-primary)}
.dshCtrlZoom_step:disabled{opacity:.35;cursor:default}
.dshCtrlZoom_value{box-sizing:border-box;min-width:46px;height:24px;padding:0 6px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;font-variant-numeric:tabular-nums;cursor:pointer}
.dshCtrlZoom_value:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 9%,transparent)}
.dshCtrlZoom_step:focus-visible,.dshCtrlZoom_value:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
`;

		return {
			inject: ['slots', 'locale'],
			apply(ctx) {
				const element = root();
				if (element === undefined) return;

				/* ----- Zoom state: one owner, read by gestures, the service and the chip. ----- */
				let value = loadValue();
				const listeners = new Set();

				function current() {
					return value;
				}

				/** Apply the level; 100% removes the property instead of pinning `zoom: 1`. */
				function applyZoom() {
					if (value === DEFAULT) element.style.removeProperty('zoom');
					else element.style.setProperty('zoom', String(value / 100));
				}

				function notify() {
					for (const listener of [...listeners]) {
						try {
							listener();
						} catch (error) {
							console.error('dsh-ctrl-zoom: subscriber failed', error);
						}
					}
				}

				/** The single write path: clamp, remember, apply, publish. */
				function setZoom(next) {
					const clamped = clamp(next);
					if (clamped === value) return;
					value = clamped;
					saveValue(value);
					applyZoom();
					notify();
				}

				/* Restore the remembered level before any surface mounts. */
				applyZoom();

				ctx.effect(() => {
					const tag = document.createElement('style');
					tag.setAttribute('data-plugin', PLUGIN_ID);
					tag.setAttribute('data-plugin-css', `${PLUGIN_ID}/chip.css`);
					tag.textContent = CHIP_CSS;
					document.head.appendChild(tag);
					return () => {
						tag.remove();
					};
				}, 'dsh-ctrl-zoom: chip stylesheet');

				ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'dsh-ctrl-zoom: dictionaries');
				const t = ctx.locale.bind(NS);

				/* ----- Gestures. ----- */
				let wheelDelta = 0;
				let wheelAt = 0;

				function onWheel(event) {
					if (!event.ctrlKey && !event.metaKey) {
						wheelDelta = 0;
						return;
					}
					if (event.defaultPrevented) return;
					/* Block browser page zoom and app scrolling for the whole gesture, even between steps. */
					event.preventDefault();
					const now = event.timeStamp || performance.now();
					if (now - wheelAt > 250) wheelDelta = 0;
					wheelAt = now;
					const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
					wheelDelta += event.deltaY * unit;
					if (Math.abs(wheelDelta) < WHEEL_THRESHOLD) return;
					const direction = wheelDelta < 0 ? 1 : -1;
					wheelDelta = 0;
					setZoom(current() + direction * STEP);
				}

				function onKeydown(event) {
					if (event.defaultPrevented || event.isComposing) return;
					if (!event.ctrlKey && !event.metaKey) return;
					if (event.altKey) return;
					const key = event.key;
					let next;
					if (key === '0' || key === ')') next = DEFAULT;
					else if (key === '=' || key === '+') next = current() + STEP;
					else if (key === '-' || key === '_') next = current() - STEP;
					else return;
					/* Swallow the chord even at a bound, so the browser's own zoom never drifts. */
					event.preventDefault();
					if (clamp(next) !== current()) setZoom(next);
					wheelDelta = 0;
				}

				ctx.effect(() => {
					window.addEventListener('wheel', onWheel, { capture: true, passive: false });
					window.addEventListener('keydown', onKeydown, true);
					return () => {
						window.removeEventListener('wheel', onWheel, { capture: true });
						window.removeEventListener('keydown', onKeydown, true);
						element.style.removeProperty('zoom');
					};
				}, 'dsh-ctrl-zoom: gestures');

				/** A small service face so other plugins and console scripts can read or drive the level. */
				ctx.effect(() => ctx.provide('dshCtrlZoom', {
					getZoom: current,
					setZoom: (next) => setZoom(Number(next)),
					stepZoom: (direction = 1) => setZoom(current() + (direction < 0 ? -STEP : STEP)),
					resetZoom: () => setZoom(DEFAULT),
					subscribe: (listener) => {
						listeners.add(listener);
						return () => {
							listeners.delete(listener);
						};
					},
				}), 'dsh-ctrl-zoom: service');

				/**
				 * The zoom chip (`shell.overlay`). It renders only while the level is not
				 * 100%, which keeps the frame untouched in the default state.
				 */
				function ZoomChip() {
					const [zoomValue, setZoomValue] = React.useState(current);
					const [, setLocaleTick] = React.useState(0);
					React.useEffect(() => {
						const listener = () => {
							setZoomValue(current());
						};
						listeners.add(listener);
						return () => {
							listeners.delete(listener);
						};
					}, []);
					React.useEffect(() => ctx.locale.subscribe(() => {
						setLocaleTick((tick) => tick + 1);
					}), []);
					if (zoomValue === DEFAULT) return null;
					return h(
						'div',
						{ className: 'dshCtrlZoom_anchor' },
						h(
							'div',
							{ className: 'dshCtrlZoom_chip', role: 'group', 'aria-label': t('chip.label') },
							h(
								'button',
								{
									type: 'button',
									className: 'dshCtrlZoom_step',
									title: t('step.out'),
									'aria-label': t('step.out'),
									disabled: zoomValue <= MIN,
									onClick: () => {
										setZoom(current() - STEP);
									},
								},
								'−',
							),
							h(
								'button',
								{
									type: 'button',
									className: 'dshCtrlZoom_value',
									title: t('chip.title', { percent: zoomValue }),
									'aria-label': t('chip.reset'),
									onClick: () => {
										setZoom(DEFAULT);
									},
								},
								`${zoomValue}%`,
							),
							h(
								'button',
								{
									type: 'button',
									className: 'dshCtrlZoom_step',
									title: t('step.in'),
									'aria-label': t('step.in'),
									disabled: zoomValue >= MAX,
									onClick: () => {
										setZoom(current() + STEP);
									},
								},
								'+',
							),
						),
					);
				}

				ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
					name: 'shell.overlay',
					id: 'dsh-ctrl-zoom-chip',
					order: 60,
				}, ZoomChip)), 'dsh-ctrl-zoom: chip');
			},
		};
	},
});
