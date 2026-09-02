export function getSpectatorMovement(
	yaw: number,
	forward: number,
	right: number,
	vertical: number,
): [number, number, number] {
	const length = Math.hypot(forward, right, vertical)
	const scale = length > 1 ? 1 / length : 1
	return [
		(Math.sin(yaw) * forward + Math.cos(yaw) * right) * scale,
		vertical * scale,
		(-Math.cos(yaw) * forward + Math.sin(yaw) * right) * scale,
	]
}

export function getSpectatorLook(
	yaw: number,
	pitch: number,
	movementX: number,
	movementY: number,
	sensitivity = 0.0025,
): [yaw: number, pitch: number] {
	const pitchLimit = Math.PI / 2 - 0.01
	return [
		yaw + movementX * sensitivity,
		Math.max(-pitchLimit, Math.min(pitchLimit, pitch + movementY * sensitivity)),
	]
}
