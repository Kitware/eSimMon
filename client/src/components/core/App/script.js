import { Splitpanes, Pane } from "splitpanes";
import "splitpanes/dist/splitpanes.css";
import _ from "lodash";
import RenderWindow from "../../widgets/RenderWindow";
import { GirderAuthentication as GirderAuthentication } from "@girder/components/src";
import GirderFileManager from "../../widgets/GirderFileManager";
import ViewControls from "../ViewControls";
import ContextMenu from "../../widgets/ContextMenu";
import Plots from "../../widgets/Plots";
import { mapActions, mapGetters, mapMutations } from "vuex";

export default {
  name: "App",
  inject: ["girderRest", "defaultLocation", "fastRestUrl"],

  components: {
    GirderAuthentication,
    GirderFileManager,
    RenderWindow,
    Splitpanes,
    Pane,
    ViewControls,
    ContextMenu,
    Plots,
  },

  data() {
    return {
      browserLocation: null,
      cellWidth: "100%",
      cellHeight: "100vh",
      dataLoaded: false,
      forgotPasswordUrl: "/#?dialog=resetpassword",
      runId: null,
      range: "",
      pos: [],
      parameter: "",
      cancel: false,
      showMenu: false,
      paramIsJson: false,
    };
  },

  methods: {
    ...mapActions({
      viewAutoSaved: "VIEWS_AUTO_SAVE",
      createItems: "VIEWS_BUILD_ITEMS_OBJECT",
      fetchAutoSave: "VIEWS_FETCH_AUTO_SAVE",
      loadAutoSave: "VIEWS_LOAD_AUTO_SAVE",
      togglePlayPause: "UI_TOGGLE_PLAY_PAUSE",
    }),
    ...mapMutations({
      setAutoSaveName: "VIEWS_AUTO_SAVE_NAME_SET",
      setAutoSavedViewDialog: "UI_AUTO_SAVE_DIALOG_SET",
      setColumns: "VIEWS_COLUMNS_SET",
      setCreator: "VIEWS_CREATOR_SET",
      setCurrentTimeStep: "VIEW_TIME_STEP_SET",
      setGridSize: "VIEWS_GRID_SIZE_SET",
      setPaused: "UI_PAUSE_GALLERY_SET",
      setPublic: "VIEWS_PUBLIC_SET",
      setRows: "VIEWS_ROWS_SET",
      setRunId: "VIEWS_RUN_ID_SET",
      setSimulation: "VIEWS_SIMULATION_SET",
      setMaxTimeStep: "VIEW_MAX_TIME_STEP_SET",
      updateNumReady: "VIEW_NUM_READY_SET",
      loadingFromSaved: "VIEW_LOADING_FROM_SAVED_SET",
    }),

    addColumn() {
      this.setColumns(this.numcols + 1);
      this.setGridSize(this.numrows * this.numcols);
    },

    addRow() {
      this.setRows(this.numrows + 1);
      this.setGridSize(this.numrows * this.numcols);
    },

    decrementTimeStep(should_pause) {
      if (this.currentTimeStep > 1) {
        this.setCurrentTimeStep(this.currentTimeStep - 1);
      }
      this.setPaused(should_pause);
    },

    hoverOut() {
      this.range = "";
      this.cancel = true;
    },

    hoverIn: _.debounce(function (event) {
      if (this.showMenu) return;

      const node = event.target;
      const parent = node ? node.parentNode : null;
      if (
        (parent && parent.classList.value.includes("pl-3")) ||
        (node.classList.value.includes("pl-3") &&
          node.textContent != parent.textContent)
      ) {
        this.parameter = node.textContent.trim();
        this.cancel = false;
        // this.getRangeData(event);
      }
    }, 100),

    updateRange(yVals, event) {
      this.pos = event ? [event.clientX, event.clientY] : this.pos;
      this.range =
        "[" +
        Math.min(...yVals).toExponential(3) +
        ", " +
        Math.max(...yVals).toExponential(3) +
        "]";
    },

    updateTimeStep(val) {
      if (this.minTimeStep <= val && val <= this.maxTimeStep) {
        this.setCurrentTimeStep(parseInt(val));
      } else if (this.minTimeStep > val) {
        this.setCurrentTimeStep(this.minTimeStep);
      } else {
        this.setCurrentTimeStep(this.maxTimeStep);
      }
    },

    incrementTimeStep(should_pause) {
      if (this.currentTimeStep < this.maxTimeStep) {
        this.setCurrentTimeStep(this.currentTimeStep + 1);
        this.updateNumReady(0);
      }
      this.setPaused(should_pause);
    },

    lookupRunId() {
      // Get the grandparent folder for this item. Its metadata will tell us
      // what timestamps are available.
      this.girderRest
        .get(`/item/${this.itemId}`)
        .then((response) => {
          return this.girderRest.get(`/folder/${response.data.folderId}`);
        })
        .then((response) => {
          this.runId = response.data.parentId;
          return this.poll();
        });
    },

    poll() {
      if (!this.runId) {
        return this.lookupRunId(this.itemId);
      }

      let timeout = this.currentTimeStep >= 1 ? 10000 : 0;
      this._poller = setTimeout(async () => {
        try {
          const { data } = await this.girderRest.get(`/folder/${this.runId}`);
          if ("meta" in data && "currentTimestep" in data.meta) {
            var new_timestep = data.meta.currentTimestep;
            if (new_timestep > this.maxTimeStep) {
              this.setMaxTimeStep(new_timestep);
            }
          }
        } finally {
          this.poll();
        }
      }, timeout);
    },

    removeColumn() {
      this.setColumns(this.numcols - 1);
      this.setGridSize(this.numrows * this.numcols);
    },

    removeRow() {
      this.setRows(this.numrows - 1);
      this.setGridSize(this.numrows * this.numcols);
    },

    tick() {
      if (this.paused) {
        return;
      }
      var wait_ms = 500;
      if (this.numReady >= this.gridSize) {
        this.incrementTimeStep(false);
      }
      this.setTickWait(wait_ms);
    },

    setTickWait(wait_ms) {
      // eslint-disable-next-line
      var self = this;
      setTimeout(function () {
        self.tick();
      }, wait_ms);
    },

    updateCellWidth() {
      this.cellWidth = 100 / this.numcols + "%";
    },

    updateCellHeight() {
      this.cellHeight = 100 / this.numrows + "vh";
    },

    applyView() {
      this.$refs.plots.forEach((cell) => {
        const { row, col } = cell;
        const item = this.items[`${row}::${col}`];
        cell.clearGallery();
        if (item) {
          cell.loadTemplateGallery(item);
        }
      });
      this.setCurrentTimeStep(this.viewTimeStep);
      this.loadingFromSaved(false);
    },

    resetView() {
      this.setPaused(true);
      this.setCurrentTimeStep(1);
      this.setMaxTimeStep(0);
      this.setColumns(1);
      this.setRows(1);
      this.setGridSize(1);
      this.dataLoaded = false;
      this.runId = null;
      this.location = null;
    },

    autosave() {
      this._autosave = setTimeout(async () => {
        try {
          if (this.shouldAutoSave) {
            this.createItems(this.$refs.plots);
            const name = `${this.simulation}_${this.runId}_${this.creator}`;
            this.setAutoSaveName(name);
            this.setPublic(false);
            this.viewAutoSaved();
          }
        } finally {
          this.autosave();
        }
      }, 30000);
    },

    loadAutoSavedView() {
      this.loadAutoSave();
    },

    adjustRenderWindowWidth(event) {
      const navPanel = event[0].size;
      const rw = document.getElementById("renderWindow");
      rw.style.width = `${100 - navPanel}%`;
      this.$refs.renderWindow.resize();
    },
  },

  asyncComputed: {
    ...mapGetters({
      autoSavedViewDialog: "UI_AUTO_SAVE_DIALOG",
      cellCount: "VIEW_VISIBLE_CELL_COUNT",
      creator: "VIEWS_CREATOR",
      currentTimeStep: "VIEW_TIME_STEP",
      gridSize: "VIEWS_GRID_SIZE",
      itemId: "VIEW_CURRENT_ITEM_ID",
      items: "VIEWS_ITEMS",
      numcols: "VIEWS_COLUMNS",
      numrows: "VIEWS_ROWS",
      paused: "UI_PAUSE_GALLERY",
      runId: "VIEWS_RUN_ID",
      shouldAutoSave: "VIEWS_AUTO_SAVE_RUN",
      simulation: "VIEWS_SIMULATION",
      step: "VIEWS_STEP",
      maxTimeStep: "VIEW_MAX_TIME_STEP",
      initialDataLoaded: "VIEW_INITIAL_LOAD",
      minTimeStep: "VIEW_MIN_TIME_STEP",
      viewTimeStep: "VIEW_SAVED_TIME_STEP",
      numReady: "VIEW_NUM_READY",
      loadedFromSaved: "VIEW_LOADING_FROM_SAVED",
    }),

    location: {
      async get() {
        if (this.browserLocation) {
          return this.browserLocation;
        } else if (this.girderRest.user) {
          if (_.isNil(this.defaultLocation["_id"])) {
            // The dashboard will always use the eSimMon collection to collect all data
            let collection = await this.girderRest.get(
              "/collection?text=eSimMon",
            );
            // The eSimMon collection should have a single folder that contains all
            // data and serves as the top-level directory.
            let folder = await this.girderRest.get(
              `/folder?parentType=collection&parentId=${collection.data[0]._id}`,
            );
            this.defaultLocation["_id"] = folder.data[0]._id;
          }
          return this.defaultLocation;
        }
        return null;
      },

      set(newVal) {
        this.browserLocation = newVal;
      },
    },

    loggedOut() {
      const loggedOut = this.girderRest.user === null;
      if (loggedOut) {
        if (this.gridSize > 0) {
          this.resetView();
        }
      } else {
        this.setCreator(this.girderRest.user._id);
      }
      return loggedOut;
    },

    sliderValue() {
      if (this.minTimeStep <= this.currentTimeStep <= this.maxTimeStep) {
        return this.currentTimeStep;
      } else {
        return this.minTimeStep;
      }
    },
  },

  watch: {
    async location(current, previous) {
      if (current._modelType !== "folder") {
        return;
      }

      const { data } = await this.girderRest.get(
        `/folder/${current._id}/rootpath`,
      );
      let runFolder = current;
      let simFolder = data[data.length - 1].object;
      if (!("meta" in runFolder && data.length > 1)) {
        runFolder = data[data.length - 1]?.object;
        simFolder = data[data.length - 2]?.object;
      }

      if (
        previous?._id === current.parentId &&
        "meta" in runFolder &&
        "currentTimestep" in runFolder.meta
      ) {
        // This is a run folder. Check for auto-saved view to load and
        // update simulation and run id. Only prompt when coming from
        // parent folder
        this.setSimulation(simFolder._id);
        this.setRunId(runFolder._id);
        this.fetchAutoSave();
      }
    },

    numcols() {
      this.updateCellWidth();
    },

    numrows() {
      this.updateCellHeight();
    },

    gridSize(size) {
      if (size === 0) {
        this.setGridSize(this.numrows * this.numcols);
      } else {
        if (this.loggedOut && this.$refs.plots) {
          this.$refs.plots.forEach((cell) => {
            cell.loadTemplateGallery({ id: null, zoom: null });
            cell.clearGallery();
          });
        } else if (this.$refs.plots && this.loadedFromSaved) {
          this.applyView();
        }
      }
    },

    paused(isPaused) {
      if (!isPaused) {
        // Give the user a moment to view the first time step
        // before progressing
        this.setTickWait(500);
      }
    },

    initialDataLoaded(initialLoad) {
      if (initialLoad) {
        return;
      }

      if (this.dataLoaded) {
        return;
      }
      this.dataLoaded = true;

      // Setup polling to watch for new data.
      this.poll();

      // Setup polling to autosave view
      this.autosave();
    },
  },
};
