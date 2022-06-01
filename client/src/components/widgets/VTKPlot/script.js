import { isNil, isEqual } from "lodash";
import { mapGetters, mapActions, mapMutations } from "vuex";
import {
  setAxesStyling,
  scalarBarAutoLayout,
} from "../../../utils/vtkPlotStyling";

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import "@kitware/vtk.js/Rendering/Profiles/Geometry";

import vtkActor from "@kitware/vtk.js/Rendering/Core/Actor";
import vtkColorMaps from "@kitware/vtk.js/Rendering/Core/ColorTransferFunction/ColorMaps";
import vtkColorTransferFunction from "@kitware/vtk.js/Rendering/Core/ColorTransferFunction";
import vtkCubeAxesActor from "@kitware/vtk.js/Rendering/Core/CubeAxesActor";
import vtkDataArray from "@kitware/vtk.js/Common/Core/DataArray";
import vtkMapper from "@kitware/vtk.js/Rendering/Core/Mapper";
import vtkPointPicker from "@kitware/vtk.js/Rendering/Core/PointPicker";
import vtkPolyData from "@kitware/vtk.js/Common/DataModel/PolyData";
import vtkRenderer from "@kitware/vtk.js/Rendering/Core/Renderer";
import vtkScalarBarActor from "@kitware/vtk.js/Rendering/Core/ScalarBarActor";

const AXES_LABEL_BOUNDS_ADJUSTMENT = 0.3;

export default {
  name: "VTKPlot",
  inject: ["girderRest", "fastRestUrl"],

  props: {
    itemId: {
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
      scale: 0,
      position: null,
      rangeText: [],
    };
  },

  computed: {
    ...mapGetters({
      currentTimeStep: "PLOT_TIME_STEP",
      numcols: "VIEW_COLUMNS",
      numrows: "VIEW_ROWS",
      renderWindow: "UI_RENDER_WINDOW",
      syncZoom: "UI_ZOOM_SYNC",
      minTimeStep: "PLOT_MIN_TIME_STEP",
      interactor: "UI_INTERACTOR",
      boxSelector: "PLOT_BOX_SELECTOR",
      numReady: "PLOT_NUM_READY",
      maxTimeStep: "PLOT_MAX_TIME_STEP",
      allAvailableTimeSteps: "PLOT_AVAILABLE_TIME_STEPS",
      allLoadedTimeStepData: "PLOT_LOADED_TIME_STEPS",
      plotDetails: "PLOT_DETAILS",
    }),
    availableTimeSteps() {
      if (!this.allAvailableTimeSteps) {
        return [];
      }
      return this.allAvailableTimeSteps[`${this.itemId}`] || [];
    },
    loadedTimeStepData() {
      if (!this.allLoadedTimeStepData) {
        return [];
      }
      return this.allLoadedTimeStepData[`${this.itemId}`] || [];
    },
    range() {
      if (!this.itemId || !this.plotDetails) {
        return null;
      }
      return this.plotDetails[`${this.itemId}`]?.range;
    },
    xAxis() {
      if (!this.itemId || !this.plotDetails) {
        return null;
      }
      return this.plotDetails[`${this.itemId}`]?.xAxis;
    },
    zoom() {
      if (!this.itemId || !this.plotDetails) {
        return null;
      }
      return this.plotDetails[`${this.itemId}`]?.zoom;
    },
  },

  watch: {
    numrows: {
      immediate: true,
      handler() {
        this.react();
        this.$nextTick(this.updateViewPort());
      },
    },
    numcols: {
      immediate: true,
      handler() {
        this.react();
        this.$nextTick(this.updateViewPort());
      },
    },
    range: {
      immediate: true,
      handler() {
        this.react();
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
  },

  methods: {
    ...mapActions({
      setMinTimeStep: "PLOT_MIN_TIME_STEP_CHANGED",
      updatePlotDetails: "PLOT_DETAILS_UPDATED",
    }),
    ...mapMutations({
      updateCellCount: "PLOT_VISIBLE_CELL_COUNT_SET",
      setMaxTimeStep: "PLOT_MAX_TIME_STEP_SET",
      setItemId: "PLOT_CURRENT_ITEM_ID_SET",
      setLoadedFromView: "PLOT_LOADED_FROM_VIEW_SET",
      setInitialLoad: "PLOT_INITIAL_LOAD_SET",
      updateRendererCount: "UI_RENDERER_COUNT_SET",
      showContextMenu: "UI_SHOW_CONTEXT_MENU_SET",
      setContextMenuItemData: "UI_CONTEXT_MENU_ITEM_DATA_SET",
      setCurrentItemId: "PLOT_CURRENT_ITEM_ID_SET",
      updateNumReady: "PLOT_NUM_READY_SET",
      setRunId: "VIEW_RUN_ID_SET",
      setSimulation: "VIEW_SIMULATION_SET",
    }),
    react: function () {
      let nextImage = this.loadedTimeStepData.find(
        (img) => img.timestep == this.currentTimeStep
      );
      if (isNil(nextImage) && this.loadedTimeStepData.length >= 1) {
        let idx = this.availableTimeSteps.findIndex(
          (step) => step >= this.currentTimeStep
        );
        idx = Math.max((idx -= 1), 0);
        let prevTimeStep = this.availableTimeSteps[idx];
        nextImage = this.loadedTimeStepData.find(
          (img) => img.timestep === prevTimeStep
        );
      }
      if (!isNil(nextImage)) {
        if (!this.xaxis) {
          let xAxis = nextImage.data.xLabel;
          this.updatePlotDetails({ [`${this.itemId}`]: { xAxis } });
        }
        this.updateRenderer(nextImage.data);
      }
      this.updateNumReady(this.numReady + 1);
    },
    updateViewPort() {
      if (!this.renderer) return;

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
      this.renderer.setViewport(...viewport);
    },
    addRenderer(data) {
      if (this.renderer) return;
      // Create the building blocks we will need for the polydata
      this.renderer = vtkRenderer.newInstance({ background: [1, 1, 1] });
      this.mesh = vtkPolyData.newInstance();
      this.actor = vtkActor.newInstance();
      this.mapper = vtkMapper.newInstance();

      this.renderWindow.addRenderer(this.renderer);
      this.updateRendererCount(this.renderWindow.getRenderers().length);

      // Load the cell attributes
      // Create a view of the data
      const connectivityView = new DataView(
        data.connectivity.buffer,
        data.connectivity.byteOffset,
        data.connectivity.byteLength
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
      this.axes = vtkCubeAxesActor.newInstance();
      this.axes.setCamera(this.camera);
      this.axes.setAxisLabels(data.xLabel, data.yLabel, "");
      this.axes.getGridActor().getProperty().setColor("black");
      this.axes.getGridActor().getProperty().setLineWidth(0.1);
      this.renderer.addActor(this.axes);

      // Build color bar
      this.scalarBar = vtkScalarBarActor.newInstance();
      this.scalarBar.setScalarsToColors(lut);
      this.scalarBar.setAxisLabel(data.colorLabel);
      this.scalarBar.setAxisTextStyle({ fontColor: "black" });
      this.scalarBar.setTickTextStyle({ fontColor: "black" });
      this.scalarBar.setDrawNanAnnotation(false);
      this.renderer.addActor2D(this.scalarBar);

      // Setup picker
      this.setupPointPicker();

      this.$nextTick(this.updateViewPort);
    },
    updateRenderer(data) {
      // Load the point attributes
      // Create a view of the data
      const pointsView = new DataView(
        data.nodes.buffer,
        data.nodes.byteOffset,
        data.nodes.byteLength
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

      // Set the scalars
      // As we need a typed array we have to copy the data as its unaligned, so we have an aligned buffer to
      // use to create the typed array
      const buffer = data.color.buffer.slice(
        data.color.byteOffset,
        data.color.byteOffset + data.color.byteLength
      );
      const color = new Float64Array(
        buffer,
        0,
        buffer.byteLength / Float64Array.BYTES_PER_ELEMENT
      );
      const scalars = vtkDataArray.newInstance({
        name: "scalars",
        values: color,
      });

      // Build the polydata
      this.mesh.getPoints().setData(points, 3);
      this.mesh.getPointData().setScalars(scalars);

      // Setup colormap
      const lut = this.mapper.getLookupTable();
      lut.setMappingRange(...scalars.getRange());
      lut.updateRange();

      // Setup mapper and actor
      this.mapper.setInputData(this.mesh);
      this.mapper.setScalarRange(...scalars.getRange());

      // Update axes
      this.axes.setDataBounds(this.actor.getBounds());
      const { faces, edges, ticks, labels } = setAxesStyling(this.axes);
      this.axes.updateTextData(faces, edges, ticks, labels);

      // Hack to adjust the bounds to include the x label
      // This can be removed when vtk.js include the text labels in its bounds.
      const bounds = [...this.actor.getBounds()];
      bounds[2] -= AXES_LABEL_BOUNDS_ADJUSTMENT;

      // Update color bar
      this.scalarBar.setScalarsToColors(lut);
      this.scalarBar.setAutoLayout(scalarBarAutoLayout(this.scalarBar));

      // Update camera
      if (!this.zoom) {
        this.renderer.resetCamera(bounds);
        if (!this.position) {
          this.position = this.camera.getPosition();
        }
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
        this.rangeText = [];
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
        if (picker.getActors().length !== 0 && this.startPoints) {
          const pickedPoints = picker.getPickedPositions();
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
          let scale = 0;
          if (r >= regionWidth / regionHeight) {
            scale = regionHeight / 2;
          } else {
            scale = regionWidth / r / 2;
            serverScale = regionWidth / 2;
          }

          const xMid = (finalX - startX) / 2 + startX;
          const yMid = (finalY - startY) / 2 + startY;
          const focalPoint = [xMid, yMid, 0.0];
          let zoomData = { focalPoint: focalPoint, scale: scale, serverScale };
          if (this.syncZoom) {
            for (let [key, value] of Object.entries(this.plotDetails)) {
              if (value.xAxis === this.xAxis) {
                this.updatePlotDetails({ [`${key}`]: { zoom: zoomData } });
              }
            }
          } else {
            this.updatePlotDetails({ [`${this.itemId}`]: { zoom: zoomData } });
          }
          const range = this.actor.getBounds();
          this.rangeText = range.map((r) => r.toPrecision(4));
        }
      });
    },
    resetZoom() {
      if (this.syncZoom) {
        for (let [key, value] of Object.entries(this.plotDetails)) {
          if (value.xAxis === this.xAxis) {
            this.updatePlotDetails({ [`${key}`]: { zoom: null } });
          }
        }
      } else {
        this.updatePlotDetails({ [`${this.itemId}`]: { zoom: null } });
      }
    },
    updateZoomedView() {
      if (!this.renderer) {
        return;
      }
      if (!this.zoom) {
        if (this.position) {
          this.camera.setPosition(...this.position);
        }
        const bounds = [...this.actor.getBounds()];
        // Hack to adjust the bounds to include the x label
        // This can be removed when vtk.js include the text labels in its bounds.
        bounds[2] -= AXES_LABEL_BOUNDS_ADJUSTMENT;
        this.renderer.resetCamera(bounds);
        this.rangeText = [];
      } else if (!isEqual(this.zoom.focalPoint, this.camera.getFocalPoint())) {
        if (this.zoom.scale) {
          this.camera.setFocalPoint(...this.zoom.focalPoint);
          this.camera.setParallelScale(this.zoom.scale);
        }
      }
    },
  },

  mounted() {
    this.$el.addEventListener("mouseenter", this.enterCurrentRenderer);
    this.$el.addEventListener("mouseleave", this.exitCurrentRenderer);
    this.$el.addEventListener("dblclick", () => {
      if (this.renderer) {
        this.resetZoom();
      }
    });
  },

  beforeDestroy() {
    this.removeRenderer();
  },
};
