<template lang="pug">
v-app.app.pr-3
  v-dialog(:value="loggedOut", persistent, full-width, max-width="600px")
    girder-auth(
        :register="true",
        :oauth="false",
        :forgot-password-url="forgotPasswordUrl")
  v-layout(row fluid)
    // Navigation panel on the left.
    v-flex(xs2)
      // Girder data table browser.
      div.girder-placeholder(v-if="!location")
      girder-data-browser(ref="girderBrowser",
          v-if="location",
          :location.sync="location",
          :select-enabled="false",
          :new-item-enabled="false",
          :new-folder-enabled="false",
          :draggable="true")
      // Playback controls.
      div.playback-controls.pl-2.pr-1
        v-layout(row fluid).mt-0.mb-0
          v-flex(xs1)
            div.text-xs-center
              v-icon(v-on:click="decrementTimeStep(true)"
                     :disabled="!dataLoaded") arrow_back_ios
          v-flex(xs8 offset-xs1)
            v-slider(v-model="currentTimeStep"
                     :min="1"
                     :max="maxTimeStep"
                     :disabled="!dataLoaded"
                     width="100%"
                     height="1px"
                     thumb-label="always")
          v-flex(xs1)
            div.text-xs-center
              v-icon(v-on:click="incrementTimeStep(true)"
                     :disabled="!dataLoaded") arrow_forward_ios
        v-layout(row justify-space-between).mt-0.mb-0
          v-flex(xs6).text-xs-center
            v-icon(v-show="paused"
                   v-on:click="togglePlayPause"
                   :disabled="!dataLoaded") &#9654;
            v-icon(v-show="!paused"
                   v-on:click="togglePlayPause"
                   :disabled="!dataLoaded") &#9208;
          v-flex(xs6).text-xs-center
            input(v-model="currentTimeStep"
                  type="number"
                  min="1"
                  :max="maxTimeStep"
                  size="4"
                  :disabled="!dataLoaded")
        v-layout(row justify-space-between).mt-0.mb-0
          v-flex(xs2)
            v-icon(v-on:click="removeRow()"
                   :disabled="numrows < 2") remove_circle_outline
          v-flex(xs2)
            span rows
          v-flex(xs2)
            v-icon(v-on:click="addRow()"
                   :disabled="numrows > 7") add_circle_outline
        v-layout(row justify-space-between).mt-0.mb-0
          v-flex(xs2)
            v-icon(v-on:click="removeColumn()"
                   :disabled="numcols < 2") remove_circle_outline
          v-flex(xs2)
            span cols
          v-flex(xs2)
            v-icon(v-on:click="addColumn()"
                  :disabled="numcols > 7")  add_circle_outline
        v-layout(row justify-center).mt-0.mb-0
          v-icon(v-on:click="girderRest.logout()") $vuetify.icons.logout

    // Scientific data on the right.
    v-flex.main-content(xs10)
      // image gallery grid.
      v-layout(column)
        template(v-for="i in numrows")
          v-layout
            template(v-for="j in numcols")
              v-flex(v-bind:style="{ width: cellWidth, height: cellHeight }")
                image-gallery(:currentTimeStep.sync="currentTimeStep"
                              :maxTimeStep.sync="maxTimeStep")
</template>

<script>
import ImageGallery from './components/ImageGallery.vue'
import {
  Authentication as GirderAuth,
  DataBrowser as GirderDataBrowser,
} from '@girder/components/src/components';

export default {
  name: 'App',
  inject: ['girderRest', 'defaultLocation'],

  components: {
    GirderAuth,
    GirderDataBrowser,
    ImageGallery,
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
      paused: true,
      runId: null,
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

    incrementTimeStep(should_pause) {
      if (this.currentTimeStep < this.maxTimeStep) {
        this.currentTimeStep += 1;
      }
      if (should_pause) {
        this.paused = true;
      }
    },

    initialDataLoaded(num_timesteps, itemId) {
      if (this.dataLoaded) {
        return;
      }
      this.dataLoaded = true;
      this.maxTimeStep = num_timesteps;

      // Setup polling to watch for new data.
      this.poll(itemId);
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
      this.numcols -= 1;
      this.updateCellWidth();
    },

    removeRow() {
      this.numrows -= 1;
      this.updateCellHeight();
    },

    tick() {
      if (this.paused) {
        return;
      }
      this.incrementTimeStep(false);
      var self = this;
      setTimeout(function() {
        self.tick();
      }, 1000);
    },

    togglePlayPause() {
      this.paused = ! this.paused;
      if (!this.paused) {
        this.tick();
      }
    },

    updateCellWidth() {
      this.cellWidth = (100 / this.numcols) + "%";
    },

    updateCellHeight() {
      this.cellHeight = (100 / this.numrows) + "vh";
    },
  },

  created: function () {
    this.$on('data-loaded', this.initialDataLoaded);
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
