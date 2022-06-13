import { isNil, isNull } from "lodash";
import { mapGetters, mapActions, mapMutations } from "vuex";
import { decode } from "@msgpack/msgpack";
import PlotlyPlot from "../PlotlyPlot";
import VtkPlot from "../VTKPlot";

// Number of timesteps to prefetch data for.
const TIMESTEPS_TO_PREFETCH = 3;

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
      // Set of the current timesteps we are fetching data for, used to prevent
      // duplicate prefetching.
      prefetchRequested: new Set(),
      plotType: "plotly",
    };
  },

  asyncComputed: {
    ...mapGetters({
      currentTimeStep: "PLOT_TIME_STEP",
      numcols: "VIEW_COLUMNS",
      numrows: "VIEW_ROWS",
      minTimeStep: "PLOT_MIN_TIME_STEP",
      maxTimeStep: "PLOT_MAX_TIME_STEP",
      allLoadedTimeStepData: "PLOT_LOADED_TIME_STEPS",
      allAvailableTimeSteps: "PLOT_AVAILABLE_TIME_STEPS",
    }),
  },

  watch: {
    currentTimeStep: {
      immediate: true,
      handler() {
        // First display the updated timestep
        this.displayCurrentTimeStep();
        // Then ensure we have the next few timesteps
        this.preCacheTimeStepData();
      },
    },
    itemId: {
      immediate: true,
      handler() {
        this.setLoadedTimeStepData({ [`${this.itemId}`]: [] });
        this.prefetchRequested.clear();
        this.loadVariable();
      },
    },
    maxTimeStep: {
      immediate: true,
      handler() {
        this.prefetchRequested.clear();
        this.loadVariable();
      },
    },
  },

  methods: {
    ...mapActions({
      setMinTimeStep: "PLOT_MIN_TIME_STEP_CHANGED",
      updateTimes: "PLOT_UPDATE_ITEM_TIMES",
      setLoadedTimeStepData: "PLOT_UPDATE_LOADED_TIME_STEPS",
      setAvailableTimeSteps: "PLOT_UPDATE_AVAILABLE_TIME_STEPS",
      updatePlotDetails: "PLOT_DETAILS_UPDATED",
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
        options ? options : {}
      );
      return data;
    },
    /**
     * Fetch the data for give timestep. The data is added to loadedTimeStepData
     */
    fetchTimeStepData: async function (timeStep) {
      await this.callFastEndpoint(
        `variables/${this.itemId}/timesteps/${timeStep}/plot`,
        { responseType: "blob" }
      ).then((response) => {
        const reader = new FileReader();
        if (response.type === "application/msgpack") {
          reader.readAsArrayBuffer(response);
          this.plotType = "vtk";
        } else {
          reader.readAsText(response);
        }
        return new Promise((resolve) => {
          reader.onload = () => {
            let img;
            const ltsd = this.loadedTimeStepData();
            if (this.plotType === "vtk") {
              img = decode(reader.result);
              this.$refs[`${this.row}-${this.col}`].addRenderer(img);
              this.setLoadedTimeStepData({
                [`${this.itemId}`]: [
                  ...ltsd,
                  {
                    timestep: timeStep,
                    data: img,
                    type: this.plotType,
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
                    type: this.plotType,
                  },
                ],
              });
            }
            return resolve(img);
          };
        });
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
      const firstAvailableStep = await this.callFastEndpoint(
        `variables/${this.itemId}/timesteps`
      ).then((response) => {
        ats = response.steps.sort();
        this.setAvailableTimeSteps({ [`${this.itemId}`]: ats });
        this.updateTimes({ [`${this.itemId}`]: response.time });
        this.setMinTimeStep(Math.max(this.minTimeStep, Math.min(...ats)));
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
      await this.fetchTimeStepData(firstAvailableStep);

      this.setMaxTimeStep(Math.max(this.maxTimeStep, Math.max(...ats)));
      this.setItemId(this.itemId);
      this.setInitialLoad(false);
      this.$refs[`${this.row}-${this.col}`].react();
      this.preCacheTimeStepData();
    },
    loadGallery: function (event) {
      this.preventDefault(event);
      this.cleanUpOldPlotData();
      var items = JSON.parse(
        event.dataTransfer.getData("application/x-girder-items")
      );
      this.itemId = items[0]._id;
      this.updatePlotDetails({
        [`${this.itemId}`]: { zoom: null, log: false, xAxis: "", range: null },
      });
      this.setLoadedFromView(false);
      this.setRun();
    },
    loadTemplateGallery: function (item) {
      this.cleanUpOldPlotData();
      this.itemId = item.id;
      this.setLoadedTimeStepData({ [`${this.itemId}`]: [] });
      this.setLoadedFromView(true);
      this.updatePlotDetails({
        [`${this.itemId}`]: {
          zoom: item.zoom,
          log: item.log,
          xAxis: item.xAxis,
          range: item.range,
        },
      });
    },
    /**
     * Returns the previous valid timestep, null if no timestep exists.
     */
    previousTimeStep: function (timestep) {
      // find previous available timestep
      if (!this.itemId) {
        return null;
      }
      const ats = this.availableTimeSteps();
      const previousTimeStep = ats.findIndex((step) => step < timestep);
      return previousTimeStep !== -1 ? ats[previousTimeStep] : null;
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
        return;
      }

      // Check if the timestep data has been fetched
      if (!this.isTimeStepLoaded(timestep)) {
        // Fetch the data
        await this.fetchTimeStepData(timestep);
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
    /**
     * Precache timestep data.
     */
    preCacheTimeStepData: async function () {
      if (!this.itemId) {
        return;
      }
      const ats = this.availableTimeSteps();
      const numTimeSteps = ats.length;
      if (!numTimeSteps) {
        // We have not selected an item, do not attempt to load the images
        return;
      }

      // First find the index of the current timestep
      let startIndex = ats.findIndex((step) => step === this.currentTimeStep);
      // If the current timestep can't be found start at the next available one.
      if (startIndex === -1) {
        startIndex = this.nextTimeStep(this.currentTimeStep);
        // If there isn't one we are done.
        if (startIndex === -1) {
          return;
        }
      } else {
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
        let nextStep = ats[stepIndex];
        if (
          !this.isTimeStepLoaded(nextStep) &&
          !this.prefetchRequested.has(nextStep)
        ) {
          this.prefetchRequested.add(nextStep);
          await this.fetchTimeStepData(nextStep);
          this.prefetchRequested.delete(nextStep);
        }
      }
    },
    async requestContextMenu(e) {
      const response = await this.callEndpoint(`item/${this.itemId}`);
      const data = {
        id: this.itemId,
        name: response.name,
        event: e,
        step: this.currentTimeStep,
        isVTK: this.plotType === "vtk",
      };
      this.setCurrentItemId(this.itemId);
      this.setContextMenuItemData(data);
      this.showContextMenu(true);
    },
    clearGallery() {
      this.itemId = null;
      this.setInitialLoad(true);
    },
    async setRun() {
      const { data } = await this.girderRest.get(
        `/item/${this.itemId}/rootpath`
      );
      const runIdx = data.length - 2;
      const simulationIdx = runIdx - 1;
      this.setRunId(data[runIdx].object._id);
      this.setSimulation(data[simulationIdx].object._id);
      this.setShouldAutoSave(true);
    },
    cleanUpOldPlotData() {
      this.setLoadedTimeStepData({ [`${this.itemId}`]: [] });
      this.setAvailableTimeSteps({ [`${this.itemId}`]: [] });
      this.updateTimes({ [`${this.itemId}`]: [] });
      this.updatePlotDetails({ [`${this.itemId}`]: null });
    },
    loadedTimeStepData() {
      if (!this.allLoadedTimeStepData) {
        return [];
      }

      const ltsd = this.allLoadedTimeStepData[`${this.itemId}`] || [];
      if (ltsd.length === 0) {
        this.loadVariable();
      }
      return ltsd;
    },
    availableTimeSteps() {
      if (!this.allAvailableTimeSteps) {
        return [];
      }

      return this.allAvailableTimeSteps[`${this.itemId}`] || [];
    },
  },

  mounted() {
    this.updateCellCount(1);
  },

  destroyed() {
    this.updateCellCount(-1);
  },
};