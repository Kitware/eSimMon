export function setAxesStyling(axes) {
  const tickCounts = axes.getTickCounts();
  let textValues = axes.getTextValues();
  const labels = new Array(3);
  const ticks = new Array(3);
  let start = 0;
  for (var i = 0; i < 2; i++) {
    // We only want x and y values for 2D plots, hence i < 2
    let numLabels = tickCounts[i] + 1;
    labels[i] = textValues.slice(start + 1, start + numLabels);
    ticks[i] = textValues.slice(start + 1, start += numLabels).map(v => {
      if (v.startsWith('−')) {
        // The negative values are stored with an em dash rather than a dash
        return parseFloat(v.slice(1)) * -1;
      }
      return parseFloat(v);
    });
  }
  // Hardcode the z values that we're not using
  labels[2] = ['0'];
  ticks[2] = [0];
  const faces = [false, false, false, false, false, true];
  // Only place labels on the left and bottom of the axes
  const edges = [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];
  return {faces, edges, ticks, labels}
}
