<template>
<v-app class="app pr-3">
  <v-dialog :value="loggedOut" persistent max-width="600px">
    <girder-auth :register="true"
                 :oauth="false"
                 :forgot-password-url="forgotPasswordUrl" />
  </v-dialog>
  <splitpanes>
    <pane min-size="15" :size="25">
      <v-row>
        <!-- Navigation panel on the left. -->
        <v-col v-bind:style="{padding: '0 10px'}">
          <!-- Girder data table browser. -->
          <div class="girder-placeholder" v-if="!location" />
          <div>
            <v-tooltip right light
                       v-if="range"
                       :value="range"
                       :position-x="pos[0]"
                       :position-y="pos[1]">
              <span v-if="range">{{range}}</span>
            </v-tooltip>
          </div>
          <girder-file-manager ref="girderFileManager"
                               v-if="location"
                               v-on:mouseover.native="hoverIn($event)"
                               v-on:mouseout.native="hoverOut"
                               :location.sync="location"
                               :selectable="false"
                               :new-folder-enabled="false"
                               :drag-enabled="true" />
          <!-- Playback controls. -->
          <v-container class="playback-controls pl-2 pr-1"
                       v-on:mouseover="hoverOut">
            <v-row>
              <v-col sm>
                <div class="text-xs-center">
                  <v-icon v-on:click="decrementTimeStep(true)"
                          :disabled="!dataLoaded"> arrow_back_ios </v-icon>
                </div>
              </v-col>
              <v-col :sm="8" :offset-sm="1">
                <v-slider v-model="currentTimeStep"
                          :min="1"
                          :max="maxTimeStep"
                          :disabled="!dataLoaded"
                          width="100%"
                          height="1px"
                          thumb-label="always" />
              </v-col>
              <v-col :sm="1">
                <div class="text-xs-center">
                  <v-icon v-on:click="incrementTimeStep(true)"
                          :disabled="!dataLoaded"> arrow_forward_ios </v-icon>
                </div>
              </v-col>
            </v-row>
            <v-row>
              <v-col :sm="6" class="text-xs-center">
                <v-icon v-show="paused"
                        v-on:click="togglePlayPause"
                        :disabled="!dataLoaded"> &#9654; </v-icon>
                <v-icon v-show="!paused"
                        v-on:click="togglePlayPause"
                        :disabled="!dataLoaded"> &#9208; </v-icon>
              </v-col>
              <v-col :sm="6" class="text-xs-center">
                <input v-model="currentTimeStep"
                       type="number"
                       min="1"
                       :max="maxTimeStep"
                       size="4"
                       :disabled="!dataLoaded">
              </v-col>
            </v-row>
            <v-row>
              <v-col :sm="2">
                <v-icon v-on:click="removeRow()"
                        :disabled="numrows < 2"> remove_circle_outline </v-icon>
              </v-col>
              <v-col :sm="2">
                <span> rows </span>
              </v-col>
              <v-col :sm="2">
                <v-icon v-on:click="addRow()"
                        :disabled="numrows > 7"> add_circle_outline </v-icon>
              </v-col>
            </v-row>
            <v-row>
              <v-col :sm="2">
                <v-icon v-on:click="removeColumn()"
                        :disabled="numcols < 2"> remove_circle_outline </v-icon>
              </v-col>
              <v-col :sm="2">
                <span> cols </span>
              </v-col>
              <v-col :sm="2">
                <v-icon v-on:click="addColumn()"
                        :disabled="numcols > 7">  add_circle_outline </v-icon>
              </v-col>
            </v-row>
            <v-row>
              <v-icon v-on:click="girderRest.logout()"> $vuetify.icons.logout </v-icon>
            </v-row>
          </v-container>
        </v-col>
      </v-row>
    </pane>
    <!-- Scientific data on the right. -->
    <pane class="main-content"
          v-on:mouseover.native="hoverOut">
      <!-- image gallery grid. -->
      <v-container v-bind:style="{padding: '0'}">
        <template v-for="i in numrows">
          <v-row v-bind:key="i">
            <template v-for="j in numcols">
              <v-col v-bind:key="j"
                     v-bind:style="{ width: cellWidth, height: cellHeight, padding: '0' }">
                <image-gallery ref="imageGallery"
                              :currentTimeStep.sync="currentTimeStep"
                              :maxTimeStep.sync="maxTimeStep"
                              :numrows.sync="numrows"
                              :numcols.sync="numcols"
                              v-bind:style="{padding: '0 0 0 10px'}"
                              v-bind:class="[paused ? 'show-toolbar' : 'hide-toolbar']" />
              </v-col>
            </template>
          </v-row>
        </template>
      </v-container>
    </pane>
  </splitpanes>
</v-app>
</template>

<script>
import { Splitpanes, Pane } from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';
import _ from 'lodash';
import ImageGallery from './components/ImageGallery.vue';
import { Authentication as GirderAuth } from '@girder/components/src/components';
import { FileManager as GirderFileManager } from '@girder/components/src/components/Snippet';

export default {
  name: 'App',
  inject: ['girderRest', 'defaultLocation'],

  components: {
    GirderAuth,
    GirderFileManager,
    ImageGallery,
    Splitpanes,
    Pane
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
      const folderId = this.location._id;
      let img = null;
      if (!this.cancel) {
        img = await this.callEndpoints(folderId);
        if (!event || (event.target.textContent.trim() == this.parameter)) {
          if (img)
            this.updateRange(img.data.data[0].y, event);
        }
      }
    },

    callEndpoints(folderId) {
      var self = this;
      var endpoint = `item?folderId=${folderId}&name=${this.parameter}&limit=50&sort=lowerName&sortdir=1`;
      const data = this.girderRest.get(endpoint)
                    .then(function(result) {
                      if (result && !self.cancel) {
                        var offset = self.currentTimeStep ? self.currentTimeStep-1 : 1;
                        endpoint = `item/${result.data[0]._id}/files?limit=1&offset=${offset}&sort=name&sortdir=1`;
                        return new Promise((resolve) => {
                          const file = self.girderRest.get(endpoint);
                          resolve(file);
                        });}
                    })
                    .then(function(result) {
                      if (result && !self.cancel) {
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

      this._poller = setTimeout(async () => {
        try {
          const { data } = await this.girderRest.get(`/folder/${this.runId}`);
          if (data.hasOwnProperty('meta') && data.meta.hasOwnProperty('currentTimestep')) {
            var new_timestep = data.meta.currentTimestep;
            if (new_timestep > this.maxTimeStep) {
              this.maxTimeStep = new_timestep;
            }
          }
        } finally {
          this.poll(itemId);
        }
      }, 10000);
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
  },

  created: function () {
    this.$on('data-loaded', this.initialDataLoaded);
    this.$on('gallery-ready', this.incrementReady);
  },

  computed: {
    location: {
      get() {
        if (this.browserLocation) {
          return this.browserLocation;
        } else if (this.girderRest.user) {
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
};
</script>

<style lang="scss" type="text/scss">
  @import './scss/gallery.scss';
</style>
