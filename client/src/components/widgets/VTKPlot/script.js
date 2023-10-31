import { isNil, isEqual } from "lodash";
import { mapGetters, mapMutations } from "vuex";
import {
  scalarBarAutoLayout,
  customGenerateTicks,
} from "../../../utils/vtkPlotStyling";
import { PlotType } from "../../../utils/constants";
import Annotations from "../Annotations";
import PlotLabel from "../PlotLabel";

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import "@kitware/vtk.js/Rendering/Profiles/Geometry";

import vtkActor from "@kitware/vtk.js/Rendering/Core/Actor";
import vtkColorMaps from "@kitware/vtk.js/Rendering/Core/ColorTransferFunction/ColorMaps";
import vtkColorTransferFunction from "@kitware/vtk.js/Rendering/Core/ColorTransferFunction";
import vtkDataArray from "@kitware/vtk.js/Common/Core/DataArray";
import vtkMapper from "@kitware/vtk.js/Rendering/Core/Mapper";
import vtkPointPicker from "@kitware/vtk.js/Rendering/Core/PointPicker";
import vtkPolyData from "@kitware/vtk.js/Common/DataModel/PolyData";
import vtkRenderer from "@kitware/vtk.js/Rendering/Core/Renderer";
import vtkScalarBarActor from "@kitware/vtk.js/Rendering/Core/ScalarBarActor";
import vtkCustomCubeAxesActor from "../../../utils/vtkCustomCubeAxesActor";
import { extractRange } from "../../../utils/helpers";

const Y_AXES_LABEL_BOUNDS_ADJUSTMENT = 0.001;
const MESH_XAXIS_SCALE_OFFSET = 0.1;
const RECTANGULAR_VIEWPORT_SCALING = 1.5;
const PROJ_DIR = [0, 0, -1];

export default {
  name: "VTKPlot",
  inject: ["girderRest", "fastRestUrl"],

  components: {
    Annotations,
    PlotLabel,
  },

  props: {
    itemId: {
      type: String,
      required: true,
    },
    plotXAxis: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      renderer: null,
      mesh: null,
      mapper: null,
      actor: null,
      axes: null,
      scalarBar: null,
      inThisRenderer: false,
      startPoints: null,
      camera: null,
      focalPoint: null,
      position: null,
      plotType: null,
      lastLoadedTimeStep: -1,
      currentRange: null,
      title: "",
    };
  },

  computed: {
    ...mapGetters({
      enableStepAnnotations: "UI_SHOW_STEP_ANNOTATION",
      showTitle: "UI_SHOW_TITLE",
      runGlobals: "UI_USE_RUN_GLOBALS",
      enableRangeAnnotations: "UI_SHOW_RANGE_ANNOTATION",
      xaxisVisible: "UI_SHOW_X_AXIS",
      yaxisVisible: "UI_SHOW_Y_AXIS",
      showScalarBar: "UI_SHOW_SCALAR_BAR",
      renderWindow: "UI_RENDER_WINDOW",
      syncZoom: "UI_ZOOM_SYNC",
      interactor: "UI_INTERACTOR",
      boxSelector: "UI_BOX_SELECTOR",
      currentTimeStep: "VIEW_TIME_STEP",
      minTimeStep: "VIEW_MIN_TIME_STEP",
      numReady: "VIEW_NUM_READY",
      maxTimeStep: "VIEW_MAX_TIME_STEP",
      numcols: "VIEWS_COLUMNS",
      numrows: "VIEWS_ROWS",
    }),
    availableTimeSteps() {
      return (
        this.$store.getters[`${this.itemId}/PLOT_AVAILABLE_TIME_STEPS`] || []
      );
    },
    loadedTimeStepData() {
      return this.$store.getters[`${this.itemId}/PLOT_LOADED_TIME_STEPS`] || [];
    },
    xAxis() {
      return this.$store.getters[`${this.itemId}/PLOT_X_AXIS`] || null;
    },
    scalarRange() {
      return this.$store.getters[`${this.itemId}/PLOT_COLOR_RANGE`] || null;
    },
    xRange() {
      return this.$store.getters[`${this.itemId}/PLOT_X_RANGE`] || null;
    },
    yRange() {
      return this.$store.getters[`${this.itemId}/PLOT_Y_RANGE`] || null;
    },
    zoom() {
      return this.$store.getters[`${this.itemId}/PLOT_ZOOM`] || null;
    },
    localTimeStep() {
      const ts = this.currentTimeStep;
      if (this.availableTimeSteps.includes(ts)) {
        return ts;
      }
      let idx = this.availableTimeSteps.findIndex((step) => step >= ts);
      idx = Math.max((idx -= 1), 0);
      return this.availableTimeSteps[idx];
    },
  },

  watch: {
    numrows: {
      immediate: true,
      handler() {
        this.$nextTick(this.updateViewPort);
      },
    },
    numcols: {
      immediate: true,
      handler() {
        this.$nextTick(this.updateViewPort);
      },
    },
    zoom: {
      immediate: true,
      handler() {
        if (!this.renderer) {
          return;
        }
        if (!this.position) {
          // If we load a zoomed plot from a template
          this.renderer.resetCamera();
          this.position = this.camera.getPosition();
        }
        this.updateZoomedView();
      },
    },
    itemId: {
      immediate: true,
      handler(new_id, old_id) {
        if (!new_id || (old_id && new_id !== old_id)) {
          this.removeRenderer();
          this.lastLoadedTimeStep = -1;
        }
      },
    },
    xaxisVisible: {
      immediate: true,
      handler(newVal, oldVal) {
        if (!isEqual(newVal, oldVal)) {
          this.react();
          this.resetCameraBounds();
        }
      },
    },
    yaxisVisible: {
      immediate: true,
      handler(newVal, oldVal) {
        if (!isEqual(newVal, oldVal)) {
          this.react();
          this.resetCameraBounds();
        }
      },
    },
    showScalarBar: {
      immediate: true,
      handler(newVal, oldVal) {
        if (!isEqual(newVal, oldVal)) {
          this.react();
        }
      },
    },
    runGlobals: {
      immediate: true,
      handler(newVal, oldVal) {
        if (!isEqual(newVal, oldVal)) {
          this.react();
          this.resetCameraBounds();
        }
      },
    },
  },

  methods: {
    ...mapMutations({
      updateRendererCount: "UI_RENDERER_COUNT_SET",
      showContextMenu: "UI_SHOW_CONTEXT_MENU_SET",
      setContextMenuItemData: "UI_CONTEXT_MENU_ITEM_DATA_SET",
      setMaxTimeStep: "VIEW_MAX_TIME_STEP_SET",
      setItemId: "VIEW_CURRENT_ITEM_ID_SET",
      setInitialLoad: "VIEW_INITIAL_LOAD_SET",
      setCurrentItemId: "VIEW_CURRENT_ITEM_ID_SET",
      updateNumReady: "VIEW_NUM_READY_SET",
      setRunId: "VIEWS_RUN_ID_SET",
      setSimulation: "VIEWS_SIMULATION_SET",
    }),
    updatePlotZoom(zoom) {
      this.$store.dispatch(`${this.itemId}/PLOT_ZOOM_CHANGED`, zoom);
    },
    react: function () {
      let nextImage = this.loadedTimeStepData.find(
        (img) => img.timestep == this.localTimeStep,
      );
      // Plots can be added faster than the data can update. Make sure that the
      // nextImage is the correct plot type.
      const readyForUpdate =
        !isNil(nextImage) && !Array.isArray(nextImage.data);
      if (readyForUpdate) {
        if (!this.xaxis) {
          let xAxis = nextImage.data.xLabel;
          this.$store.commit(`${this.itemId}/PLOT_X_AXIS_SET`, xAxis);
        }
        if (
          this.renderer &&
          this.plotType &&
          this.plotType == nextImage.data.type
        ) {
          this.updateRenderer(nextImage.data);
          this.lastLoadedTimeStep = nextImage.timestep;
        }
        this.updateNumReady(this.numReady + 1);
      }
    },
    updateViewPort() {
      this.$nextTick(() => {
        if (!this.renderer) {
          return;
        }

        const parent = document
          .getElementById("mainContent")
          .getBoundingClientRect();
        const { x, y, width, height } = this.$el.getBoundingClientRect();
        const viewport = [
          (x - parent.x) / parent.width,
          1 - (y + height) / parent.height,
          (x - parent.x + width) / parent.width,
          1 - y / parent.height,
        ];
        const h = viewport[3] - viewport[1];
        const w = viewport[2] - viewport[0];
        const midx = w / 2 + viewport[0];
        const midy = h / 2 + viewport[1];
        // Keep the viewport square for square plots
        let size = h > w ? w / 2 : h / 2;
        if (this.plotType === PlotType.Mesh) {
          if (h > w && this.numrows !== this.numcols) {
            // Keep the viewport rectangular for Mesh plots
            size *= RECTANGULAR_VIEWPORT_SCALING;
          }
        }
        this.renderer.setViewport(
          Math.max(viewport[0], midx - size),
          Math.max(viewport[1], midy - size),
          Math.min(viewport[2], midx + size),
          Math.min(viewport[3], midy + size),
        );
        this.resetCameraBounds();
      });
    },
    addRenderer(data) {
      if (this.renderer && this.plotType == data.type) {
        // We've already created a renderer, just re-use it
        return;
      }

      this.plotType = data.type;
      // Create the building blocks we will need for the polydata
      this.renderer = vtkRenderer.newInstance({ background: [1, 1, 1] });
      this.mesh = vtkPolyData.newInstance();
      this.actor = vtkActor.newInstance();
      this.mapper = vtkMapper.newInstance();

      this.renderWindow.addRenderer(this.renderer);
      this.updateRendererCount(this.renderWindow.getRenderers().length);

      if (this.plotType === PlotType.Mesh) {
        this.addMeshRenderer(data);
      }

      // Setup colormap
      const lut = vtkColorTransferFunction.newInstance();
      lut.applyColorMap(vtkColorMaps.getPresetByName("jet"));

      // Setup mapper and actor
      this.mapper.setInputData(this.mesh);
      this.mapper.setLookupTable(lut);
      this.actor.setMapper(this.mapper);
      this.renderer.addActor(this.actor);

      // Update renderer window
      this.camera = this.renderer.getActiveCamera();
      this.camera.setParallelProjection(true);

      // Create axis
      this.axes = vtkCustomCubeAxesActor.newInstance();
      this.axes.setCamera(this.camera);
      this.axes.setAxisLabels(data.xLabel, data.yLabel, "");
      this.axes.getProperty().setColor("black");
      this.axes.getProperty().setLineWidth(0.1);
      this.axes.setGridLines(false);
      this.axes.setVisibleLabels([this.xaxisVisible, this.yaxisVisible]);
      this.renderer.addActor(this.axes);

      // Build color bar
      this.scalarBar = vtkScalarBarActor.newInstance();
      this.scalarBar.setGenerateTicks(customGenerateTicks(1));
      this.scalarBar.setScalarsToColors(lut);
      this.scalarBar.setAxisLabel(data.colorLabel);
      this.scalarBar.setAxisTextStyle({ fontColor: "black" });
      this.scalarBar.setTickTextStyle({ fontColor: "black" });
      this.scalarBar.setDrawNanAnnotation(false);
      this.scalarBar.setAutoLayout(scalarBarAutoLayout(this.scalarBar));
      this.scalarBar.setVisibility(this.showScalarBar);
      this.renderer.addActor2D(this.scalarBar);

      if (this.plotType === PlotType.Scatter) {
        this.scalarBar.setVisibility(false);
      }

      // Setup picker
      this.setupPointPicker();

      this.$nextTick(this.updateViewPort);
    },
    addMeshRenderer(data) {
      // Load the cell attributes
      // Create a view of the data
      const connectivityView = new DataView(
        data.connectivity.buffer,
        data.connectivity.byteOffset,
        data.connectivity.byteLength,
      );
      const numberOfNodes =
        data.connectivity.length / Int32Array.BYTES_PER_ELEMENT / 3;
      const cells = new Int32Array(numberOfNodes * 4);
      var idx = 0;
      const rowSize = 3 * Int32Array.BYTES_PER_ELEMENT; // 3 => columns
      for (let i = 0; i < data.connectivity.length; i += rowSize) {
        cells[idx++] = 3;
        let index = i;
        cells[idx++] = connectivityView.getInt32(index, true);
        index += 4;
        cells[idx++] = connectivityView.getInt32(index, true);
        index += 4;
        cells[idx++] = connectivityView.getInt32(index, true);
      }
      this.mesh.getPolys().setData(cells);
    },
    updateRenderer(data) {
      this.title = data.title;
      if (this.plotType === PlotType.Mesh) {
        this.updateMeshRenderer(data);
      } else if (this.plotType === PlotType.ColorMap) {
        this.updateGridRenderer(data);
      } else {
        this.updateScatterRenderer(data);
      }

      if (data.color) {
        // Set the scalars
        // As we need a typed array we have to copy the data as its unaligned, so we have an aligned buffer to
        // use to create the typed array
        const buffer = data.color.buffer.slice(
          data.color.byteOffset,
          data.color.byteOffset + data.color.byteLength,
        );
        const color = new Float64Array(
          buffer,
          0,
          buffer.byteLength / Float64Array.BYTES_PER_ELEMENT,
        );
        const scalars = vtkDataArray.newInstance({
          name: "scalars",
          values: color,
        });

        // Build the polydata
        this.mesh.getPointData().setScalars(scalars);
        const scalarRange = this.runGlobals
          ? this.scalarRange
          : scalars.getRange();
        this.mapper.setScalarRange(...scalarRange);

        // Setup colormap
        const lut = this.mapper.getLookupTable();
        lut.setMappingRange(...scalars.getRange());
        lut.updateRange();

        // Update color bar
        this.scalarBar.setScalarsToColors(lut);
        this.scalarBar.setAutoLayout(scalarBarAutoLayout(this.scalarBar));
      }

      // Setup mapper and actor
      this.mapper.setInputData(this.mesh);

      // Update axes
      // TODO: Remove this when we have more functionality in VTK charts
      // Use the original data from the mesh rather than the potentially scaled
      // actor data
      this.axes.setDataBounds(...this.axesDataBounds());
      const [scale] = this.actor.getScale();
      this.axes.setTicksScale(scale);
      this.axes.setVisibleLabels([this.xaxisVisible, this.yaxisVisible]);

      // Update scalar bar
      this.scalarBar.setVisibility(this.showScalarBar);

      // Update camera
      if (!this.zoom) {
        // TODO: Remove this when we have more functionality in VTK charts
        this.resetCameraBounds();
        if (!this.position) {
          this.position = this.camera.getPosition();
        }
      }
    },
    updateGridRenderer(data) {
      // Load the point attributes
      // Create a view of the data
      const xBuffer = data.x.buffer.slice(
        data.x.byteOffset,
        data.x.byteOffset + data.x.byteLength,
      );
      const x = new Float64Array(
        xBuffer,
        0,
        xBuffer.byteLength / Float64Array.BYTES_PER_ELEMENT,
      );
      const yBuffer = data.y.buffer.slice(
        data.y.byteOffset,
        data.y.byteOffset + data.y.byteLength,
      );
      const y = new Float64Array(
        yBuffer,
        0,
        yBuffer.byteLength / Float64Array.BYTES_PER_ELEMENT,
      );

      const points = [];
      let cells = [];
      let idx = 0;
      for (let j = 0; j < y.length; j++) {
        for (let i = 0; i < x.length; i++) {
          points.push(x[i], y[j], 0.0);
          if (i < x.length - 1 && j < y.length - 1) {
            cells.push(
              5,
              idx,
              idx + x.length,
              idx + x.length + 1,
              idx + 1,
              idx,
            );
          }
          idx++;
        }
      }
      this.mesh.getPoints().setData(points, 3);
      this.mesh.getPolys().setData(cells);
      if (!this.zoom) {
        // FIXME: This is a hack to attempt to keep
        // the plot ratio relatively square
        const scale = this.actorScale(x, y);
        this.actor.setScale(scale, 1, 1);
      }
    },
    updateMeshRenderer(data) {
      // Load the point attributes
      // Create a view of the data
      const pointsView = new DataView(
        data.nodes.buffer,
        data.nodes.byteOffset,
        data.nodes.byteLength,
      );
      const numberOfPoints =
        data.nodes.length / Float64Array.BYTES_PER_ELEMENT / 2;
      const points = new Float64Array(numberOfPoints * 3);
      var idx = 0;
      const rowSize = 2 * Float64Array.BYTES_PER_ELEMENT; // 3 => columns
      for (let i = 0; i < data.nodes.length; i += rowSize) {
        points[idx++] = pointsView.getFloat64(i, true);
        points[idx++] = pointsView.getFloat64(i + 8, true);
        points[idx++] = 0.0;
      }
      this.mesh.getPoints().setData(points, 3);
    },
    updateScatterRenderer(data) {
      // Load the point attributes
      // Create a view of the data
      const xBuffer = data.x.buffer.slice(
        data.x.byteOffset,
        data.x.byteOffset + data.x.byteLength,
      );
      const x = new Float64Array(
        xBuffer,
        0,
        xBuffer.byteLength / Float64Array.BYTES_PER_ELEMENT,
      );
      const yBuffer = data.y.buffer.slice(
        data.y.byteOffset,
        data.y.byteOffset + data.y.byteLength,
      );
      const y = new Float64Array(
        yBuffer,
        0,
        yBuffer.byteLength / Float64Array.BYTES_PER_ELEMENT,
      );

      const points = [];
      const vertices = [];
      for (let i = 0; i < x.length; i++) {
        points.push(x[i], y[i], 0.0);
        vertices.push(1, i);
      }
      this.mesh.getVerts().setData(vertices);
      this.actor.getProperty().setColor(0, 0, 1);

      this.mesh.getPoints().setData(points, 3);
      if (!this.zoom) {
        // FIXME: This is a hack to attempt to keep
        // the plot ratio relatively square
        const scale = this.actorScale(x, y);
        this.actor.setScale(scale, 1, 1);
      }
    },
    removeRenderer() {
      // Remove the renderer if it exists, we're about to load a Plotly plot
      if (this.renderer) {
        this.renderWindow.removeRenderer(this.renderer);
        this.renderer.delete();
        this.renderer = null;
        this.updateRendererCount(this.renderWindow.getRenderers().length);
        this.position = null;
        this.renderWindow.render();
      }
    },
    enterCurrentRenderer() {
      if (this.renderer) {
        this.interactor.setCurrentRenderer(this.renderer);
      }
    },
    exitCurrentRenderer() {
      if (this.renderer) {
        this.interactor.setCurrentRenderer(null);
      }
    },
    setupPointPicker() {
      const picker = vtkPointPicker.newInstance();
      picker.setPickFromList(1);
      picker.initializePickList();
      picker.addPickList(this.actor);
      this.interactor.onLeftButtonPress((callData) => {
        this.inThisRenderer = this.renderer === callData.pokedRenderer;
        if (!this.inThisRenderer) {
          return;
        }
        const pos = callData.position;
        const point = [pos.x, pos.y, 0.0];
        picker.pick(point, this.renderer);
        if (picker.getActors().length !== 0) {
          const pickedPoints = picker.getPickedPositions();
          this.startPoints = [...pickedPoints[0]];
        }
      });
      this.interactor.onLeftButtonRelease((callData) => {
        this.inThisRenderer = this.renderer === callData.pokedRenderer;
        if (!this.inThisRenderer) {
          return;
        }
        const pos = callData.position;
        const point = [pos.x, pos.y, 0.0];
        picker.pick(point, this.renderer);
        const pickedPoints = picker.getPickedPositions();
        if (pickedPoints.length && this.startPoints) {
          if (isEqual(pickedPoints[0], this.startPoints)) {
            // This was just a single click
            return;
          }

          const bounds = this.$el.getBoundingClientRect();
          const r = bounds.width / bounds.height;

          const [startX, startY] = this.startPoints;
          const [finalX, finalY] = pickedPoints[0];
          const regionWidth = Math.abs(finalX - startX);
          const regionHeight = Math.abs(finalY - startY);

          let serverScale = 1;
          if (r < regionWidth / regionHeight) {
            serverScale = regionWidth / 2;
          }

          const xMid = (finalX - startX) / 2 + startX;
          const yMid = (finalY - startY) / 2 + startY;
          const focalPoint = [xMid, yMid, 0.0];
          const zoomBounds = [startX, finalX, startY, finalY];
          let zoomData = {
            focalPoint: focalPoint,
            bounds: zoomBounds,
            serverScale,
          };
          this.updatePlotZoom(zoomData);
        }
      });
    },
    resetZoom() {
      this.updatePlotZoom(null);
    },
    updateZoomedView() {
      if (!this.renderer) {
        return;
      }
      if (!this.zoom) {
        // TODO: Remove this when we have more functionality in VTK charts
        if (this.plotType !== PlotType.ColorMap) {
          this.camera.setPosition(...this.position);
        }
        this.camera.setDirectionOfProjection(...PROJ_DIR);
        this.resetCameraBounds();
      } else if (!isEqual(this.zoom.focalPoint, this.camera.getFocalPoint())) {
        if (this.zoom.bounds) {
          this.renderer.resetCamera([...this.zoom.bounds, 0, 0]);
          this.camera.setFocalPoint(...this.zoom.focalPoint);
        }
      }
    },
    annotationText() {
      const inputs = [];
      if (!this.xaxisVisible || !this.yaxisVisible || !this.showScalarBar) {
        let ranges = [];
        const mapRange = this.scalarBar
          ?.getScalarsToColors()
          .getMappingRange() || [-1, 1];
        if (this.zoom) {
          ranges.push(...this.zoom.bounds, ...mapRange);
        } else {
          const [scale] = this.actor?.getScale() || [1];
          if (this.runGlobals) {
            let yRange = this.yRange;
            if (this.plotType === PlotType.ColorMap) {
              // Reflect the scaled axes labels
              yRange = [yRange[0] / scale, yRange[1] / scale];
            }
            ranges.push(...this.xRange, ...yRange, ...this.scalarRange);
          } else {
            ranges = [...this.currentRange, ...mapRange];
          }
        }
        let [x0, x1, y0, y1, s0, s1] = ranges.map((r) => r.toPrecision(2));
        let xText = this.xaxisVisible ? "" : `X: [${x0},${x1}]`;
        let yText = this.yaxisVisible ? "" : `Y: [${y0},${y1}]`;
        let scalarText = this.showScalarBar ? "" : `C: [${s0},${s1}]`;
        xText = xText && (yText || scalarText) ? `${xText}, ` : xText;
        yText = yText && scalarText ? `${yText}, ` : yText;
        inputs.push(`${xText}${yText}${scalarText}`);
      }
      return inputs;
    },
    axesDataBounds() {
      if (!this.runGlobals) {
        return [...this.actor.getBounds()];
      }
      const [x0, x1, y0, y1] = this.actor.getBounds();
      let xBounds = this.runGlobals ? [...this.xRange] : [x0, x1];
      let yBounds = this.runGlobals ? [...this.yRange] : [y0, y1];
      const meshBounds = [...xBounds, ...yBounds, 0, 0];
      if (this.plotType === PlotType.ColorMap) {
        const [xscale] = this.actor.getScale();
        meshBounds[1] =
          meshBounds[1] * xscale + xscale * MESH_XAXIS_SCALE_OFFSET;
      }
      return meshBounds;
    },
    cameraBoundsOffset() {
      const parent = document
        .getElementById("mainContent")
        .getBoundingClientRect();
      const { width, height } = this.$el.getBoundingClientRect();
      let w = Math.abs(Math.log(width / parent.width));
      let h = Math.abs(Math.log(height / parent.height));
      return height > width ? w / 2 : h / 2;
    },
    resetCameraBounds() {
      if (!this.renderer) {
        return;
      }
      // TODO: Remove this when we have more functionality in VTK charts
      const bounds = this.axesDataBounds();
      if (this.plotType === PlotType.Mesh) {
        if (this.xaxisVisible) {
          // Hack to adjust the bounds to include the x label
          bounds[2] -= this.cameraBoundsOffset();
        }
        if (this.yaxisVisible) {
          // Hack to adjust the bounds to include the y label
          bounds[0] -= this.cameraBoundsOffset();
        }
      } else if (this.plotType === PlotType.Scatter) {
        // Hack to adjust the bounds to include the y label
        bounds[1] -= Y_AXES_LABEL_BOUNDS_ADJUSTMENT;
      } else if (this.plotType === PlotType.ColorMap) {
        if (this.yaxisVisible) {
          bounds[0] -=
            this.cameraBoundsOffset() * (Y_AXES_LABEL_BOUNDS_ADJUSTMENT / 2);
        }
      }
      this.renderer.resetCamera(bounds);
    },
    actorScale(xVals, yVals) {
      const [x0, x1] = this.runGlobals ? this.xRange : extractRange(xVals);
      const [y0, y1] = this.runGlobals ? this.yRange : extractRange(yVals);
      this.currentRange = [x0, x1, y0, y1];
      return (y1 - y0) / (x1 - x0);
    },
  },

  mounted() {
    this.$el.addEventListener("mouseenter", this.enterCurrentRenderer);
    this.$el.addEventListener("mouseleave", this.exitCurrentRenderer);
  },

  beforeDestroy() {
    this.removeRenderer();
  },
};
