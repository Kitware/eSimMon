import axios from 'axios';
import { Splitpanes, Pane } from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';
import _ from 'lodash';
import ImageGallery from '../../widgets/ImageGallery';
import { GirderAuthentication as GirderAuthentication } from '@girder/components/src';
import GirderFileManager from '../../widgets/GirderFileManager';
import ViewControls from '../ViewControls';
import RangeDialog from '../../widgets/RangeDialog';
import { saveLayout } from '../../../utils/utilityFunctions';

export default {
  name: 'App',
  inject: ['girderRest', 'defaultLocation', 'fastRestUrl'],

  components: {
    GirderAuthentication,
    GirderFileManager,
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
      currentTimeStep: 1,
      dataLoaded: false,
      forgotPasswordUrl: '/#?dialog=resetpassword',
      maxTimeStep: 0,
      numrows: 1,
      numcols: 1,
      numLoadedGalleries: 0,
      numReady: 0,
      paused: true,
      runId: null,
      range: '',
      pos: [],
      parameter: '',
      cancel: false,
      showMenu: false,
      movieRequested: false,
      generationFailed: false,
      view: null,
      globalRanges: {},
      paramIsJson: false,
      showRangeDialog: false,
      run_id: undefined,
      simulation: undefined,
      autoSavedView: null,
      lastSaved: '',
      loadAutoSavedViewDialog: false,
      viewGrid: null,
      autosave_run: false,
      galleryCount: 0,
    };
  },

  methods: {
    addColumn() {
      this.numcols += 1;
      this.updateCellWidth();
    },

    addRow() {
      this.numrows += 1;
      this.updateCellHeight();
    },

    decrementTimeStep(should_pause) {
      if (this.currentTimeStep > 1) {
        this.currentTimeStep -= 1;
      }
      if (should_pause) {
        this.paused = true;
      }
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
                        let timestep = self.currentTimeStep ? self.currentTimeStep-1 : 1;
                        endpoint = `${self.fastRestUrl}/variables/${result.data[0]._id}/timesteps/${timestep}/plot`;

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

    incrementTimeStep(should_pause) {
      if (this.currentTimeStep < this.maxTimeStep) {
        this.currentTimeStep += 1;
        this.numReady = 0;
      }
      if (should_pause) {
        this.paused = true;
      }
    },

    initialDataLoaded(num_timesteps, itemId) {
      this.numLoadedGalleries += 1;
      if (this.dataLoaded) {
          return
      }

      this.dataLoaded = true;
      this.maxTimeStep = num_timesteps;

      // Setup polling to watch for new data.
      this.poll(itemId);

      // Setup polling to autosave view
      this.autosave();

      // Default to playing once a parameter has been selected
      this.togglePlayPause();

      // Update step/play/pause state if initial data came from View
      this.setViewStep();
    },

    lookupRunId(itemId) {
      // Get the grandparent folder for this item. Its metadata will tell us
      // what timestamps are available.
      this.girderRest.get(`/item/${itemId}`)
      .then((response) => {
        return this.girderRest.get(`/folder/${response.data.folderId}`);
      })
      .then((response) => {
        this.runId = response.data.parentId;
        return this.poll(itemId);
      });
    },

    poll(itemId) {
      if (!this.runId) {
        return this.lookupRunId(itemId);
      }

      let timeout = this.currentTimeStep > 1 ? 10000 : 0;
      this._poller = setTimeout(async () => {
        try {
          const { data } = await this.girderRest.get(`/folder/${this.runId}`);
          if ('meta' in data && 'currentTimestep' in data.meta) {
            var new_timestep = data.meta.currentTimestep;
            if (new_timestep > this.maxTimeStep) {
              this.maxTimeStep = new_timestep;
            }
          }
        } finally {
          this.poll(itemId);
        }
      }, timeout);
    },

    removeColumn() {
      this.numLoadedGalleries -= this.numrows;
      this.numcols -= 1;
      this.updateCellWidth();
    },

    removeRow() {
      this.numLoadedGalleries -= this.numcols;
      this.numrows -= 1;
      this.updateCellHeight();
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

    togglePlayPause() {
      this.paused = ! this.paused;
      if (!this.paused) {
        // Give the user a moment to view the first time step
        // before progressing
        const wait_ms = this.currentTimeStep === 1 ? 2000 : 0;
        this.setTickWait(wait_ms);
      }
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
      this.itemId = id;
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

    setColumns(val) {
      this.numcols = val;
      this.updateCellWidth();
    },

    setRows(val) {
      this.numrows = val;
      this.updateCellHeight();
    },

    viewSelected(view) {
      this.view = view;
      const cols = parseInt(view.columns, 10);
      const rows = parseInt(view.rows, 10);
      this.viewGrid = cols * rows;

      if (this.numcols !== cols) {
        this.setColumns(cols);
      }
      if (this.numrows !== rows) {
        this.setRows(rows);
      }
      this.applyView(0);
    },

    applyView(change) {
      this.galleryCount += change;
      if (this.galleryCount === this.viewGrid) {
        this.$refs.imageGallery.forEach((cell) => {
          const { row, col } = cell.$attrs;
          const itemId = this.view.items[`${row}::${col}`];
          if (itemId) {
            cell.itemId = this.view.items[`${row}::${col}`];
          } else {
            cell.clearGallery()
          }
        });
        this.setViewStep();
      }
    },

    setViewStep() {
      if (!this.dataLoaded)
        return
      this.currentTimeStep = parseInt(this.view.step, 10);
      this.paused = true;
      this.view = null;
      this.viewGrid = null;
    },

    resetView() {
      this.paused = true;
      this.currentTimeStep = 0;
      this.maxTimeStep = 0;
      this.setColumns(1);
      this.setRows(1);
      this.numLoadedGalleries = 0;
      this.numReady = 0;
      this.dataLoaded = false;
      this.runId = null;
      this.location = null;
      this.$refs.imageGallery[0].clearGallery();
    },

    setGlobalRange(range) {
      this.globalRanges[`${this.itemId}`] = range;
      this.$refs.imageGallery.forEach((cell) => {
        if (cell.itemId === this.itemId) {
          cell.react();
        }
      });
    },

    autosave() {
      this._autosave = setTimeout(async () => {
        try {
          if (this.autosave_run) {
            const userId = this.girderRest.user._id;
            const name = `${this.simulation}_${this.run_id}_${userId}`;
            const meta = {simulation: this.simulation, run: this.run_id};
            const formData = saveLayout(
              this.$refs.imageGallery,
              name,
              this.numrows,
              this.numcols,
              meta,
              this.currentTimeStep,
              false);
            // Check if auto-saved view already exists
            const { data } = await this.girderRest.get(
              `/view?text=${name}&exact=true&limit=50&sort=name&sortdir=1`);
            if (data.length) {
              // If it does, update it
              this.lastSaved = (
                await this.girderRest.put(`/view/${data[0]._id}`, formData)
                .then(() => { return new Date(); }));
            } else {
              // If not, create it
              this.lastSaved = await this.girderRest.post('/view', formData)
              .then(() => { return new Date(); });
            }
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
      this.run_id = data[runIdx].object._id;
      this.simulation = data[simulationIdx].object._id;
      this.autosave_run = true;
    },

    loadAutoSavedView() {
      this.viewSelected(this.autoSavedView);
      this.autoSavedView = null;
      this.loadAutoSavedViewDialog = false;
    }
  },

  created: async function () {
    this.$on('data-loaded', this.initialDataLoaded);
    this.$on('gallery-ready', this.incrementReady);
    this.$on('param-selected', this.contextMenu);
    this.$on('view-selected', this.viewSelected);
    this.$on('range-updated', this.setGlobalRange);
    this.$on('pause-gallery', () => {this.paused = true});
    this.$on('item-added', this.setRun);
    this.$on('gallery-count-changed', this.applyView);
  },

  asyncComputed: {
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
      return this.girderRest.user === null;
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

    loggedOut(noCurrentUser) {
      if (noCurrentUser && this.numLoadedGalleries > 0) {
        this.resetView();
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
        runFolder = data[data.length - 1].object;
        simFolder = data[data.length - 2]?.object;
      }

      if ('meta' in runFolder && 'currentTimestep' in runFolder.meta) {
        // This is a run folder. Check for auto-saved view to load and
        // update simulation and run id.
        this.simulation = simFolder._id;
        this.run_id = runFolder._id;
        this.autosave_run = false;
        const userId = this.girderRest.user._id;
        const viewName = `${this.simulation}_${this.run_id}_${userId}`;
        const { data } = await this.girderRest.get(
          `/view?text=${viewName}&exact=true&limit=50&sort=name&sortdir=1`)
        const view = data[0]
        if (view) {
          this.loadAutoSavedViewDialog = true;
          this.autoSavedView = view;
        }
      }
    }
  },
};
