<template lang="pug">
v-card.vertical-center(height="100%"
                       v-on:drop="loadGallery($event)"
                       v-on:dragover="preventDefault($event)")
  v-card-text.text-xs-center
    div(v-if="itemId")
      v-img(v-for="image in loadedImages"
            v-show="image.timestep == step"
            :key="image.timestep"
            :src="image.src"
            contain=true)
    v-icon(v-if="!itemId" large) input
</template>

<script>
export default {
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
      bleedingEdge: false,
      initialLoad: true,
      itemId: null,
      loadedImages: [],
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
        this.bleedingEdge = (this.currentTimeStep == this.maxTimeStep);
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
        if (this.bleedingEdge) {
          this.step = this.maxTimeStep;
        }
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
      const response = await this.girderRest.get(endpoint);

      this.rows = response.data.map(function(val) {
        return {
          img: this.girderRest.apiRoot + "/file/" + val._id + "/download?contentDisposition=inline",
          name: val.name
        };
      }, this);

      this.preCacheImages();

      if (this.initialLoad) {
        // Not sure why this level of parent chaining is required
        // to get the app to be able to hear the event.
        this.$parent.$parent.$emit("data-loaded", this.rows.length, this.itemId);
        this.initialLoad = false;
      }
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
      for (var i = this.step; i < this.step + 3; i++) {
        if (i > this.maxTimeStep || i >= this.rows.length) {
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
          this.loadedImages.push({timestep: i, src: this.rows[i].img});
        }
      }
    },
  },
};
</script>

<style lang="scss" type="text/scss">
    @import '../scss/gallery.scss';
</style>
