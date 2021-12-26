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
  inject: ['girderRest', 'defaultLocation', 'flaskRest'],

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
      run_name: undefined,
      simulation: undefined,
      defaultViewId: null,
      lastSaved: '',
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
                        var offset = self.currentTimeStep ? self.currentTimeStep-1 : 1;
                        endpoint = `item/${result.data[0]._id}/files?limit=1&offset=${offset}&sort=name&sortdir=1`;
                        return new Promise((resolve) => {
                          const file = self.girderRest.get(endpoint);
                          resolve(file);
                        });}
                    })
                    .then(function(result) {
                      if (result && !self.cancel && result.data.length) {
                        endpoint = `file/${result.data[0]._id}/download?contentDisposition=inline`;
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
        return;
      }
      this.dataLoaded = true;
      this.maxTimeStep = num_timesteps;

      // Setup polling to watch for new data.
      this.poll(itemId);

      // Setup polling to autosave view
      this.autosave();

      // Default to playing once a parameter has been selected
      this.togglePlayPause();
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
        url: `${this.flaskRest}/movie/${this.itemId}`,
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
      const cols = parseInt(view.columns, 10)
      const rows = parseInt(view.rows, 10)

      if (this.numcols !== cols) {
        this.setColumns(cols);
      }
      if (this.numrows !== rows) {
        this.setRows(rows);
      }
    },

    imageGalleryCreated() {
      if (this.view) {
        this.$refs.imageGallery.forEach((cell) => {
          const { row, col } = cell.$attrs;
          cell.itemId = this.view.items[`${row}::${col}`]
        });
        this.view = null;
      }
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
          if (this.run_name && this.simulation) {
            const name = `${this.simulation}_${this.run_name}_default`;
            const formData = saveLayout(
              this.$refs.imageGallery,
              name,
              this.numrows,
              this.numcols,
              this.currentTimeStep,
              false);
            // Check if default view already exists
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
  },

  created: async function () {
    this.$on('data-loaded', this.initialDataLoaded);
    this.$on('gallery-ready', this.incrementReady);
    this.$on('param-selected', this.contextMenu);
    this.$on('gallery-mounted', this.imageGalleryCreated);
    this.$on('view-selected', this.viewSelected);
    this.$on('range-updated', this.setGlobalRange);
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
      const parent = current.parentId;
      if (parent && current._modelType === 'folder') {
        const { data } = await this.girderRest.get(`/folder/${parent}`);
        const { name, parentId } = data;
        if ('meta' in data && 'currentTimestep' in data.meta) {
          // This is the run folder and its parent is the simulation
          this.run_name = name;
          const { data } = await this.girderRest.get(`/folder/${parentId}`);
          this.simulation = data.name;
          console.log('run name: ', this.run_name, ' simulation: ', this.simulation);
        }
      }
    }
  },
};
