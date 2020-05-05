<template>
<v-card vertical-center
        v-on:drop="loadGallery($event)"
        v-on:dragover="preventDefault($event)">
  <v-card-text v-bind:class="[!json ? 'text-xs-end' : 'text-xs-center']"
               @contextmenu.prevent="fetchMovie">
    <div v-if="itemId"
         ref="plotly"
         class="plot"/>
    <img v-if="itemId && !json"
        ref="img"
        :src="image.src"
        class="plot" />
    <v-icon v-if="!itemId" large> input </v-icon>
  </v-card-text>
</v-card>
</template>

<script>
import Plotly from 'plotly.js-basic-dist-min';

export default {
  name: "plotly",

  props: {
    currentTimeStep: {
      type: Number,
      required: true
    },
    maxTimeStep: {
      type: Number,
      required: true
    },
    numrows: {
      type: Number,
      required: true
    },
    numcols: {
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
      step: 1,
      json: true,
      image: null,
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
        if (this.currentTimeStep >= 1)
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
    numrows: {
      immediate: true,
      handler() {
        this.react();
      }
    },
    numcols: {
      immediate: true,
      handler() {
        this.react();
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
        let info =  await this.callEndpoint(`file/${val._id}`);
        if (info.exts[0] == 'json') {
          let img = await this.callEndpoint(
            `file/${val._id}/download?contentDisposition=inline`);
          return {'img': img, 'ext': info.exts[0]};
        } else {
          return {
            'img': this.girderRest.apiRoot + "/file/" + val._id + "/download?contentDisposition=inline",
            'ext': info.exts[0]
          }
        }
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
      this.itemId = items[0]._id;
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
          const ext = this.rows[i - 1].ext;
          if (ext == 'json') {
            this.loadedImages.push({
              timestep: i,
              data: img.data,
              layout: img.layout,
              ext: ext,
            });
          } else {
            this.loadedImages.push({timestep: i, src: img, ext: ext});
          }
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
          if (this.loadedImages[idx].ext == 'json') {
            Plotly.react(this.$refs.plotly, this.loadedImages[idx].data, this.loadedImages[idx].layout, {autosize: true});
            if (!this.json) {
              this.json = true;
            }
          } else {
            if (this.json) {
              this.json = false;
            }
            this.image = this.loadedImages[idx];
          }
          this.$parent.$parent.$parent.$parent.$emit("gallery-ready");
        }
      }
    },

    async fetchMovie(e) {
      if (this.json)
        return;
      const response = await this.callEndpoint(`item/${this.itemId}`);
      this.$parent.$parent.$parent.$parent.$emit("param-selected", this.itemId, response.name, e);
    },
  },
};
</script>

<style lang="scss" type="text/scss">
    @import '../scss/gallery.scss';
</style>
