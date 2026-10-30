/**
 * Host half of the Ctrl + Wheel Zoom bundle.
 *
 * Page zoom happens entirely in the browser, so the Host contributes no
 * service and no tool. The row exists so the bundle can be installed, listed,
 * enabled and disabled in the active profile; the Client half (./client.js)
 * owns the wheel/keyboard gestures, the remembered level and the zoom chip.
 */
export function apply() {}
