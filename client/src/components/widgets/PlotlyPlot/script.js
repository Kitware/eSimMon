import Plotly from "plotly.js-basic-dist-min";
import { isEmpty, isEqual, isNil } from "lodash";
import { mapGetters, mapActions, mapMutations } from "vuex";
import { PlotType } from "../../../utils/constants";
import Annotations from "../Annotations";

//-----------------------------------------------------------------------------
// Utility Functions
//-----------------------------------------------------------------------------
function parseZoomValues(data, globalY) {
  if (data["xaxis.autorange"] || data["yaxis.autorange"]) {
    return;
  }

  const zoomLevel = {
    xAxis: [data["xaxis.range[0]"], data["xaxis.range[1]"]],
    yAxis: [data["yaxis.range[0]"], data["yaxis.range[1]"]],
  };
  if (globalY) {
    zoomLevel.yAxis = globalY;
  }
  return zoomLevel;
}

export default {
  name: "PlotlyPlot",
  inject: ["girderRest", "fastRestUrl"],

  components: {
    Annotations,
  },

  props: {
    itemId: {
      type: String,
      required: true,
    },
    timeAverage: {
      type: Number,
      default: 0,
    },
  },

  data() {
    return {
      eventHandlersSet: false,
      timeIndex: -1,
      selectedTime: -1,
      rangeText: "",
      lastLoadedTimeStep: -1,
      averagingValues: [],
      avgAnnotation: "",
    };
  },

  computed: {
    ...mapGetters({
      currentTimeStep: "PLOT_TIME_STEP",
      numcols: "VIEW_COLUMNS",
      numrows: "VIEW_ROWS",
      syncZoom: "UI_ZOOM_SYNC",
      timeStepSelectorMode: "UI_TIME_STEP_SELECTOR",
      numReady: "PLOT_NUM_READY",
      allTimes: "PLOT_TIMES",
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
    legendVisibility() {
      if (!this.itemId || !this.plotDetails) {
        return false;
      }
      return this.plotDetails[`${this.itemId}`]?.legend;
    },
    loadedTimeStepData() {
      if (!this.allLoadedTimeStepData) {
        return [];
      }
      return this.allLoadedTimeStepData[`${this.itemId}`] || [];
    },
    logScaling() {
      if (!this.itemId || !this.plotDetails) {
        return null;
      }
      return this.plotDetails[`${this.itemId}`]?.log;
    },
    range() {
      if (!this.itemId || !this.plotDetails) {
        return null;
      }
      return this.plotDetails[`${this.itemId}`]?.range;
    },
    times() {
      return this.allTimes[`${this.itemId}`] || [];
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
        this.$nextTick(this.relayoutPlotly);
      },
    },
    numcols: {
      immediate: true,
      handler() {
        this.$nextTick(this.relayoutPlotly);
      },
    },
    legendVisibility: {
      immediate: true,
      handler(newVal, oldVal) {
        let needRerender = !isEqual(newVal, oldVal);
        this.react(needRerender);
      },
    },
    logScaling: {
      immediate: true,
      handler(newVal, oldVal) {
        let needRerender = !isEqual(newVal, oldVal);
        this.react(needRerender);
      },
    },
    range: {
      immediate: true,
      handler(newVal, oldVal) {
        let needRerender = !isEqual(newVal, oldVal);
        this.react(needRerender);
      },
    },
    zoom: {
      immediate: true,
      handler(newVal, oldVal) {
        let needRerender = !isEqual(newVal, oldVal);
        this.react(needRerender);
      },
    },
    itemId: {
      immediate: true,
      handler(new_id, old_id) {
        if (!new_id) {
          this.removePlotly();
        }
        if (new_id !== old_id) {
          this.lastLoadedTimeStep = -1;
        }
      },
    },
    timeAverage: {
      immediate: true,
      handler(newAvg, oldAvg) {
        if (newAvg !== oldAvg) {
          this.lastLoadedTimeStep = -1;
        }
        this.react();
      },
    },
  },

  methods: {
    ...mapActions({
      updatePlotDetails: "PLOT_DETAILS_UPDATED",
    }),
    ...mapMutations({
      setTimeStep: "PLOT_TIME_STEP_SET",
      setPauseGallery: "UI_PAUSE_GALLERY_SET",
      updateNumReady: "PLOT_NUM_READY_SET",
    }),
    relayoutPlotly() {
      if (this.zoom) {
        return;
      }
      this.$nextTick(() => {
        const node = this.$refs.plotly;
        const elems = node?.getElementsByClassName("plot-container");
        if (node !== undefined && elems.length > 0) {
          Plotly.relayout(this.$refs.plotly, {
            "xaxis.autorange": true,
            "yaxis.autorange": true,
          });
        }
      });
    },
    setXAxis(image) {
      let xAxis = image.layout.xaxis.title.text;
      this.updatePlotDetails({ [`${this.itemId}`]: { xAxis } });
    },
    applyLogScaling(image) {
      image.layout.xaxis.type = this.logScaling ? "log" : "linear";
      image.layout.yaxis.type = this.logScaling ? "log" : "linear";
    },
    applyZoom(image) {
      image.layout.xaxis.range = this.zoom.xAxis;
      image.layout.yaxis.range = this.zoom.yAxis;
      image.layout.yaxis.autorange = false;
    },
    useGlobalRange(image) {
      image.layout.yaxis.range = [...this.range];
      image.layout.yaxis.autorange = false;
    },
    plotPreProcessing(image) {
      if (!this.xAxis) this.setXAxis(image);
      this.applyLogScaling(image);
      image.layout.yaxis.autorange = true;
      image.layout.showlegend = this.legendVisibility;
      if (this.zoom) this.applyZoom(image);
      if (this.range) this.useGlobalRange(image);
      this.setAnnotations(image.data[0]);
    },
    getNextImage(timeStep) {
      // Grab the data for the current time step
      let nextImage = this.loadedTimeStepData.find(
        (img) => img.timestep == timeStep,
      );

      // If no data is available for the current time step, find the most
      // recent previous time step that does have data and display that instead
      const ats = this.availableTimeSteps;
      if (
        !this.timeAverage &&
        isNil(nextImage) &&
        this.loadedTimeStepData.length >= 1
      ) {
        let idx = ats.findIndex((step) => step >= timeStep);
        // Use the data for the first time step available if the current time
        // step is before the first available for this variable
        idx = Math.max((idx -= 1), 0);
        let prevTimeStep = ats[idx];
        nextImage = this.loadedTimeStepData.find(
          (img) => img.timestep === prevTimeStep,
        );
      }
      return nextImage;
    },
    findImage() {
      let nextImage = this.getNextImage(this.currentTimeStep);
      if (!this.timeAverage) {
        this.avgAnnotation = "";
        if (!isEmpty(this.averagingValues)) {
          this.averagingValues = [];
        }
        return nextImage;
      } else {
        let end = Math.min(
          this.currentTimeStep + this.timeAverage,
          Math.max(...this.availableTimeSteps),
        );
        this.avgAnnotation = `Averaging Over Time Steps ${this.currentTimeStep} - ${end}`;
        // call getNextImage for each time step in range
        this.averagingValues = [];
        for (
          let i = this.currentTimeStep;
          i <= this.currentTimeStep + this.timeAverage;
          i++
        ) {
          if (this.availableTimeSteps.includes(i)) {
            nextImage = this.getNextImage(i);
            if (!isNil(nextImage)) {
              nextImage.data.forEach((data, idx) => {
                // append y data to 2d array
                (this.averagingValues[idx] ??= []).push(data.y);
              });
            }
          }
        }
        const avgData = [];
        let length = 1;
        this.averagingValues.forEach((value) => {
          length = value.length;
          const dataVal = value.reduce((acc, val) => {
            val.forEach((v, i) => (acc[i] = (acc[i] || 0) + v));
            return acc;
          }, []);
          dataVal.forEach((v, i) => (dataVal[i] = v / length));
          avgData.push(dataVal);
        });
        // rebuild the data with the average values
        if (isNil(nextImage)) {
          nextImage = this.getNextImage(
            this.currentTimeStep + this.timeAverage,
          );
        }
        avgData.forEach((yAvg, idx) => (nextImage.data[idx].y = yAvg));
        // return new plotly dict
        return nextImage;
      }
    },
    react: function (needRerender = false) {
      if (!this.itemId) {
        return;
      }
      const nextImage = this.findImage();
      // Plots can be added faster than the data can update. Make sure we have
      // a nextImage, that the DOM element has been created, and that the
      // nextImage is the correct plot type.
      const plotReadyForUpdate =
        !isNil(nextImage) &&
        !isNil(this.$refs.plotly) &&
        nextImage.type === PlotType.Plotly &&
        (this.lastLoadedTimeStep !== nextImage.timestep || needRerender);
      if (plotReadyForUpdate) {
        this.lastLoadedTimeStep = nextImage.timestep;
        this.plotPreProcessing(nextImage);
        Plotly.react(this.$refs.plotly, nextImage.data, nextImage.layout, {
          autosize: true,
          modeBarButtonsToAdd: [
            {
              name: "toggle log scaling",
              icon: Plotly.Icons["3d_rotate"],
              click: this.toggleLogScale,
            },
            {
              name: "toggle legend visibility",
              icon: Plotly.Icons["tooltip_basic"],
              click: this.toggleLegendVisibility,
            },
          ],
          modeBarButtonsToRemove: ["toImage"],
        });
        if (!this.eventHandlersSet) this.setEventHandlers();
      }
      this.updateNumReady(this.numReady + 1);
    },
    setEventHandlers() {
      this.$refs.plotly.on("plotly_relayout", (eventdata) => {
        if (!eventdata["xaxis.range[0]"] || !eventdata["yaxis.range[0]"]) {
          return;
        }
        let zoomRange = parseZoomValues(eventdata, this.range);
        if (this.syncZoom) {
          for (let [key, value] of Object.entries(this.plotDetails)) {
            if (value.xAxis === this.xAxis) {
              this.updatePlotDetails({ [`${key}`]: { zoom: zoomRange } });
            }
          }
        } else {
          this.updatePlotDetails({ [`${this.itemId}`]: { zoom: zoomRange } });
        }
        this.react();
      });
      this.$refs.plotly.on("plotly_click", (data) => {
        const xAxis = this.xAxis.split(" ")[0].toLowerCase();
        if (this.timeStepSelectorMode && xAxis === "time") {
          if (this.selectedTime !== parseFloat(data.points[0].x)) {
            this.selectedTime = parseFloat(data.points[0].x);
            this.findClosestTime();
            this.selectTimeStepFromPlot();
          }
        }
      });
      this.$refs.plotly.on("plotly_doubleclick", () => {
        const xAxis = this.xAxis.split(" ")[0].toLowerCase();
        if (this.timeStepSelectorMode && xAxis === "time") {
          return false;
        } else {
          this.rangeText = "";
          if (this.syncZoom) {
            for (let [key, value] of Object.entries(this.plotDetails)) {
              if (value.xAxis === this.xAxis) {
                this.updatePlotDetails({ [`${key}`]: { zoom: null } });
              }
            }
          } else {
            this.updatePlotDetails({ [`${this.itemId}`]: { zoom: null } });
          }
        }
      });
      this.eventHandlersSet = true;
    },
    removePlotly() {
      // Remove the Plotly plot if it exists, we're about to load a VTK plot
      const node = this.$refs.plotly;
      const elems = node?.getElementsByClassName("plot-container");
      if (node !== undefined && elems.length > 0) {
        Plotly.purge(this.$refs.plotly);
        this.rangeText = "";
      }
    },
    selectTimeStepFromPlot() {
      if (this.timeIndex < 0) {
        return;
      }
      this.setTimeStep(this.availableTimeSteps[this.timeIndex]);
      this.timeIndex = -1;
      this.setPauseGallery(true);
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
      this.timeIndex = this.times.findIndex((time) => time === closestVal);
    },
    setAnnotations(data) {
      if (!this.zoom) {
        this.rangeText = "";
        return;
      }
      const xRange = [data.x[0], data.x[data.x.length - 1]];
      let yRange = this.range;
      if (!yRange) yRange = [Math.min(...data.y), Math.max(...data.y)];
      const range = [...xRange, ...yRange];
      const [x0, x1, y0, y1] = range.map((r) => r.toPrecision(4));
      this.rangeText = `xRange: [${x0}, ${x1}] yRange: [${y0}, ${y1}]`;
    },
    toggleLogScale() {
      this.updatePlotDetails({ [`${this.itemId}`]: { log: !this.logScaling } });
    },
    toggleLegendVisibility() {
      this.updatePlotDetails({
        [`${this.itemId}`]: { legend: !this.legendVisibility },
      });
    },
  },

  mounted() {
    window.addEventListener("resize", this.relayoutPlotly);
  },

  beforeDestroy() {
    this.removePlotly();
  },
};
