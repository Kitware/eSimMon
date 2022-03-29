import Plotly from 'plotly.js-basic-dist-min';
import { isNil, isEqual, isNull } from 'lodash';
import { mapGetters, mapActions, mapMutations } from 'vuex';
import { decode } from '@msgpack/msgpack';
import { setAxesStyling, scalarBarAutoLayout } from '../../../utils/vtkPlotStyling';

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import '@kitware/vtk.js/Rendering/Profiles/Geometry';

import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkColorMaps from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction/ColorMaps';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkCubeAxesActor from '@kitware/vtk.js/Rendering/Core/CubeAxesActor';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkPointPicker from '@kitware/vtk.js/Rendering/Core/PointPicker';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';
import vtkScalarBarActor from '@kitware/vtk.js/Rendering/Core/ScalarBarActor';
import vtkCornerAnnotation from '@kitware/vtk.js/Interaction/UI/CornerAnnotation';

// Number of timesteps to prefetch data for.
const TIMESTEPS_TO_PREFETCH = 3;

//-----------------------------------------------------------------------------
// Utility Functions
//-----------------------------------------------------------------------------
function parseZoomValues(data, globalY) {
  if (data['xaxis.autorange'] || data['yaxis.autorange']) {
    return
  }

  const zoomLevel = {
    xAxis: [data['xaxis.range[0]'], data['xaxis.range[1]']],
    yAxis: [data['yaxis.range[0]'], data['yaxis.range[1]']]
  }
  if (globalY) {
    zoomLevel.yAxis = globalY;
  }
  return zoomLevel;
}

export default {
  name: "plotly",

  props: {
    maxTimeStep: {
      type: Number,
      required: true
    },
  },

  inject: ['girderRest', 'fastRestUrl'],

  data() {
    return {
      itemId: null,
      // Stores the fetched timestep data for the variable.
      loadedTimestepData: [],
      pendingImages: 0,
      json: true,
      image: null,
      eventHandlersSet: false,
      loadedFromView: false,
      zoom: null,
      xaxis: null,
      selectedTimeStep: 0,
      renderer: null,
      cells: [],
      mesh: null,
      mapper: null,
      actor: null,
      axes: null,
      scalarBar: null,
      availableTimeSteps: [],
      currentAvailableStep: 1,
      times: null,
      timeIndex: -1,
      inThisRenderer: false,
      startPoints: null,
      cornerAnnotation: null,
      camera: null,
      focalPoint: null,
      scale: 0,
      position: null,
      selectedTime: -1,
      // Set of the current timesteps we are fetching data for, used to prevent
      // duplicate prefetching.
      prefetchRequested: new Set(),
      rangeText: [],
    };
  },

  asyncComputed: {
    ...mapGetters({
      currentTimeStep: 'PLOT_TIME_STEP',
      globalRanges: 'PLOT_GLOBAL_RANGES',
      globalZoom: 'PLOT_ZOOM',
      numcols: 'VIEW_COLUMNS',
      numrows: 'VIEW_ROWS',
      renderWindow: 'UI_RENDER_WINDOW',
      syncZoom: 'UI_ZOOM_SYNC',
      zoomAxis: 'PLOT_ZOOM_X_AXIS',
      timeStepSelectorMode: 'UI_TIME_STEP_SELECTOR',
      initialLoad: 'PLOT_INITIAL_LOAD',
      minTimeStep: 'PLOT_MIN_TIME_STEP',
      interactor: 'UI_INTERACTOR',
      boxSelector: 'PLOT_BOX_SELECTOR',
      globalFocalPoint: 'PLOT_FOCAL_POINT',
      globalScale: 'PLOT_SCALE',
    }),

    loadedTimestepData: {
      default: [],
      async get() {
        if (!this.itemId) {
          return [];
        }

        if (this.loadedTimestepData.length == 0) {
          this.loadVariable();
        }
        return this.loadedTimestepData;
      },
    },

    zoomLevels() {
      var zoom = this.zoom;
      if (this.syncZoom && this.globalZoom && this.xaxis === this.zoomAxis)
        zoom = this.globalZoom;
      return zoom;
    }
  },

  watch: {
    currentTimeStep: {
      immediate: true,
      handler () {
        // First display the updated timestep
        this.displayCurrentTimestep();
        // Then ensure we have the next few timesteps
        this.preCacheTimestepData();
      }
    },
    itemId: {
      immediate: true,
      handler () {
        this.loadedTimestepData = [];
        this.prefetchRequested.clear();
      }
    },
    maxTimeStep: {
      immediate: true,
      handler () {
        this.prefetchRequested.clear();
        this.loadVariable();
      }
    },
    numrows: {
      immediate: true,
      handler() {
        this.react();
        this.$nextTick(this.updateLayout());
      }
    },
    numcols: {
      immediate: true,
      handler() {
        this.react();
        this.$nextTick(this.updateLayout());

      }
    },
    globalRanges: {
      handler() {
        this.react();
      },
      deep: true,
      immediate: true,
    },
    zoomLevels: {
      immediate: true,
      handler() {
        this.react();
      }
    },
    focalPoint() {
      this.updateZoomedView();
    },
    scale() {
      this.updateZoomedView();
    },
    globalFocalPoint(fp) {
      this.focalPoint = fp;
    },
    globalScale(scale) {
      this.scale = scale;
    }
  },

  methods: {
    ...mapActions({
      setZoomDetails: 'PLOT_ZOOM_DETAILS',
      updateZoom: 'PLOT_ZOOM_VALUES_UPDATED',
      setMinTimeStep: 'PLOT_MIN_TIME_STEP_CHANGED',
    }),
    ...mapMutations({
      setTimeStep: 'PLOT_TIME_STEP_SET',
      setZoomOrigin: 'PLOT_ZOOM_ORIGIN_SET',
      updateCellCount: 'PLOT_VISIBLE_CELL_COUNT_SET',
      setMaxTimeStep: 'PLOT_MAX_TIME_STEP_SET',
      setItemId: 'PLOT_CURRENT_ITEM_ID_SET',
      setLoadedFromView: 'PLOT_LOADED_FROM_VIEW_SET',
      setInitialLoad: 'PLOT_INITIAL_LOAD_SET',
      updateRendererCount: 'UI_RENDERER_COUNT_SET',
      setPauseGallery: 'UI_PAUSE_GALLERY_SET',
      setGlobalFocalPoint: 'PLOT_FOCAL_POINT_SET',
      setGlobalScale: 'PLOT_SCALE_SET',
    }),
    relayoutPlotly() {
      const node =  this.$refs.plotly;
      const elems = node?.getElementsByClassName('plot-container');
      if (node !== undefined && elems.length > 0) {
        Plotly.relayout(this.$refs.plotly, {
          'xaxis.autorange': true,
          'yaxis.autorange': true
        });
      }
    },
    updateLayout() {
      this.updateViewPort();
      this.relayoutPlotly();
    },
    resize() {
      this.relayoutPlotly();
    },

    preventDefault: function (event) {
      event.preventDefault();
    },

    callEndpoint: async function (endpoint) {
      const { data } = await this.girderRest.get(endpoint);
      return data;
    },

    callFastEndpoint: async function (endpoint, options=null) {
      const { data } = await this.girderRest.get(
        `${this.fastRestUrl}/${endpoint}`, options ? options : {});
      return data;
    },
    /**
     * Fetch the data for give timestep. The data is added to this.loadedTimestepData
     */
    fetchTimestepData: async function(timeStep) {
      var plotType = 'vtk';
      await this.callFastEndpoint(`variables/${this.itemId}/timesteps/${timeStep}/plot`, {responseType: 'blob'})
        .then((response) => {
          const reader = new FileReader();
          if (response.type === 'application/msgpack') {
            reader.readAsArrayBuffer(response);
          } else {
            reader.readAsText(response);
            plotType = 'plotly';
          }
          return new Promise(resolve => {
            reader.onload = () => {
              if (plotType === 'vtk') {
                const img = decode(reader.result);
                this.addRenderer(img);
                this.loadedTimestepData.push({
                  timestep: timeStep,
                  data: img,
                  type: plotType
                });
                return resolve(img);
              } else {
                const img = JSON.parse(reader.result);
                this.loadedTimestepData.push({
                  timestep: timeStep,
                  data: img.data,
                  layout: img.layout,
                  type: plotType,
                });
                return resolve(img);
              }
            };
          });
        });
    },
    /**
     * Fetch the available timestep for the variable and display the current
     * timestep ( or closes available ).
     */
    loadVariable: async function() {
      if (!this.itemId) {
        return;
      }
      const firstAvailableStep = await this.callFastEndpoint(`variables/${this.itemId}/timesteps`)
        .then((response) => {
          this.availableTimeSteps = response.steps.sort();
          this.times = response.time;
          this.setMinTimeStep(
            Math.max(this.minTimeStep, Math.min(...this.availableTimeSteps)));
          // Make sure there is an image associated with this time step
          let step = this.availableTimeSteps.find(
            step => step === this.currentTimeStep);
          if (isNil(step)) {
            // If not, display the previous available image
            // If no previous image display first available
            let idx = this.availableTimeSteps.findIndex(
              step => step > this.currentTimeStep);
            idx = Math.max(idx-1, 0);
            step = this.availableTimeSteps[idx];
          }
          return step;
        });
      await this.fetchTimestepData(firstAvailableStep);

      this.setMaxTimeStep(Math.max(this.maxTimeStep, Math.max(...this.availableTimeSteps)));
      this.setItemId(this.itemId);
      this.setInitialLoad(false);
      this.react();
      this.preCacheTimestepData();
    },
    loadGallery: function (event) {
      event.preventDefault();
      this.removeRenderer();
      this.zoom = null
      var items = JSON.parse(event.dataTransfer.getData('application/x-girder-items'));
      this.itemId = items[0]._id;
      this.setLoadedFromView(false);
      this.$root.$children[0].$emit('item-added', this.itemId);
    },
    loadTemplateGallery: function (item) {
      this.removeRenderer();
      this.itemId = item.id;
      this.zoom = item.zoom;
      this.setLoadedFromView(true);
    },

    /**
     * Returns the previous valid timestep, null if no timestep exists.
     */
    previousTimestep: function (timestep) {
      // find previous available timestep
      const previousTimestep = this.availableTimeSteps.findIndex(
        step => step < timestep);

      return previousTimestep !== -1 ? this.availableTimeSteps[previousTimestep] : null;
    },
    /**
     * Return the next valid timestep, null if no timestep exists.
     *
     */
    nextTimestep: function (timestep) {
      const nextTimestep = this.availableTimeSteps.findIndex(
        step => step > timestep);

      return nextTimestep !== -1 ? this.availableTimeSteps[nextTimestep] : null;
    },
    /**
     * Return true if data for this timestep has already been fetch, false otherwise.
     */
    isTimestepLoaded: function (timestep) {
      return this.loadedTimestepData.findIndex(image => image.timestep === timestep) !== -1;
    },
    /**
     * Return true if this is valid timestep for this variable ( as in data is
     * available ), false otherwise.
     */
    isValidTimestep: function (timestep) {
      return this.availableTimeSteps.findIndex(step => step === timestep) !== -1;
    },
    /**
     * Display the given timestep, if the timestep is not valid then the
     * previous timestep ( if available ) will be displayed.
     */
    displayTimestep: async function (timestep) {
      // If this is not a valid timestep for the variable use the previous
      if (!this.isValidTimestep(timestep)) {
        timestep = this.previousTimestep(timestep)
      }

      if (isNull(timestep)) {
        return;
      }

      // Check if the timestep data has been fetched
      if (!this.isTimestepLoaded(timestep)) {
        // Fetch the data
        await this.fetchTimestepData(timestep);
      }

      // Update this plot
      this.react();
    },
    /**
     * Display the the current timestep, if the current timestep is not valid
     * then the previous timestep will be displayed.
     */
    displayCurrentTimestep: async function() {
      if (!isNil(this.currentTimeStep)) {
        this.displayTimestep(this.currentTimeStep);
      }
    },
    /**
     * Precache timestep data.
     */
    preCacheTimestepData: async function () {
      const numTimeSteps = this.availableTimeSteps.length;
      if (!numTimeSteps) {
        // We have not selected an item, do not attempt to load the images
        return;
      }

      // First find the index of the current timestep
      let startIndex = this.availableTimeSteps.findIndex(step => step === this.currentTimeStep);
      // If the current timestep can't be found start at the next available one.
      if (startIndex === -1) {
        startIndex = this.nextTimestep(this.currentTimeStep)
        // If there isn't one we are done.
        if (startIndex === -1) {
          return;
        }
      }
      else {
        // We want the next one
        startIndex += 1;
      }

      // We have reached the end.
      if (startIndex >= numTimeSteps) {
        return;
      }

      // Load the next TIMESTEPS_TO_PREFETCH timesteps.
      for (let i = 0; i < TIMESTEPS_TO_PREFETCH; i++) {
        const stepIndex = startIndex + i;
        if (stepIndex >= numTimeSteps) {
          // There are no more timesteps to load
          break;
        }
        // Only load this timestep we haven't done so already.
        let nextStep = this.availableTimeSteps[stepIndex];
        if (!this.isTimestepLoaded(nextStep) && !this.prefetchRequested.has(nextStep)) {
          this.prefetchRequested.add(nextStep);
          await this.fetchTimestepData(nextStep);
          this.prefetchRequested.delete(nextStep);
        }
      }
    },
    react: function () {
      let nextImage = this.loadedTimestepData.find(img => img.timestep == this.currentTimeStep);
      if (isNil(nextImage) && this.loadedTimestepData.length >= 1) {
        let idx = this.availableTimeSteps.findIndex(step => step >= this.currentTimeStep);
        idx = Math.max(idx -= 1, 0);
        let prevTimeStep = this.availableTimeSteps[idx];
        nextImage = this.loadedTimestepData.find(img => img.timestep === prevTimeStep);
      }

      if (!isNil(nextImage)) {
        if (nextImage.type === 'plotly') {
          this.removeRenderer();
          if (!this.xaxis) {
            this.xaxis = nextImage.layout.xaxis.title.text;
          }

          nextImage.layout.yaxis.autorange = true;
          if (this.zoomLevels) {
            nextImage.layout.xaxis.range = this.zoomLevels.xAxis;
            nextImage.layout.yaxis.range = this.zoomLevels.yAxis;
            nextImage.layout.yaxis.autorange = false;
          }
          var range = null;
          if (this.itemId in this.globalRanges) {
            range = this.globalRanges[`${this.itemId}`];
            if (range) {
              nextImage.layout.yaxis.range = [...range];
              nextImage.layout.yaxis.autorange = false;
            }
          }
          this.setAnnotations(nextImage.data[0], this.zoomLevels, range);
          Plotly.react(this.$refs.plotly, nextImage.data, nextImage.layout, {autosize: true});
          if (!this.eventHandlersSet)
            this.setEventHandlers();
          this.json = true;
        } else {
          this.removePlotly();
          if (!this.xaxis) {
            this.xaxis = nextImage.data.xLabel;
          }
          this.updateRenderer(nextImage.data);
        }
      }
      this.$parent.$parent.$parent.$parent.$emit("gallery-ready");
    },
    async fetchMovie(e) {
      const response = await this.callEndpoint(`item/${this.itemId}`);
      const data = {
        id: this.itemId,
        name: response.name,
        event: e,
        isJson: this.json,
      }
      this.$parent.$parent.$parent.$parent.$emit("param-selected", data);
    },
    clearGallery() {
      this.itemId = null;
      this.pendingImages = 0;
      this.json = true;
      this.image = null;
      this.setInitialLoad(true);
    },
    setEventHandlers() {
      this.$refs.plotly.on('plotly_relayout', (eventdata) => {
        this.zoom = parseZoomValues(eventdata, this.globalRanges[this.itemId]);
        if (!this.zoomOrigin) {
          this.setZoomOrigin(this.itemId);
        }
        if (this.syncZoom && this.itemId !== this.zoomOrigin) {
          this.setZoomDetails({zoom: this.zoom, xAxis: this.xaxis});
        }
        this.react();
      });
      this.$refs.plotly.on('plotly_click', (data) => {
        const xAxis = this.xaxis.split(' ')[0].toLowerCase();
        if (this.timeStepSelectorMode && xAxis === 'time') {
          if (this.selectedTime !== parseFloat(data.points[0].x)) {
            this.selectedTime = parseFloat(data.points[0].x);
            this.findClosestTime();
            this.selectTimeStepFromPlot();
          }
        }
      });
      this.$refs.plotly.on('plotly_doubleclick', () => {
        const xAxis = this.xaxis.split(' ')[0].toLowerCase();
        if (this.timeStepSelectorMode && xAxis === 'time') {
          return false;
        } else {
          this.zoom = null;
          this.rangeText = [];
          if (this.syncZoom) {
            this.setZoomDetails({zoom: null, xAxis: null});
          }
        }
      });
      this.eventHandlersSet = true;
    },
    updateViewPort() {
      if (!this.renderer)
        return

      const parent = this.$parent.$el.getBoundingClientRect();
      const { x, y, width, height } = this.$el.getBoundingClientRect();
      const viewport = [
        (x - parent.x) / parent.width,
        1 - (y + height) / parent.height,
        ((x - parent.x) + width) / parent.width,
        1 - y / parent.height,
      ];
      this.renderer.setViewport(...viewport);
    },
    addRenderer(data) {
      if (this.renderer)
        return
      // Create the building blocks we will need for the polydata
      this.renderer = vtkRenderer.newInstance({background: [1, 1, 1]});
      this.mesh = vtkPolyData.newInstance();
      this.actor = vtkActor.newInstance();
      this.mapper = vtkMapper.newInstance();

      this.renderWindow.addRenderer(this.renderer);
      this.updateRendererCount(this.renderWindow.getRenderers().length);

      // Load the cell attributes
      // Create a view of the data
      const connectivityView = new DataView(data.connectivity.buffer, data.connectivity.byteOffset,  data.connectivity.byteLength);
      const numberOfNodes = data.connectivity.length / Int32Array.BYTES_PER_ELEMENT / 3;
      this.cells = new Int32Array(numberOfNodes * 4);
      var idx = 0;
      const rowSize = 3 * Int32Array.BYTES_PER_ELEMENT; // 3 => columns
      for (let i = 0; i < data.connectivity.length; i+=rowSize) {
        this.cells[idx++] = 3;
        let index = i
        this.cells[idx++] = connectivityView.getInt32(index, true);
        index += 4
        this.cells[idx++] = connectivityView.getInt32(index, true);
        index += 4
        this.cells[idx++] = connectivityView.getInt32(index, true);
      }
      this.mesh.getPolys().setData(this.cells);

      // Setup colormap
      const lut = vtkColorTransferFunction.newInstance();
      lut.applyColorMap(vtkColorMaps.getPresetByName('jet'));

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
      this.axes.setAxisLabels(data.xLabel, data.yLabel, '');
      this.axes.getGridActor().getProperty().setColor('black');
      this.axes.getGridActor().getProperty().setLineWidth(0.1);
      this.renderer.addActor(this.axes);

      // Build color bar
      this.scalarBar = vtkScalarBarActor.newInstance();
      this.scalarBar.setScalarsToColors(lut);
      this.scalarBar.setAxisLabel(data.colorLabel);
      this.scalarBar.setAxisTextStyle({fontColor: 'black'});
      this.scalarBar.setTickTextStyle({fontColor: 'black'});
      this.scalarBar.setDrawNanAnnotation(false);
      this.renderer.addActor2D(this.scalarBar);

      // Setup picker
      this.setupPointPicker();

      // Add corner annotation
      this.cornerAnnotation = vtkCornerAnnotation.newInstance();

      this.$nextTick(this.updateViewPort);
    },
    updateRenderer(data) {
      // Load the point attributes
      // Create a view of the data
      const pointsView = new DataView(data.nodes.buffer, data.nodes.byteOffset,  data.nodes.byteLength);
      const numberOfPoints = data.nodes.length / Float64Array.BYTES_PER_ELEMENT / 2;
      const points = new Float64Array(numberOfPoints * 3);
      var idx = 0;
      const rowSize = 2 * Float64Array.BYTES_PER_ELEMENT; // 3 => columns
      for (let i = 0; i < data.nodes.length; i+=rowSize) {
        points[idx++] = pointsView.getFloat64(i, true);
        points[idx++] = pointsView.getFloat64(i + 8, true);
        points[idx++] = 0.0;
      }

      // Set the scalars
      // As we need a typed array we have to copy the data as its unaligned, so we have an aligned buffer to
      // use to create the typed array
      const buffer = data.color.buffer.slice(data.color.byteOffset, data.color.byteOffset + data.color.byteLength)
      const color = new Float64Array(buffer, 0, buffer.byteLength / Float64Array.BYTES_PER_ELEMENT)
      const scalars = vtkDataArray.newInstance({
        name: 'scalars',
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

      // Update color bar
      this.scalarBar.setScalarsToColors(lut);
      this.scalarBar.setAutoLayout(scalarBarAutoLayout(this.scalarBar));

      // Update camera
      if (!this.focalPoint && !this.scale) {
        this.renderer.resetCamera();
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
      }
    },
    removePlotly() {
      // Remove the Plotly plot if it exists, we're about to load a VTK plot
      const node =  this.$refs.plotly;
      const elems = node?.getElementsByClassName('plot-container');
      if (node !== undefined && elems.length > 0) {
        Plotly.purge(this.$refs.plotly);
        this.rangeText = [];
      }
    },
    enterCurrentRenderer() {
      if(this.renderer) {
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
        this.timeIndex = -1;
        const xAxis = this.xaxis.split(' ')[0].toLowerCase();
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
          if (this.timeStepSelectorMode && xAxis === 'time') {
            if (this.selectedTime !== pickedPoints[0][0]) {
              this.selectedTime = pickedPoints[0][0];
              this.findClosestTime();
            }
          }
        }
      });
      this.interactor.onLeftButtonRelease((callData) => {
        this.timeIndex = -1;
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

          const [startX, startY, ] = this.startPoints;
          const [finalX, finalY, ] = pickedPoints[0];
          const regionWidth = Math.abs(finalX - startX);
          const regionHeight = Math.abs(finalY - startY);

          if (r >= regionWidth / regionHeight) {
            this.scale = regionHeight / 2;
          } else {
            this.scale = regionWidth / r / 2;
          }

          const xMid = ((finalX - startX) / 2) + startX;
          const yMid = ((finalY - startY) / 2) + startY;
          this.focalPoint = [xMid, yMid, 0.0];
          if (this.syncZoom) {
            this.setGlobalScale(this.scale);
            this.setGlobalFocalPoint([...this.focalPoint]);
          }
          // Update corner annotation
          this.cornerAnnotation.setContainer(this.$refs.plotly);
          this.cornerAnnotation.updateMetadata({range: this.actor.getBounds()});
          this.cornerAnnotation.updateTemplates({
            nw(meta) {
              return `xRange: [${meta.range.slice(0,2)}] yRange: [${meta.range.slice(2,4)}]`;
            },
          });
        }
      });
    },
    selectTimeStepFromPlot() {
      if (this.timeIndex >= 0) {
        this.setTimeStep(this.availableTimeSteps[this.timeIndex]);
        this.timeIndex = -1;
        this.setPauseGallery(true);
      } else {
        this.resetZoom();
      }
    },
    resetZoom() {
      this.focalPoint = null;
      this.scale = 0;
      if (this.syncZoom) {
        this.setGlobalFocalPoint(this.focalPoint);
        this.setGlobalScale(this.scale);
      }
      this.cornerAnnotation.setContainer(null);
      this.camera.setPosition(...this.position);
      this.renderer.resetCamera();
    },
    findClosestTime() {
      // Time is stored as seconds but plotted as milliseconds
      const pickedPoint = this.selectedTime * 0.001;
      var closestVal = -Infinity;
      this.times.forEach((time) => {
        // Find the closest time at or before the selected time
        const newDiff = pickedPoint - time;
        const oldDiff = pickedPoint - closestVal;
        if (newDiff >= 0 && newDiff < oldDiff) {
          closestVal = time;
        }
      });
      this.timeIndex = this.times.findIndex(time => time === closestVal);
    },
    updateZoomedView() {
      if (!this.renderer || !this.focalPoint || !this.scale) {
        return;
      }
      if (!isEqual(this.focalPoint, this.camera.getFocalPoint())) {
        if (this.scale) {
          this.camera.setFocalPoint(...this.focalPoint);
          this.camera.setParallelScale(this.scale);
        }
      }
    },
    setAnnotations(data, zoom, yRange) {
      if (!zoom) {
        this.rangeText = [];
        return
      }

      const xRange = [data.x[0], data.x[data.x.length-1]];
      if (!yRange)
        yRange = [Math.min(...data.y), Math.max(...data.y)];
      this.rangeText = [
        xRange[0].toPrecision(4),
        xRange[1].toPrecision(4),
        yRange[0].toPrecision(4),
        yRange[1].toPrecision(4)
      ]
    }
  },

  mounted () {
    this.updateCellCount(1);
    this.$el.addEventListener('mouseenter', this.enterCurrentRenderer);
    this.$el.addEventListener('mouseleave', this.exitCurrentRenderer);
    this.$el.addEventListener('dblclick', () => {
      if (this.renderer) {
        this.resetZoom();
      }
    });
    window.addEventListener('resize', this.resize);
  },

  beforeDestroy() {
    this.removeRenderer();
  },

  destroyed() {
    this.updateCellCount(-1);
  }
};
