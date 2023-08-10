import Plotly from "plotly.js-basic-dist-min";
import { isEmpty, isEqual, isNil } from "lodash";
import { mapActions, mapGetters, mapMutations } from "vuex";
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
    plotDataLoaded: {
      type: Boolean,
      default: false,
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
      computingTimeAverage: false,
      plotLabels: {},
    };
  },

  computed: {
    ...mapGetters({
      xaxisVisible: "UI_SHOW_X_AXIS",
      yaxisVisible: "UI_SHOW_Y_AXIS",
      showTitle: "UI_SHOW_TITLE",
      legendVisibility: "UI_SHOW_LEGEND",
      runGlobals: "UI_USE_RUN_GLOBALS",
      syncZoom: "UI_ZOOM_SYNC",
      timeStepSelectorMode: "UI_TIME_STEP_SELECTOR",
      currentTimeStep: "VIEW_TIME_STEP",
      numReady: "VIEW_NUM_READY",
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
    logScaling() {
      return this.$store.getters[`${this.itemId}/PLOT_LOG_SCALING`] || null;
    },
    range() {
      return this.$store.getters[`${this.itemId}/PLOT_GLOBAL_RANGE`] || null;
    },
    times() {
      return this.$store.getters[`${this.itemId}/PLOT_TIMES`] || [];
    },
    xAxis() {
      return this.$store.getters[`${this.itemId}/PLOT_X_AXIS`] || null;
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
        if (isEqual(newVal, oldVal)) {
          return;
        }
        this.react();
      },
    },
    logScaling: {
      immediate: true,
      handler(newVal, oldVal) {
        if (isEqual(newVal, oldVal)) {
          return;
        }
        this.react();
      },
    },
    range: {
      immediate: true,
      handler(newVal, oldVal) {
        if (isEqual(newVal, oldVal)) {
          return;
        }
        this.react();
      },
    },
    zoom: {
      immediate: true,
      handler(newVal, oldVal) {
        if (isEqual(newVal, oldVal)) {
          return;
        }
        this.react();
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
          if (oldAvg !== undefined) {
            this.computingTimeAverage = true;
          }
        }
        if (this.plotDataLoaded) {
          this.react();
        }
      },
    },
    xaxisVisible: {
      immediate: true,
      handler(newVal, oldVal) {
        if (isEqual(newVal, oldVal)) {
          return;
        }
        this.react();
      },
    },
    yaxisVisible: {
      immediate: true,
      handler(newVal, oldVal) {
        if (isEqual(newVal, oldVal)) {
          return;
        }
        this.react();
      },
    },
    showTitle: {
      immediate: true,
      handler(newVal, oldVal) {
        if (isEqual(newVal, oldVal)) {
          return;
        }
        this.react();
      },
    },
    runGlobals: {
      immediate: true,
      handler(newVal, oldVal) {
        if (isEqual(newVal, oldVal)) {
          return;
        }
        this.react();
      },
    },
  },

  methods: {
    ...mapActions({
      toggleSelectTimeStep: "UI_TOGGLE_TIME_STEP",
    }),
    ...mapMutations({
      setPauseGallery: "UI_PAUSE_GALLERY_SET",
      setTimeStep: "VIEW_TIME_STEP_SET",
      updateNumReady: "VIEW_NUM_READY_SET",
    }),
    updatePlotZoom(zoom) {
      this.$store.dispatch(`${this.itemId}/PLOT_ZOOM_CHANGED`, zoom);
    },
    relayoutPlotly() {
      if (this.zoom) {
        return;
      }
      this.$nextTick(() => {
        const node = this.$refs.plotly;
        const elems = node?.getElementsByClassName("plot-container");
        const { width, height } = this.$el.getBoundingClientRect();
        if (node !== undefined && elems.length > 0) {
          Plotly.relayout(this.$refs.plotly, {
            "xaxis.autorange": true,
            "yaxis.autorange": true,
            width: width - 4,
            height: height - 10,
          });
        }
      });
    },
    setXAxis(image) {
      let xAxis = image.layout.xaxis.title.text;
      this.$store.commit(`${this.itemId}/PLOT_X_AXIS_SET`, xAxis);
    },
    setPlotLabels(image) {
      this.plotLabels = {
        title: image.layout.title.text,
        xaxis: image.layout.xaxis.title.text,
        yaxis: image.layout.yaxis.title.text,
      };
    },
    applyLogScaling(image) {
      image.layout.xaxis.type = this.logScaling ? "log" : "linear";
      image.layout.yaxis.type = this.logScaling ? "log" : "linear";
    },
    applyZoom(image) {
      image.layout.xaxis.range = this.zoom.xaxis;
      image.layout.yaxis.range = this.zoom.yaxis;
      image.layout.yaxis.autorange = false;
    },
    useGlobalRange(image) {
      image.layout.yaxis.range = [...this.range];
      image.layout.yaxis.autorange = false;
    },
    useRunGlobals(image) {
      if (this.logScaling || this.zoom) {
        return;
      }

      image.layout.xaxis.range = [...this.xRange];
      image.layout.xaxis.autorange = false;
      image.layout.yaxis.range = [...this.yRange];
      image.layout.yaxis.autorange = false;
    },
    updatePlotDetails(image) {
      ["xaxis", "yaxis"].forEach((axis) => {
        image.layout[`${axis}`].title.text = this[`${axis}Visible`]
          ? this.plotLabels[`${axis}`]
          : "";
        image.layout[`${axis}`].showticklabels = this[`${axis}Visible`];
      });
      image.layout.title.text = this.showTitle ? this.plotLabels.title : "";
      image.layout.margin.b = this.xaxisVisible ? 30 : 10;
      image.layout.margin.l = this.yaxisVisible ? 60 : 10;
      image.layout.margin.t = this.showTitle ? 30 : 10;
    },
    plotPreProcessing(image) {
      if (!this.xAxis) this.setXAxis(image);
      if (!this.plotLabels.title) this.setPlotLabels(image);
      this.applyLogScaling(image);
      image.layout.yaxis.autorange = true;
      image.layout.showlegend = this.legendVisibility;
      if (this.range) this.useGlobalRange(image);
      if (this.runGlobals) this.useRunGlobals(image);
      if (this.zoom) this.applyZoom(image);
      this.setAnnotations(image.data[0]);
      this.updatePlotDetails(image);
    },
    findImage() {
      let nextImage = this.loadedTimeStepData.find(
        (img) => img.timestep == this.localTimeStep,
      );
      if (!this.timeAverage) {
        this.avgAnnotation = "";
        if (!isEmpty(this.averagingValues)) {
          this.averagingValues = [];
        }
      } else {
        let end = Math.min(
          this.currentTimeStep + this.timeAverage,
          Math.max(...this.availableTimeSteps),
        );
        this.avgAnnotation = `Averaging Over Time Steps ${this.currentTimeStep} - ${end}`;
        this.averagingValues = [];
        for (
          let i = this.currentTimeStep;
          i <= this.currentTimeStep + this.timeAverage;
          i++
        ) {
          if (this.availableTimeSteps.includes(i)) {
            nextImage = this.loadedTimeStepData.find(
              (img) => img.timestep == i,
            );
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
        if (!isNil(nextImage)) {
          // return new plotly dict
          avgData.forEach((yAvg, idx) => (nextImage.data[idx].y = yAvg));
        }
      }
      if (this.computingTimeAverage) {
        this.computingTimeAverage = false;
      }
      return nextImage;
    },
    react: function () {
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
        nextImage.type === PlotType.Plotly;
      if (plotReadyForUpdate) {
        this.lastLoadedTimeStep = nextImage.timestep;
        this.plotPreProcessing(nextImage);
        const { width, height } = this.$el.getBoundingClientRect();
        let layout = {
          ...nextImage.layout,
          width: width - 4,
          height: height - 10,
        };
        Plotly.react(this.$refs.plotly, nextImage.data, layout, {
          autosize: true,
          modeBarButtonsToAdd: [
            {
              name: "toggle log scaling",
              icon: Plotly.Icons["3d_rotate"],
              click: this.toggleLogScale,
            },
          ],
          modeBarButtonsToRemove: ["toImage"],
        });
        if (!this.eventHandlersSet) this.setEventHandlers();
        this.updateNumReady(this.numReady + 1);
      }
    },
    setEventHandlers() {
      this.$refs.plotly.on("plotly_relayout", (eventdata) => {
        if (
          this.runGlobals ||
          !eventdata["xaxis.range[0]"] ||
          !eventdata["yaxis.range[0]"]
        ) {
          return;
        }
        let zoomRange = parseZoomValues(eventdata, this.range);
        this.updatePlotZoom(zoomRange);
        this.react();
      });
      this.$refs.plotly.on("plotly_click", (data) => {
        const xAxis = this.xAxis.split(" ")[0].toLowerCase();
        if (this.timeStepSelectorMode && xAxis === "time") {
          if (this.selectedTime !== parseFloat(data.points[0].x)) {
            this.selectedTime = parseFloat(data.points[0].x);
            this.findClosestTime();
            this.selectTimeStepFromPlot();
            this.toggleSelectTimeStep();
          }
        }
      });
      this.$refs.plotly.on("plotly_doubleclick", () => {
        const xAxis = this.xAxis.split(" ")[0].toLowerCase();
        if (this.timeStepSelectorMode && xAxis === "time") {
          return false;
        } else {
          this.rangeText = "";
          this.updatePlotZoom(null);
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
      this.$store.commit(
        `${this.itemId}/PLOT_LOG_SCALING_SET`,
        !this.logScaling,
      );
    },
  },

  mounted() {
    window.addEventListener("resize", this.relayoutPlotly);
  },

  beforeDestroy() {
    this.removePlotly();
  },
};
