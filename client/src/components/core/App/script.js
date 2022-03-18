import axios from 'axios';
import { Splitpanes, Pane } from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';
import _ from 'lodash';
import RenderWindow from '../../widgets/RenderWindow';
import ImageGallery from '../../widgets/ImageGallery';
import { GirderAuthentication as GirderAuthentication } from '@girder/components/src';
import GirderFileManager from '../../widgets/GirderFileManager';
import ViewControls from '../ViewControls';
import RangeDialog from '../../widgets/RangeDialog';
import { mapActions, mapGetters, mapMutations } from 'vuex';

export default {
  name: 'App',
  inject: ['girderRest', 'defaultLocation', 'fastRestUrl'],

  components: {
    GirderAuthentication,
    GirderFileManager,
    RenderWindow,
    ImageGallery,
    Splitpanes,
    Pane,
    ViewControls,
    RangeDialog,
  },

  data() {
    return {
      browserLocation: null,
      cellWidth: '100%',
      cellHeight: '100vh',
      dataLoaded: false,
      forgotPasswordUrl: '/#?dialog=resetpassword',
      numLoadedGalleries: 0,
      numReady: 0,
      runId: null,
      range: '',
      pos: [],
      parameter: '',
      cancel: false,
      showMenu: false,
      movieRequested: false,
      generationFailed: false,
      paramIsJson: false,
      showRangeDialog: false,
    };
  },

  methods: {
    ...mapActions({
      viewAutoSaved: 'VIEW_AUTO_SAVE',
      createItems: 'VIEW_BUILD_ITEMS_OBJECT',
      fetchAutoSave: 'VIEW_FETCH_AUTO_SAVE',
      loadAutoSave: 'VIEW_LOAD_AUTO_SAVE',
      togglePlayPause: 'UI_TOGGLE_PLAY_PAUSE',
    }),

    ...mapMutations({
      setAutoSaveName: 'VIEW_AUTO_SAVE_NAME_SET',
      setAutoSavedViewDialog: 'UI_AUTO_SAVE_DIALOG_SET',
      setColumns: 'VIEW_COLUMNS_SET',
      setCreator: 'VIEW_CREATOR_SET',
      setCurrentTimeStep: 'PLOT_TIME_STEP_SET',
      setCurrentItemId: 'PLOT_CURRENT_ITEM_ID_SET',
      setGridSize: 'VIEW_GRID_SIZE_SET',
      setPaused: 'UI_PAUSE_GALLERY_SET',
      setPublic: 'VIEW_PUBLIC_SET',
      setRows: 'VIEW_ROWS_SET',
      setRunId: 'VIEW_RUN_ID_SET',
      setShouldAutoSave: 'VIEW_AUTO_SAVE_RUN_SET',
      setSimulation: 'VIEW_SIMULATION_SET',
      setMaxTimeStep: 'PLOT_MAX_TIME_STEP_SET',
    }),

    addColumn() {
      this.setColumns(this.numcols + 1);
      this.setGridSize(this.rows * this.columns);
    },

    addRow() {
      this.setRows(this.numrows + 1);
      this.setGridSize(this.rows * this.columns);
    },

    decrementTimeStep(should_pause) {
      if (this.currentTimeStep > 1) {
        this.setCurrentTimeStep(this.currentTimeStep - 1);
      }
      this.setPaused(should_pause);
    },

    hoverOut() {
      this.range = '';
      this.cancel = true;
    },

    hoverIn: _.debounce(function(event){
        if (this.showMenu)
          return;

        const node = event.target;
        const parent = node ? node.parentNode : null;
        if ((parent && parent.classList.value.includes('pl-3'))
              || (node.classList.value.includes('pl-3')
              && node.textContent != parent.textContent)) {
          this.parameter = node.textContent.trim();
          this.cancel = false;
          this.getRangeData(event);
        }
      }, 100),

    async getRangeData(event=null) {
      if (_.isNull(this.location) || this.location._modelType != 'folder')
        return;

      const folderId = this.location._id;
      let img = null;
      if (!this.cancel) {
        if (event && !event.target.textContent){
          this.cancel = true;
          return;
        } else if (!event || (event.target.textContent.trim() == this.parameter)) {
          img = await this.callEndpoints(folderId);
          if (img && img.data.data)
            this.updateRange(img.data.data[0].y, event);
        }
      }
    },

    callEndpoints(folderId) {
      if (!folderId)
        return;

      var self = this;
      var endpoint = `item?folderId=${folderId}&name=${this.parameter}&limit=50&sort=lowerName&sortdir=1`;
      const data = this.girderRest.get(endpoint)
                    .then(function(result) {
                      if (result && !self.cancel && result.data.length) {
                        endpoint = `${self.fastRestUrl}/variables/${result.data[0]._id}/timesteps/${self.currentTimeStep}/plot`;

                        return new Promise((resolve) => {
                          const data = self.girderRest.get(endpoint);
                          resolve(data);
                        });}
                    });
      return data;
    },

    updateRange(yVals, event) {
      this.pos = event ? [event.clientX, event.clientY] : this.pos;
      this.range = '[' + Math.min(...yVals).toExponential(3) + ', '
                       + Math.max(...yVals).toExponential(3) + ']';
    },

    updateTimeStep(val) {
      this.setCurrentTimeStep(parseInt(val));
    },

    incrementTimeStep(should_pause) {
      if (this.currentTimeStep < this.maxTimeStep) {
        this.setCurrentTimeStep(this.currentTimeStep + 1);
        this.numReady = 0;
      }
      this.setPaused(should_pause);
    },

    lookupRunId() {
      // Get the grandparent folder for this item. Its metadata will tell us
      // what timestamps are available.
      this.girderRest.get(`/item/${this.itemId}`)
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
          if ('meta' in data && 'currentTimestep' in data.meta) {
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
      this.numLoadedGalleries -= this.numrows;
      this.setColumns(this.numcols - 1);
      this.setGridSize(this.rows * this.columns);
    },

    removeRow() {
      this.numLoadedGalleries -= this.numcols;
      this.setRows(this.numrows - 1);
      this.setGridSize(this.rows * this.columns);
    },

    tick() {
      if (this.paused) {
        return;
      }
      var wait_ms = 2000;
      if (this.numReady >= this.numLoadedGalleries) {
        this.incrementTimeStep(false);
        wait_ms = 1000;
      }
      this.setTickWait(wait_ms);
    },

    setTickWait(wait_ms) {
      var self = this;
      setTimeout(function() {
        self.tick();
      }, wait_ms);
    },

    updateCellWidth() {
      this.cellWidth = (100 / this.numcols) + "%";
    },

    updateCellHeight() {
      this.cellHeight = (100 / this.numrows) + "vh";
    },

    incrementReady() {
      this.numReady += 1;
      this.getRangeData(event);
    },

    contextMenu(data) {
      const { id, name, event, isJson } = data;
      this.parameter = name;
      this.setCurrentItemId(id);
      this.showMenu = false;
      this.pos = [event.clientX, event.clientY];
      this.paramIsJson = isJson;
      this.$nextTick(() => {
        this.showMenu = true;
      });
    },

    fetchMovie() {
      let name = this.parameter;
      this.movieRequested = true;
      axios({
        url: `${this.fastRestUrl}/movie/${this.itemId}`,
        method: 'GET',
        headers: { 'girderToken': this.girderRest.token },
        responseType: 'blob'
      }).then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${name}.mp4`);
        document.body.appendChild(link);
        link.click();
      }).catch(() => {
        this.generationFailed = true;
      });
    },

    applyView() {
      this.$refs.imageGallery.forEach((cell) => {
        const { row, col } = cell.$attrs;
        const item = this.items[`${row}::${col}`];
        if (item) {
          cell.loadTemplateGallery(item);
        } else {
          cell.clearGallery()
        }
      });
      this.setGridSize(0);
    },

    resetView() {
      this.setPaused(true);
      this.setCurrentTimeStep(1);
      this.setMaxTimeStep(0);
      this.setColumns(1);
      this.setRows(1);
      this.setGridSize(1);
      this.numLoadedGalleries = 0;
      this.numReady = 0;
      this.dataLoaded = false;
      this.runId = null;
      this.location = null;
    },

    autosave() {
      this._autosave = setTimeout(async () => {
        try {
          if (this.shouldAutoSave) {
            this.createItems(this.$refs.imageGallery);
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

    async setRun(itemId) {
      const { data } = await this.girderRest.get(`/item/${itemId}/rootpath`);
      const runIdx = data.length - 2;
      const simulationIdx = runIdx - 1;
      this.setRunId(data[runIdx].object._id);
      this.setSimulation(data[simulationIdx].object._id);
      this.setShouldAutoSave(true);
    },

    loadAutoSavedView() {
      this.loadAutoSave();
    }
  },

  created: async function () {
    this.$on('data-loaded', this.initialDataLoaded);
    this.$on('gallery-ready', this.incrementReady);
    this.$on('param-selected', this.contextMenu);
    this.$on('item-added', this.setRun);
  },

  asyncComputed: {
    ...mapGetters({
      autoSavedViewDialog: 'UI_AUTO_SAVE_DIALOG',
      cellCount: 'PLOT_VISIBLE_CELL_COUNT',
      creator: 'VIEW_CREATOR',
      currentTimeStep: 'PLOT_TIME_STEP',
      globalRanges: 'PLOT_GLOBAL_RANGES',
      gridSize: 'VIEW_GRID_SIZE',
      itemId: 'PLOT_CURRENT_ITEM_ID',
      items: 'VIEW_ITEMS',
      numcols: 'VIEW_COLUMNS',
      numrows: 'VIEW_ROWS',
      paused: 'UI_PAUSE_GALLERY',
      runId: 'VIEW_RUN_ID',
      shouldAutoSave: 'VIEW_AUTO_SAVE_RUN',
      simulation: 'VIEW_SIMULATION',
      step: 'VIEW_STEP',
      maxTimeStep: 'PLOT_MAX_TIME_STEP',
      loadedFromView: 'PLOT_LOADED_FROM_VIEW',
      initialDataLoaded: 'PLOT_INITIAL_LOAD',
    }),

    location: {
      async get() {
        if (this.browserLocation) {
          return this.browserLocation;
        } else if (this.girderRest.user) {
          if (_.isNil(this.defaultLocation['_id'])) {
            let { data } = await this.girderRest.get(
              `/resource/lookup?path=%2Fcollection%2FeSimMon%2Fdata`);
            this.defaultLocation['_id'] = data['_id'];
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
      const loggedOut = (this.girderRest.user === null);
      if (loggedOut) {
        if (this.numLoadedGalleries > 0) {
          this.resetView();
        }
      } else {
        this.setCreator(this.girderRest.user._id);
      }
      return loggedOut;
    },
  },

  watch: {
    movieRequested(val) {
      if (!val) {
        setTimeout(() => { this.movieRequested = false; }, 5000);
      }
    },

    generationFailed(val) {
      if (!val) {
        setTimeout(() => { this.generationFailed = false; }, 5000);
      }
    },

    async location(current) {
      if (current._modelType !== 'folder') {
        return;
      }

      const { data } = await this.girderRest.get(
        `/folder/${current._id}/rootpath`);
      let runFolder = current;
      let simFolder = data[data.length - 1].object;
      if (!('meta' in runFolder && data.length > 1)) {
        runFolder = data[data.length - 1]?.object;
        simFolder = data[data.length - 2]?.object;
      }

      if ('meta' in runFolder && 'currentTimestep' in runFolder.meta) {
        // This is a run folder. Check for auto-saved view to load and
        // update simulation and run id.
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
      if (size === this.cellCount && this.$refs.imageGallery) {
        this.applyView();
      }
    },

    cellCount(count) {
      if (this.gridSize === count) {
        if (this.loggedOut && this.$refs.imageGallery) {
          this.$refs.imageGallery.forEach((cell) => {
            cell.loadTemplateGallery({id: null, zoom: null});
            cell.clearGallery();
          });
        } else if (this.$refs.imageGallery) {
          this.applyView();
        }
      }
    },

    paused(isPaused) {
      if (!isPaused) {
        // Give the user a moment to view the first time step
        // before progressing
        const wait_ms = this.currentTimeStep === 1 ? 2000 : 0;
        this.setTickWait(wait_ms);
      }
    },

    initialDataLoaded(initialLoad) {
      if (initialLoad) {
        return;
      }

      this.numLoadedGalleries += 1;
      if (this.dataLoaded) {
          return
      }
      this.dataLoaded = true;

      // Setup polling to watch for new data.
      this.poll();

      // Setup polling to autosave view
      this.autosave();

      if (!this.loadedFromView) {
        // Default to playing once a parameter has been selected
        this.setPaused(false);
      }
    },
  },
};
