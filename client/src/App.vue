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
      girder-data-browser(ref="girderBrowser",
          v-if="location",
          :location.sync="location",
          :select-enabled="false",
          :new-item-enabled="false",
          :new-folder-enabled="false",
          :draggable="true")
    // Everything else on the right.
    v-flex.main-content(xs10)
      // image gallery grid.
      template(v-for="i in numrows")
        v-layout(row)
          template(v-for="j in numcols")
            image-gallery(
              v-bind:uid="i + '-' + j",
              :currentTimeStep.sync="currentTimeStep")
      // Playback controls.
      div.playback-controls
        v-layout(row fluid).mt-0.mb-0
          v-flex(xs1)
            div.text-xs-center
              v-btn(v-on:click="decrementTimeStep(true)"
                    :disabled="!dataLoaded"
                    flat icon small)
                v-icon arrow_back_ios
          v-flex(xs10)
            v-slider(v-model="currentTimeStep"
                     :max="maxTimeStep"
                     :disabled="!dataLoaded"
                     width="100%"
                     height="1px"
                     thumb-label="always")
          v-flex(xs1)
            div.text-xs-center
              v-btn(v-on:click="incrementTimeStep(true)"
                    :disabled="!dataLoaded"
                    flat icon small)
                v-icon arrow_forward_ios
        v-layout(row fluid).mt-0.mb-0
          v-flex(xs12)
            div.controls.text-xs-center
              button(v-on:click="togglePlayPause" :disabled="!dataLoaded")
              button(v-on:click="togglePlayPause" :disabled="!dataLoaded")
                span(v-show="paused") &#9654;
                span(v-show="!paused") &#9208;
</template>

<script>
import ImageGallery from './components/ImageGallery.vue'
import {
  Authentication as GirderAuth,
  DataBrowser as GirderDataBrowser,
} from '@girder/components/src/components';

export default {
  name: 'App',
  inject: ['girderRest'],

  components: {
    GirderAuth,
    GirderDataBrowser,
    ImageGallery,
  },

  data() {
    return {
      browserLocation: null,
      currentTimeStep: 0,
      dataLoaded: false,
      forgotPasswordUrl: '/#?dialog=resetpassword',
      maxTimeStep: 0,
      numrows: 2,
      numcols: 2,
      paused: true,
    };
  },

  methods: {
    decrementTimeStep(should_pause) {
      this.currentTimeStep -= 1;
      if (this.currentTimeStep < 0) {
        this.currentTimeStep = this.maxTimeStep;
      }
      if (should_pause) {
        this.paused = true;
      }
    },

    incrementTimeStep(should_pause) {
      this.currentTimeStep += 1;
      if (this.currentTimeStep > this.maxTimeStep) {
        this.currentTimeStep = 0;
      }
      if (should_pause) {
        this.paused = true;
      }
    },

    initialDataLoaded(num_timesteps) {
      if (this.dataLoaded) {
        return;
      }
      this.dataLoaded = true;
      this.maxTimeStep = num_timesteps - 1;
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
          return { _modelType: 'collection', _id: '5c5b42678d777f072b2f955c' };
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
