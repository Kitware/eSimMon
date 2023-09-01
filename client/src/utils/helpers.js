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
