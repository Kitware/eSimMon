import { isNil, isNull } from "lodash";
import { mapGetters, mapActions, mapMutations } from "vuex";
import { decode } from "@msgpack/msgpack";
import PlotlyPlot from "../PlotlyPlot";
import VtkPlot from "../VTKPlot";
import { PlotType } from "../../../utils/constants";
import { PlotFetcher } from "../../../utils/plotFetcher";

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
      plotType: PlotType.Plotly,
    };
  },

  computed: {
    ...mapGetters({
      currentTimeStep: "PLOT_TIME_STEP",
      numcols: "VIEW_COLUMNS",
      numrows: "VIEW_ROWS",
      minTimeStep: "PLOT_MIN_TIME_STEP",
      maxTimeStep: "PLOT_MAX_TIME_STEP",
      allLoadedTimeStepData: "PLOT_LOADED_TIME_STEPS",
      allAvailableTimeSteps: "PLOT_AVAILABLE_TIME_STEPS",
      initialDataLoaded: "PLOT_INITIAL_LOAD",
      numReady: "PLOT_NUM_READY",
      plotDetails: "PLOT_DETAILS",
    }),
    plotDataLoaded() {
      let loadedTimeSteps = this.allLoadedTimeStepData || [];
      loadedTimeSteps = loadedTimeSteps[`${this.itemId}`] || [];
      const loaded = loadedTimeSteps.map((data) => data.timestep);
      let start = this.currentTimeStep;
      let end = this.currentTimeStep + this.timeAverage;
      const range = [...Array(end - start + 1).keys()].map((x) => x + start);
      let available = this.allAvailableTimeSteps || [];
      available = available[`${this.itemId}`] || [];
      return range.every((s) => loaded.includes(s) || !available.includes(s));
    },
    timeAverage() {
      if (this.itemId) {
        let details = this.plotDetails[this.itemId] || {};
        let avg = details?.timeAverage || 0;
        return avg;
      }
      return 0;
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
      updateMinTimeStep: "PLOT_MIN_TIME_STEP_CHANGED",
      updateTimes: "PLOT_UPDATE_ITEM_TIMES",
      setLoadedTimeStepData: "PLOT_UPDATE_LOADED_TIME_STEPS",
      setAvailableTimeSteps: "PLOT_UPDATE_AVAILABLE_TIME_STEPS",
      updatePlotDetails: "PLOT_DETAILS_UPDATED",
      updateVisiblePlots: "PLOT_SELECTIONS_UPDATED",
    }),
    ...mapMutations({
      updateCellCount: "PLOT_VISIBLE_CELL_COUNT_SET",
      setMaxTimeStep: "PLOT_MAX_TIME_STEP_SET",
      setItemId: "PLOT_CURRENT_ITEM_ID_SET",
      setLoadedFromView: "PLOT_LOADED_FROM_VIEW_SET",
      setInitialLoad: "PLOT_INITIAL_LOAD_SET",
      showContextMenu: "UI_SHOW_CONTEXT_MENU_SET",
      setContextMenuItemData: "UI_CONTEXT_MENU_ITEM_DATA_SET",
      setCurrentItemId: "PLOT_CURRENT_ITEM_ID_SET",
      setRunId: "VIEW_RUN_ID_SET",
      setSimulation: "VIEW_SIMULATION_SET",
      setShouldAutoSave: "VIEW_AUTO_SAVE_RUN_SET",
      updateNumReady: "PLOT_NUM_READY_SET",
    }),
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
          const ltsd = this.loadedTimeStepData();
          if (!this.isTimeStepLoaded(timeStep)) {
            if (this.plotType === PlotType.VTK) {
              img = decode(reader.result);
              this.$refs[`${this.row}-${this.col}`].addRenderer(img);
              this.setLoadedTimeStepData({
                [`${this.itemId}`]: [
                  ...ltsd,
                  {
                    timestep: timeStep,
                    data: img,
                  },
                ],
              });
            } else {
              img = JSON.parse(reader.result);
              this.setLoadedTimeStepData({
                [`${this.itemId}`]: [
                  ...ltsd,
                  {
                    timestep: timeStep,
                    data: img.data,
                    layout: img.layout,
                    type: img.type,
                  },
                ],
              });
            }
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
          this.setAvailableTimeSteps({ [`${this.itemId}`]: ats });
          this.updateTimes({ [`${this.itemId}`]: response.time });
          this.updateMinTimeStep();
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
      this.updatePlotDetails({
        [`${this.itemId}`]: {
          zoom: null,
          log: false,
          xAxis: "",
          range: null,
          legend: false,
        },
      });
      this.updateVisiblePlots({ newId: this.itemId, oldId });
      this.setLoadedFromView(false);
      this.setRun();
    },
    loadTemplateGallery: function (item) {
      this.cleanUpOldPlotData();
      const oldId = this.itemId;
      this.itemId = item.id || "";
      this.setLoadedFromView(true);
      this.updatePlotDetails({
        [`${this.itemId}`]: {
          zoom: item.zoom,
          log: item.log,
          xAxis: item.xAxis,
          range: item.range,
          legend: item.legend,
        },
      });
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
      const ats = this.availableTimeSteps();
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
      const ats = this.availableTimeSteps();
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
      const ltsd = this.loadedTimeStepData();
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
      const ats = this.availableTimeSteps();
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
        xAxis: this.plotDetails[this.itemId].xAxis,
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
      this.updateTimes({ [`${this.itemId}`]: [] });
      this.updatePlotDetails({ [`${this.itemId}`]: null });
    },
    loadedTimeStepData() {
      if (!this.allLoadedTimeStepData) {
        return [];
      }

      const ltsd = this.allLoadedTimeStepData[`${this.itemId}`] || [];
      return ltsd;
    },
    availableTimeSteps() {
      if (!this.allAvailableTimeSteps) {
        return [];
      }

      return this.allAvailableTimeSteps[`${this.itemId}`] || [];
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
    this.updateCellCount(1);
  },

  destroyed() {
    this.updateCellCount(-1);
  },
};
