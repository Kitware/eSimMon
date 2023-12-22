export function extractRange(array) {
  let minValue = array[0];
  let maxValue = array[0];
  for (let i = 0; i < array.length; i++) {
    const v = array[i];
    if (v < minValue) {
      minValue = v;
    } else if (v > maxValue) {
      maxValue = v;
    }
  }
  return [minValue, maxValue];
}

export function nextAvailableTimeStep(requested, available) {
  let timeStep = requested;
  if (!available.find((v) => v === timeStep)) {
    let idx = available.findIndex((v) => v >= timeStep);
    idx = idx === -1 ? available.length : idx;
    idx = Math.max((idx -= 1), 0);
    timeStep = available[idx];
  }
  return timeStep;
}
