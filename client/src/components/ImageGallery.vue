<template lang="pug">
v-card.vertical-center(height="100%"
                       v-on:drop="loadGallery($event)"
                       v-on:dragover="preventDefault($event)")
  v-card-text.text-xs-center
    div(v-if="itemId")
      Plotly.plot(v-for="image in loadedImages"
            v-if="image.timestep == step"
            :key="image.timestep"
            :data="image.data"
            :layout="image.layout")
    v-icon(v-if="!itemId" large) input
</template>

<script>
import { Plotly } from 'vue-plotly';

export default {
  components: {
    Plotly
  },

  props: {
    currentTimeStep: {
      type: Number,
      required: true
    },
    maxTimeStep: {
      type: Number,
      required: true
    },
  },

  inject: ['girderRest'],

  data() {
    return {
      initialLoad: true,
      itemId: null,
      loadedImages: [],
      pendingImages: 0,
      rows: [],
      step: 0,
    };
  },

  asyncComputed: {
    rows: {
      default: [],
      async get() {
        if (!this.itemId) {
          return [];
        }

        if (this.rows.length == 0) {
          this.loadImageUrls();
        }
        return this.rows;
      },
    },
  },

  watch: {
    currentTimeStep: {
      immediate: true,
      handler () {
        this.step = this.currentTimeStep;
        this.preCacheImages();
      }
    },
    itemId: {
      immediate: true,
      handler () {
        this.rows = [];
        this.loadedImages = [];
      }
    },
    maxTimeStep: {
      immediate: true,
      handler () {
        this.loadImageUrls();
      }
    },

    pendingImages: {
      immediate: true,
      handler () {
        if (!this.itemId) {
          return;
        }
        if (this.pendingImages == 0) {
          this.$parent.$parent.$emit("gallery-ready");
        }
      }
    },
  },

  updated: function() {
    this.imageLoaded();
  },

  methods: {
    preventDefault: function (event) {
      event.preventDefault();
    },

    loadImageUrls: async function () {
      if (!this.itemId) {
        return;
      }

      const endpoint = `item/${this.itemId}/files?limit=0`;
      const response = await this.callEndpoint(endpoint);

      this.rows = await Promise.all(response.map(async function(val) {
        let img = await this.callEndpoint(
          `file/${val._id}/download?contentDisposition=inline`);
        return {img, name: val.name};
      }, this));

      this.preCacheImages();

      if (this.initialLoad) {
        // Not sure why this level of parent chaining is required
        // to get the app to be able to hear the event.
        this.$parent.$parent.$parent.$parent.$emit("data-loaded", this.rows.length, this.itemId);
        this.initialLoad = false;
      }
    },

    callEndpoint: async function (endpoint) {
      const { data } = await this.girderRest.get(endpoint);
      return data;
    },

    loadGallery: function (event) {
      event.preventDefault();
      var items = JSON.parse(event.dataTransfer.getData('application/x-girder-items'));
      this.itemId = items[0];
    },

    preCacheImages: function () {
      // Return early if we haven't loaded the list of images from Girder yet.
      if (this.rows === null || this.rows.constructor !== Array || this.rows.length < 1) {
        return;
      }
      // Load the current image and the next two.
      var any_images_loaded = false;
      for (var i = this.step; i < this.step + 3; i++) {
        if (i > this.maxTimeStep || i > this.rows.length) {
          break;
        }

        // Only load this image we haven't done so already.
        var load_image = true;
        for (var j = 0; j < this.loadedImages.length; j++) {
          if (this.loadedImages[j].timestep === i) {
            load_image = false;
            break;
          }
        }
        if (load_image) {
          // Javascript arrays are 0-indexed but our simulation timesteps are 1-indexed.
          any_images_loaded = true;
          this.pendingImages = 1;
          this.loadedImages.push({
            timestep: i,
            data: this.rows[i - 1].img.data,
            layout: this.rows[i - 1].img.layout
          });
        }
      }

      // Reduce memory footprint by only keeping ten images per gallery.
      if (this.loadedImages.length > 10) {
        this.loadedImages = this.loadedImages.slice(-10);
      }

      // Report this gallery as ready if we didn't need to load any new images.
      if (!any_images_loaded && this.pendingImages == 0) {
        this.$parent.$parent.$emit("gallery-ready");
      }
    },

    imageLoaded: function () {
      this.pendingImages = 0;
    },
  },
};
</script>

<style lang="scss" type="text/scss">
    @import '../scss/gallery.scss';
</style>
