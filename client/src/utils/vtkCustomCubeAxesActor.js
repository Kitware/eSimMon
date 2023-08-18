import macro from "@kitware/vtk.js/macros";
import vtkCubeAxesActor from "@kitware/vtk.js/Rendering/Core/CubeAxesActor";
import * as d3 from "d3-scale";

const facesToDraw = [false, false, false, false, false, true];
const edgesToDraw = [0, 0, 0, 0, 1, 2, 2, 1, 0, 0, 0, 0];

function vtkCustomCubeAxesActor(publicAPI, model) {
  model.classHierarchy.push("vtkCustomCubeAxesActor");

  publicAPI.update = () => {
    if (!model.camera) {
      return;
    }

    // compute what faces to draw
    const facesChanged = publicAPI.computeFacesToDraw();
    // const facesToDraw = model.lastFacesToDraw;

    // have the bounds changed?
    let boundsChanged = false;
    for (let i = 0; i < 6; i++) {
      if (model.dataBounds[i] !== model.lastTickBounds[i]) {
        boundsChanged = true;
        model.lastTickBounds[i] = model.dataBounds[i];
      }
    }

    // did something significant change? If so rebuild a lot of things
    if (facesChanged || boundsChanged || model.forceUpdate) {
      // compute tick marks for axes
      const ticks = [];
      const tickStrings = [];
      for (let i = 0; i < 2; i++) {
        // We only want x and y values for 2D plots, hence i < 2
        const scale = d3
          .scaleLinear()
          .domain([model.dataBounds[i * 2], model.dataBounds[i * 2 + 1]]);
        ticks[i] = scale.ticks(model.ticksNo);
        const format = scale.tickFormat(model.ticksNo);
        tickStrings[i] = ticks[i].map((t) => t / model.ticksScale).map(format);
      }

      // Hardcode the z values that we're not using
      tickStrings[2] = ["0"];
      ticks[2] = [0];

      const [showX, showY] = model.visibleLabels;
      let edges = [...edgesToDraw];
      edges[4] = showX ? 1 : 2;
      edges[7] = showY ? 1 : 2;

      // update gridlines / edge lines
      publicAPI.updatePolyData(facesToDraw, edges, ticks);

      // compute label world coords and text
      publicAPI.updateTextData(facesToDraw, edges, ticks, tickStrings);

      // rebuild the texture only when force or changed bounds, face
      // visibility changes do to change the atlas
      if (boundsChanged || model.forceUpdate) {
        publicAPI.updateTextureAtlas(tickStrings);
      }
    }

    model.forceUpdate = false;
  };
}

const DEFAULT_VALUES = {
  ticksNo: 4,
  ticksScale: 1,
  visibleLabels: [true, true],
};

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  vtkCubeAxesActor.extend(publicAPI, model, initialValues);
  macro.setGet(publicAPI, model, ["ticksNo"]);
  macro.setGet(publicAPI, model, ["ticksScale"]);
  macro.setGetArray(publicAPI, model, ["visibleLabels"], 2);
  vtkCustomCubeAxesActor(publicAPI, model);
}

export const newInstance = macro.newInstance(extend, "vtkCustomCubeAxesActor");

export default { newInstance, extend };
