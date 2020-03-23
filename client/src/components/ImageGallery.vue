<template lang="pug">
v-card.vertical-center(height="100%"
                       v-on:drop="loadGallery($event)"
                       v-on:dragover="preventDefault($event)")
  v-card-text.text-xs-center
    div(v-if="itemId" ref="plotly")
    v-icon(v-if="!itemId" large) input
</template>

<script>
import Plotly from 'plotly.js-basic-dist-min';

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
      name: '',
      range: [],
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
        this.react();
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
        return {img, name: img.name};
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
          const img = this.rows[i - 1].img;
          this.name = img.name;
          this.loadedImages.push({
            timestep: i,
            data: img.data,
            layout: img.layout,
            range: [Math.min(...img.data[0].y), Math.max(...img.data[0].y)],
          });
          if (this.loadedImages.length == 1) {
            this.react();
          }
        }
      }

      // Reduce memory footprint by only keeping ten images per gallery.
      if (this.loadedImages.length > 10) {
        this.loadedImages = this.loadedImages.slice(-10);
      }

      // Report this gallery as ready if we didn't need to load any new images.
      if (!any_images_loaded && this.pendingImages == 0) {
        this.$parent.$parent.$parent.$parent.$emit("gallery-ready");
      }
    },

    react: function () {
      for (var idx in this.loadedImages) {
        if (this.loadedImages[idx].timestep == this.step) {
          Plotly.react(this.$refs.plotly, this.loadedImages[idx].data, this.loadedImages[idx].layout);
          this.$parent.$parent.$parent.$parent.$emit("gallery-ready");
        }
      }
    },
  },
};
</script>

<style lang="scss" type="text/scss">
    @import '../scss/gallery.scss';
</style>
