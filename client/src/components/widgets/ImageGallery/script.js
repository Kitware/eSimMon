import Plotly from 'plotly.js-basic-dist-min';
import { isNil, isEqual } from 'lodash';

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
    globalRanges: {
      type: Object,
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
        let name = info.name.split('.');
        if (name[1] == 'json') {
          let img = await this.callEndpoint(
            `file/${val._id}/download?contentDisposition=inline`);
          return {'img': img, 'step': parseInt(name[0], 10), 'ext': name[1]};
        } else {
          return {
            'img': this.girderRest.apiRoot + "/file/" + val._id + "/download?contentDisposition=inline",
            'step': parseInt(name[0], 10),
            'ext': name[1]
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
      this.$root.$children[0].$emit('item-added', this.itemId);
    },

    preCacheImages: function () {
      // Return early if we haven't loaded the list of images from Girder yet.
      if (this.rows === null || this.rows.constructor !== Array || this.rows.length < 1) {
        return;
      }
      // Find index of current time step
      let idx = this.rows.findIndex(file => file.step === this.step);
      if (idx < 0) {
        let prevStep = this.step - 1;
        while (prevStep > 0 && idx < 0) {
          idx = this.rows.findIndex(file => file.step === prevStep);
          prevStep -= 1;
        }
        let nextStep = this.step + 1;
        while (nextStep <= this.maxTimeStep && idx < 0) {
          idx = this.rows.findIndex(file => file.step === nextStep);
          nextStep += 1;
        }
      }
      // Load the current image and the next two.
      var any_images_loaded = false;
      for (var i = idx + 1; i < idx + 3; i++) {
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
          const step = this.rows[i - 1].step;
          if (ext == 'json') {
            this.loadedImages.push({
              timestep: step,
              data: img.data,
              layout: img.layout,
              ext: ext,
            });
          } else {
            this.loadedImages.push({timestep: step, src: img, ext: ext});
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
      let nextImage = this.loadedImages.find(img => img.timestep == this.step);
      if (isNil(nextImage) && this.loadedImages.length == 1)
        nextImage = this.loadedImages[0];
      if (!isNil(nextImage)) {
        if (isEqual(nextImage.ext, 'json')) {
          nextImage.layout.yaxis.autorange = true;
          if (this.itemId in this.globalRanges) {
            const range = this.globalRanges[`${this.itemId}`];
            if (range) {
              nextImage.layout.yaxis.autorange = false;
              nextImage.layout.yaxis.range = range;
            }
          }
          Plotly.react(this.$refs.plotly, nextImage.data, nextImage.layout, {autosize: true});
          this.json = true;
        } else {
          this.json = false;
          this.image = nextImage;
        }
      }
      this.$parent.$parent.$parent.$parent.$emit("gallery-ready");
    },

    async fetchMovie(e) {
      const response = await this.callEndpoint(`item/${this.itemId}`);
      const data = {
        id: this.itemId,
        name: response.name,
        event: e,
        isJson: this.json,
      }
      this.$parent.$parent.$parent.$parent.$emit("param-selected", data);
    },

    clearGallery() {
      this.itemId = null;
      this.pendingImages = 0;
      this.json = true;
      this.image = null;
      this.initialLoad = true;
    },
  },

  mounted() {
    this.$root.$children[0].$emit('gallery-count-changed', 1);
  },

  destroyed() {
    this.$root.$children[0].$emit('gallery-count-changed', -1);
  }
};
