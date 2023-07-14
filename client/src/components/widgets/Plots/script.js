import { isNil, isNull } from "lodash";
import { mapGetters, mapActions, mapMutations } from "vuex";
import { decode } from "@msgpack/msgpack";
import PlotlyPlot from "../PlotlyPlot";
import VtkPlot from "../VTKPlot";
import { PlotType } from "../../../utils/constants";
import { PlotFetcher } from "../../../utils/plotFetcher";

import plot from "../../../store/plot";

// // Number of timesteps to prefetch data for.
// const TIMESTEPS_TO_PREFETCH = 3;

export default {
  name: "Plots",
  inject: ["girderRest", "fastRestUrl"],

  components: {
    PlotlyPlot,
    VtkPlot,
  },

  props: {
    row: {
      type: Number,
      required: true,
    },
    col: {
      type: Number,
      required: true,
    },
  },

  data() {
    return {
      itemId: "",
      plotFetcher: undefined,
      plotType: PlotType.None,
    };
  },

  computed: {
    ...mapGetters({
      currentTimeStep: "VIEW_TIME_STEP",
      minTimeStep: "VIEW_MIN_TIME_STEP",
      maxTimeStep: "VIEW_MAX_TIME_STEP",
      initialDataLoaded: "VIEW_INITIAL_LOAD",
      numReady: "VIEW_NUM_READY",
      numcols: "VIEWS_COLUMNS",
      numrows: "VIEWS_ROWS",
      gridSize: "VIEWS_GRID_SIZE",
    }),
    plotDataLoaded() {
      const loaded = this.loadedTimeStepData.map((data) => data.timestep);
      let start = this.currentTimeStep;
      let end = this.currentTimeStep + this.timeAverage;
      const range = [...Array(end - start + 1).keys()].map((x) => x + start);
      return range.every(
        (s) => loaded.includes(s) || !this.availableTimeSteps.includes(s),
      );
    },
    timeAverage() {
      return this.$store.getters[`${this.itemId}/PLOT_TIME_AVERAGE`] || 0;
    },
    plotXAxis() {
      return this.$store.getters[`${this.itemId}/PLOT_X_AXIS`] || 0;
    },
    loadedTimeStepData() {
      return this.$store.getters[`${this.itemId}/PLOT_LOADED_TIME_STEPS`] || [];
    },
    availableTimeSteps() {
      return (
        this.$store.getters[`${this.itemId}/PLOT_AVAILABLE_TIME_STEPS`] || []
      );
    },
  },

  watch: {
    currentTimeStep: {
      immediate: true,
      handler() {
        // First display the updated timestep
        if (this.plotFetcher && this.plotFetcher.initialized) {
          this.plotFetcher.setCurrentTimestep(this.currentTimeStep, true);
        }
        if (!this.initialDataLoaded) {
          this.displayCurrentTimeStep();
        }
      },
    },
    itemId: {
      immediate: true,
      handler() {
        this.plotFetcher = new PlotFetcher(
          this.itemId,
          (itemId) => this.callFastEndpoint(`variables/${itemId}/timesteps`),
          (itemId, timestep) =>
            this.callFastEndpoint(
              `variables/${itemId}/timesteps/${timestep}/plot`,
              { responseType: "blob" },
            ),
          (response, timeStep) => this.resolveTimeStepData(response, timeStep),
        );
        if (this.itemId) {
          this.plotFetcher.initialize().then(() => {
            this.plotFetcher.setCurrentTimestep(this.currentTimeStep, true);
            this.loadVariable();
          });
        }
      },
    },
    timeAverage: {
      immediate: true,
      handler(avg) {
        if (avg) {
          this.displayCurrentTimeStep();
        }
      },
    },
  },

  methods: {
    ...mapActions({
      updateVisiblePlots: "VIEW_SELECTIONS_UPDATED",
    }),
    ...mapMutations({
      updateCellCount: "VIEW_VISIBLE_CELL_COUNT_SET",
      setGridSize: "VIEWS_GRID_SIZE_SET",
      setMaxTimeStep: "VIEW_MAX_TIME_STEP_SET",
      setItemId: "VIEW_CURRENT_ITEM_ID_SET",
      setInitialLoad: "VIEW_INITIAL_LOAD_SET",
      showContextMenu: "UI_SHOW_CONTEXT_MENU_SET",
      setContextMenuItemData: "UI_CONTEXT_MENU_ITEM_DATA_SET",
      setCurrentItemId: "VIEW_CURRENT_ITEM_ID_SET",
      setRunId: "VIEWS_RUN_ID_SET",
      setSimulation: "VIEWS_SIMULATION_SET",
      setShouldAutoSave: "VIEWS_AUTO_SAVE_RUN_SET",
      updateNumReady: "VIEW_NUM_READY_SET",
    }),
    setAvailableTimeSteps: function (steps) {
      this.$store.dispatch(
        `${this.itemId}/PLOT_AVAILABLE_TIME_STEPS_CHANGED`,
        steps,
      );
    },
    setLoadedTimeStepData: function (loaded) {
      this.$store.commit(`${this.itemId}/PLOT_LOADED_TIME_STEPS_SET`, loaded);
    },
    updateTimes: function (times) {
      if (!this.itemId) {
        return;
      }

      this.$store.commit(`${this.itemId}/PLOT_TIMES_SET`, times);
    },
    updatePlotLegendVisibility: function (legend) {
      this.$store.commit(`${this.itemId}/PLOT_LEGEND_VISIBILITY_SET`, legend);
    },
    updatePlotLogScaling: function (log) {
      this.$store.commit(`${this.itemId}/PLOT_LOG_SCALING_SET`, log);
    },
    updatePlotXAxis: function (xAxis) {
      this.$store.commit(`${this.itemId}/PLOT_X_AXIS_SET`, xAxis);
    },
    updatePlotZoom: function (zoom) {
      this.$store.dispatch(`${this.itemId}/PLOT_ZOOM_CHANGED`, zoom);
    },
    resetPlotData: function () {
      if (this.itemId) {
        this.$store.dispatch(`${this.itemId}/PLOT_DATA_RESET`);
      }
    },
    preventDefault: function (event) {
      event.preventDefault();
    },
    callEndpoint: async function (endpoint) {
      const { data } = await this.girderRest.get(endpoint);
      return data;
    },
    callFastEndpoint: async function (endpoint, options = null) {
      const { data } = await this.girderRest.get(
        `${this.fastRestUrl}/${endpoint}`,
        options ? options : {},
      );
      return data;
    },
    /**
     * Fetch the data for give timestep. The data is added to loadedTimeStepData
     */
    resolveTimeStepData: function (response, timeStep) {
      const reader = new FileReader();
      if (response.type === "application/msgpack") {
        reader.readAsArrayBuffer(response);
        this.plotType = PlotType.VTK;
      } else {
        reader.readAsText(response);
        this.plotType = PlotType.Plotly;
      }
      return new Promise((resolve) => {
        reader.onload = () => {
          let img;
          const ltsd = this.loadedTimeStepData;
          if (this.plotType === PlotType.VTK) {
            img = decode(reader.result);
            this.$refs[`${this.row}-${this.col}`].addRenderer(img);
            if (!this.isTimeStepLoaded(timeStep)) {
              this.setLoadedTimeStepData([
                ...ltsd,
                {
                  timestep: timeStep,
                  data: img,
                  type: img.type,
                },
              ]);
            }
          } else if (!this.isTimeStepLoaded(timeStep)) {
            img = JSON.parse(reader.result);
            this.setLoadedTimeStepData([
              ...ltsd,
              {
                timestep: timeStep,
                data: img.data,
                layout: img.layout,
                type: PlotType.Plotly,
              },
            ]);
          }
          return resolve(img);
        };
      });
    },
    fetchTimeStepData: async function (timeStep) {
      if (!this.plotFetcher || !this.plotFetcher.initialized) {
        return;
      }
      return this.plotFetcher.getTimestepPlot(timeStep).then((response) => {
        return this.resolveTimeStepData(response, timeStep);
      });
    },
    /**
     * Fetch the available timestep for the variable and display the current
     * timestep ( or closest available ).
     */
    loadVariable: async function () {
      if (!this.itemId) {
        return;
      }
      let ats;
      const firstAvailableStep = await this.plotFetcher
        .initialize()
        .then((response) => {
          ats = response.steps.sort((a, b) => a - b);
          this.setAvailableTimeSteps(ats);
          this.updateTimes(response.time);
          // Make sure there is an image associated with this time step
          let step = ats.find((step) => step === this.currentTimeStep);
          if (isNil(step)) {
            // If not, display the previous available image
            // If no previous image display first available
            let idx = ats.findIndex((step) => step > this.currentTimeStep);
            idx = Math.max(idx - 1, 0);
            step = ats[idx];
          }
          return step;
        });
      const response = await this.plotFetcher.fastEndpointFn(
        this.itemId,
        firstAvailableStep,
      );
      await this.plotFetcher.fetchTimeStepFn(response, firstAvailableStep);

      this.setMaxTimeStep(Math.max(this.maxTimeStep, Math.max(...ats)));
      this.setItemId(this.itemId);
      this.setInitialLoad(false);
      this.$refs[`${this.row}-${this.col}`].react();
    },
    /**
     * One plot store module is registered for each instance.
     * On plot change unregister the old module and register the new one.
     */
    updateRegisteredModules: function (oldId) {
      if (this.$store.hasModule(oldId)) {
        this.$store.unregisterModule(oldId);
      }
      if (!this.$store.hasModule(this.itemId)) {
        this.$store.registerModule(this.itemId, plot);
      }
    },
    loadGallery: function (event) {
      this.preventDefault(event);
      var items = JSON.parse(
        event.dataTransfer.getData("application/x-girder-items"),
      );
      if (items[0]._modelType !== "item") {
        return;
      }
      this.cleanUpOldPlotData();
      const oldId = this.itemId;
      this.itemId = items[0]._id;
      this.updateRegisteredModules(oldId);
      this.updateVisiblePlots({ newId: this.itemId, oldId });
      this.setRun();
    },
    loadTemplateGallery: function (item) {
      this.cleanUpOldPlotData();
      const oldId = this.itemId;
      this.itemId = item.id || "";
      this.updateRegisteredModules(oldId);
      this.updatePlotLegendVisibility(item.legend);
      this.updatePlotLogScaling(item.log);
      this.updatePlotXAxis(item.xAxis);
      this.updatePlotZoom(item.zoom);
      this.updateVisiblePlots({ newId: this.itemId, oldId });
    },
    /**
     * Returns the previous valid timestep, first image if no timestep exists.
     */
    previousTimeStep: function (timestep) {
      // find previous available timestep
      if (!this.itemId) {
        return null;
      }
      const ats = this.availableTimeSteps;
      const previousTimeStep = ats.findIndex((step) => step >= timestep);
      return previousTimeStep !== -1 ? ats[previousTimeStep - 1] : ats[0];
    },
    /**
     * Return the next valid timestep, null if no timestep exists.
     *
     */
    nextTimeStep: function (timestep) {
      if (!this.itemId) {
        return null;
      }
      const ats = this.availableTimeSteps;
      const nextTimeStep = ats.findIndex((step) => step > timestep);
      return nextTimeStep !== -1 ? ats[nextTimeStep] : null;
    },
    /**
     * Return true if data for this timestep has already been fetch, false otherwise.
     */
    isTimeStepLoaded: function (timestep) {
      if (!this.itemId) {
        return false;
      }
      const ltsd = this.loadedTimeStepData;
      return ltsd.findIndex((image) => image.timestep === timestep) !== -1;
    },
    /**
     * Return true if this is valid timestep for this variable ( as in data is
     * available ), false otherwise.
     */
    isValidTimeStep: function (timestep) {
      if (!this.itemId) {
        return false;
      }
      const ats = this.availableTimeSteps;
      return ats.findIndex((step) => step === timestep) !== -1;
    },
    /**
     * Display the given timestep, if the timestep is not valid then the
     * previous timestep ( if available ) will be displayed.
     */
    displayTimeStep: async function (timestep) {
      // If this is not a valid timestep for the variable use the previous
      if (!this.isValidTimeStep(timestep)) {
        timestep = this.previousTimeStep(timestep);
      }

      if (isNull(timestep)) {
        this.updateNumReady(this.numReady + 1);
        return;
      }

      // Check if the timestep data has been fetched
      if (!this.plotDataLoaded) {
        // Fetch the data
        await this.fetchPlotsForAveraging();
      }

      // Update this plot
      this.$refs[`${this.row}-${this.col}`].react();
    },
    /**
     * Display the the current timestep, if the current timestep is not valid
     * then the previous timestep will be displayed.
     */
    displayCurrentTimeStep: async function () {
      if (!isNil(this.currentTimeStep)) {
        this.displayTimeStep(this.currentTimeStep);
      }
    },
    async requestContextMenu(e) {
      const response = await this.callEndpoint(`item/${this.itemId}`);
      const data = {
        id: this.itemId,
        name: response.name,
        event: e,
        step: this.currentTimeStep,
        isPlotly: this.plotType === PlotType.Plotly,
        xAxis: this.plotXAxis,
        clearGallery: this.clearGallery,
        averaging: this.timeAverage,
      };
      this.setCurrentItemId(this.itemId);
      this.setContextMenuItemData(data);
      this.showContextMenu(true);
    },
    clearGallery() {
      this.updateVisiblePlots({ newId: null, oldId: this.itemId });
      this.itemId = "";
      this.setInitialLoad(true);
    },
    async setRun() {
      const { data } = await this.girderRest.get(
        `/item/${this.itemId}/rootpath`,
      );
      const runIdx = data.length - 2;
      const simulationIdx = runIdx - 1;
      this.setRunId(data[runIdx].object._id);
      this.setSimulation(data[simulationIdx].object._id);
      this.setShouldAutoSave(true);
    },
    cleanUpOldPlotData() {
      this.updateTimes([]);
      this.resetPlotData();
    },
    async fetchPlotsForAveraging() {
      if (this.timeAverage >= 0) {
        // We'll need enough time steps cached to calculate the average
        const step = this.currentTimeStep;
        for (let i = step; i <= step + this.timeAverage; i++) {
          if (this.isValidTimeStep(i) && !this.isTimeStepLoaded(i)) {
            // Load the missing plot data
            await this.fetchTimeStepData(i);
          }
        }
      }
    },
  },

  mounted() {
    this.setGridSize(this.numcols * this.numrows);
  },

  destroyed() {
    this.setGridSize(this.gridSize - 1);
  },

  beforeDestroyed() {
    this.$store.unregisterModule(this.itemId);
  },
};
