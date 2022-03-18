import Plotly from 'plotly.js-basic-dist-min';
import { isNil } from 'lodash';
import { mapGetters, mapActions, mapMutations } from 'vuex';
import { decode } from '@msgpack/msgpack'

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import '@kitware/vtk.js/Rendering/Profiles/Geometry';

import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkColorMaps from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction/ColorMaps';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkCubeAxesActor from '@kitware/vtk.js/Rendering/Core/CubeAxesActor';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';
import vtkScalarBarActor from '@kitware/vtk.js/Rendering/Core/ScalarBarActor';

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

function addAnnotations(data, zoom, yRange) {
  if (!zoom) {
    return
  }

  const xRange = [data.x[0], data.x[data.x.length-1]];
  if (!yRange)
    yRange = [Math.min(...data.y), Math.max(...data.y)];
  const rangeText = (
    `<b>
      X: [${xRange[0].toPrecision(4)}, ${xRange[1].toPrecision(4)}]
      Y: [${yRange[0].toPrecision(4)}, ${yRange[1].toPrecision(4)}]
    </b>`
  )

  const annotations = [{
    xref: 'paper',
    yref: 'paper',
    x: 0,
    xanchor: 'left',
    y: 1,
    yanchor: 'bottom',
    text: rangeText,
    showarrow: false
  }]
  return annotations;
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
      loadedImages: [],
      pendingImages: 0,
      rows: [],
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
    }),

    rows: {
      default: [],
      async get() {
        if (!this.itemId) {
          return [];
        }

        if (this.rows.length == 0) {
          this.loadImage();
        }
        return this.rows;
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
        this.preCacheImages();
        this.react();
      }
    },
    itemId: {
      immediate: true,
      handler () {
        this.rows = [];
        this.loadedImages = [];
      }
    },
    maxTimeStep: {
      immediate: true,
      handler () {
        this.loadImage();
      }
    },
    numrows: {
      immediate: true,
      handler() {
        this.react();
        this.$nextTick(this.updateViewPort);
      }
    },
    numcols: {
      immediate: true,
      handler() {
        this.react();
        this.$nextTick(this.updateViewPort);
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
  },

  methods: {
    ...mapActions({
      setZoomDetails: 'PLOT_ZOOM_DETAILS',
      updateZoom: 'PLOT_ZOOM_VALUES_UPDATED',
    }),
    ...mapMutations({
      setTimeStep: 'PLOT_TIME_STEP_SET',
      setZoomOrigin: 'PLOT_ZOOM_ORIGIN_SET',
      updateCellCount: 'PLOT_VISIBLE_CELL_COUNT_SET',
      setMaxTimeStep: 'PLOT_MAX_TIME_STEP_SET',
      setItemId: 'PLOT_CURRENT_ITEM_ID_SET',
      setLoadedFromView: 'PLOT_LOADED_FROM_VIEW_SET',
      setInitialLoad: 'PLOT_INITIAL_LOAD_SET',
    }),

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

    fetchImage: async function(timeStep) {
      var plotType = 'vtk';
      let img = await this.callFastEndpoint(`variables/${this.itemId}/timesteps/${timeStep}/plot`, {responseType: 'blob'})
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
                this.loadedImages.push({
                  timestep: timeStep,
                  data: img,
                  type: plotType
                });
                return resolve(img);
              } else {
                const img = JSON.parse(reader.result);
                this.loadedImages.push({
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
      return {plotType, img};
    },
    loadImage: async function() {
      if (!this.itemId) {
        return;
      }
      const firstAvailableStep = await this.callFastEndpoint(`variables/${this.itemId}/timesteps`)
        .then((response) => {
          this.availableTimeSteps = response.sort();
          let step = -Infinity;
          for (let i = 0; i < response.length; i++) {
            if (response[i] === this.currentTimeStep) {
              step = this.currentTimeStep;
              break;
            } else if (response[i] < this.currentTimeStep && response[i] > step){
              step = response[i];
            }
          }
          if (step < 1) {
            step = 1;
          }
          return step;
        });
      const {plotType, img} = await this.fetchImage(firstAvailableStep);
      this.rows[0] = {'img': img, 'step': firstAvailableStep, 'type': plotType};

      this.setMaxTimeStep(Math.max(this.maxTimeStep, Math.max(...this.availableTimeSteps)));
      this.setItemId(this.itemId);
      this.setInitialLoad(false);

      this.react();

      this.preCacheImages();
    },
    loadGallery: function (event) {
      event.preventDefault();
      this.zoom = null
      var items = JSON.parse(event.dataTransfer.getData('application/x-girder-items'));
      this.itemId = items[0]._id;
      this.setLoadedFromView(false);
      this.$root.$children[0].$emit('item-added', this.itemId);
    },
    loadTemplateGallery: function (item) {
      this.itemId = item.id;
      this.zoom = item.zoom;
      this.setLoadedFromView(true);
    },
    preCacheImages: async function () {
      // Load the next three images.
      for (var i = this.currentTimeStep; i < this.currentTimeStep + 3; i++) {
        if (i > this.maxTimeStep || i > this.rows.length) {
          break;
        }
        // Only load this image we haven't done so already.
        let nextStep = this.availableTimeSteps[i];
        let idx = this.rows.findIndex(image => image.step === nextStep);
        if (idx) {
          return;
        }
        const {plotType, img} = await this.fetchImage(nextStep);
        this.rows.push({'img': img, 'step': nextStep, 'type': plotType});
      }
      this.react()
    },
    react: function () {
      let nextImage = this.loadedImages.find(img => img.timestep == this.currentTimeStep);
      if (isNil(nextImage) && this.loadedImages.length == 1)
        nextImage = this.loadedImages[0];

      if (!isNil(nextImage)) {
        if (nextImage.type === 'plotly') {
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
          nextImage.layout['annotations'] = addAnnotations(nextImage.data[0], this.zoomLevels, range);
          Plotly.react(this.$refs.plotly, nextImage.data, nextImage.layout, {autosize: true});
          if (!this.eventHandlersSet)
            this.setEventHandlers();
          this.json = true;
        } else {
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
          this.setZoomDetails(this.zoom, this.xaxis);
        }
        this.react();
      });
      this.$refs.plotly.on('plotly_click', (data) => {
        this.selectedTimeStep = parseInt(data.points[0].x);
      });
      this.$refs.plotly.on('plotly_doubleclick', () => {
        if (this.timeStepSelectorMode && this.xaxis.toLowerCase() === 'time') {
          this.setTimeStep(this.selectedTimeStep);
          return false;
        } else {
          this.zoom = null;
          if (this.syncZoom) {
            this.setZoomDetails(null, null);
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
      this.renderer = vtkRenderer.newInstance({background: [0.8, 0.8, 0.8]});
      this.mesh = vtkPolyData.newInstance();
      this.actor = vtkActor.newInstance();
      this.mapper = vtkMapper.newInstance();

      // Load the cell attributes
      // Create a view of the data
      const connectivityView = new DataView(data.connectivity.buffer, data.connectivity.byteOffset,  data.connectivity.byteLength);
      this.cells = new Int32Array(data.connectivity.length * 4);
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
      const camera = this.renderer.getActiveCamera();
      camera.setPosition(0, 0, 1);
      camera.setFocalPoint(0, 0, 0);

      // Create axis
      this.axes = vtkCubeAxesActor.newInstance();
      this.axes.setCamera(camera);
      this.axes.setAxisLabels(data.xLabel, data.yLabel, '');
      this.renderer.addActor(this.axes);

      // Build color bar
      this.scalarBar = vtkScalarBarActor.newInstance();
      this.scalarBar.setScalarsToColors(lut);
      this.scalarBar.setAxisLabel(data.colorLabel);
      this.scalarBar.setDrawNanAnnotation(false);
      this.renderer.addActor2D(this.scalarBar);

      this.$nextTick(this.updateViewPort);
      this.renderWindow.addRenderer(this.renderer);
    },
    updateRenderer(data) {
      // Load the point attributes
      // Create a view of the data
      const pointsView = new DataView(data.nodes.buffer, data.nodes.byteOffset,  data.nodes.byteLength);
      const points = new Float64Array(data.nodes.length * 3);
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

      // Update color bar
      this.scalarBar.setScalarsToColors(lut);

      this.renderer.resetCamera();
    },
  },

  mounted () {
    this.updateCellCount(1);
  },

  destroyed() {
    this.updateCellCount(-1);
    if (this.renderer) {
      this.renderWindow.removeRenderer(this.renderer);
    }
  }
};
