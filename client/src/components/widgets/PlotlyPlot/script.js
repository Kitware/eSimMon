import Plotly from "plotly.js-basic-dist-min";
import { isNil } from "lodash";
import { mapGetters, mapActions, mapMutations } from "vuex";
import { PlotType } from "../../../utils/constants";

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

  props: {
    itemId: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      eventHandlersSet: false,
      timeIndex: -1,
      selectedTime: -1,
      rangeText: [],
      lastLoadedTimeStep: -1,
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
      handler() {
        this.react();
      },
    },
    logScaling: {
      immediate: true,
      handler() {
        this.react();
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
    react: function () {
      if (!this.itemId) {
        return;
      }

      let nextImage = this.loadedTimeStepData.find(
        (img) => img.timestep == this.currentTimeStep,
      );
      if (isNil(nextImage) && this.loadedTimeStepData.length >= 1) {
        let idx = this.availableTimeSteps.findIndex(
          (step) => step >= this.currentTimeStep,
        );
        idx = Math.max((idx -= 1), 0);
        let prevTimeStep = this.availableTimeSteps[idx];
        nextImage = this.loadedTimeStepData.find(
          (img) => img.timestep === prevTimeStep,
        );
      }
      // Plots can be added faster than the data can update. Make sure we have
      // a nextImage, that the DOM element has been created, and that the
      // nextImage is the correct plot type.
      const plotReadyForUpdate =
        !isNil(nextImage) &&
        !isNil(this.$refs.plotly) &&
        nextImage.type === PlotType.Plotly &&
        this.lastLoadedTimeStep !== nextImage.timestep;
      if (plotReadyForUpdate) {
        this.lastLoadedTimeStep = nextImage.timestep;
        if (!this.xAxis) {
          let xAxis = nextImage.layout.xaxis.title.text;
          this.updatePlotDetails({ [`${this.itemId}`]: { xAxis } });
        }
        nextImage.layout.xaxis.type = this.logScaling ? "log" : "linear";
        nextImage.layout.yaxis.type = this.logScaling ? "log" : "linear";
        nextImage.layout.yaxis.autorange = true;
        nextImage.layout.showlegend = this.legendVisibility;
        if (this.zoom) {
          nextImage.layout.xaxis.range = this.zoom.xAxis;
          nextImage.layout.yaxis.range = this.zoom.yAxis;
          nextImage.layout.yaxis.autorange = false;
        }
        if (this.range) {
          nextImage.layout.yaxis.range = [...this.range];
          nextImage.layout.yaxis.autorange = false;
        }
        this.setAnnotations(nextImage.data[0]);
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
          this.rangeText = [];
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
        this.rangeText = [];
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
        this.rangeText = [];
        return;
      }
      const xRange = [data.x[0], data.x[data.x.length - 1]];
      let yRange = this.range;
      if (!yRange) yRange = [Math.min(...data.y), Math.max(...data.y)];
      const range = [...xRange, ...yRange];
      this.rangeText = range.map((r) => r.toPrecision(4));
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
