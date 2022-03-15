import Plotly from 'plotly.js-basic-dist-min';
import { isNil, isEqual } from 'lodash';
import { mapGetters, mapActions, mapMutations } from 'vuex';

function parseZoomValues(data) {
  const zoomLevel = {
    xAxis: [data['xaxis.range[0]'], data['xaxis.range[1]']],
    yAxis: [data['yaxis.range[0]'], data['yaxis.range[1]']]
  }
  return zoomLevel;
}

export default {
  name: "plotly",

  props: {
    maxTimeStep: {
      type: Number,
      required: true
    },
    globalRanges: {
      type: Object,
      required: true
    },
  },

  inject: ['girderRest', 'fastRestUrl'],

  data() {
    return {
      initialLoad: true,
      itemId: null,
      loadedImages: [],
      pendingImages: 0,
      rows: [],
      json: true,
      image: null,
      eventHandlersSet: false,
      loadedFromView: false,
      zoom: null,
    };
  },

  asyncComputed: {
    ...mapGetters({
      currentTimeStep: 'PLOT_TIME_STEP',
      globalZoom: 'PLOT_ZOOM',
      numcols: 'VIEW_COLUMNS',
      numrows: 'VIEW_ROWS',
    }),

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
    ...mapActions({
      updateZoom: 'PLOT_ZOOM_VALUES_UPDATED',
    }),

    ...mapMutations({
      updateCellCount: 'PLOT_VISIBLE_CELL_COUNT_SET'
    }),

    preventDefault: function (event) {
      event.preventDefault();
    },

    loadImageUrls: async function () {
      if (!this.itemId) {
        return;
      }



      const response = await this.callFastEndpoint(`variables/${this.itemId}/timesteps`);

      this.rows = await Promise.all(response.map(async function(val) {
        let img = await this.callFastEndpoint(`variables/${this.itemId}/timesteps/${val}/plot`);

        return {'img': img, 'step': val, 'ext': 'json'};
      }, this));

      this.preCacheImages();

      if (this.initialLoad) {
        // Not sure why this level of parent chaining is required
        // to get the app to be able to hear the event.
        this.$parent.$parent.$parent.$parent.$emit(
          "data-loaded", this.rows.length, this.itemId, this.loadedFromView);
        this.initialLoad = false;
      }
    },

    callEndpoint: async function (endpoint) {
      const { data } = await this.girderRest.get(endpoint);
      return data;
    },

    callFastEndpoint: async function (endpoint) {
      const { data } = await this.girderRest.get(`${this.fastRestUrl}/${endpoint}`);
      return data;
    },

    loadGallery: function (event) {
      event.preventDefault();
      var items = JSON.parse(event.dataTransfer.getData('application/x-girder-items'));
      this.itemId = items[0]._id;
      this.loadedFromView = false;
      this.$root.$children[0].$emit('item-added', this.itemId);
    },
    loadTemplateGallery: function (item) {
      this.itemId = item.id;
      this.zoom = item.zoom;
      this.loadedFromView = true;
    },

    preCacheImages: function () {
      // Return early if we haven't loaded the list of images from Girder yet.
      if (this.rows === null || this.rows.constructor !== Array || this.rows.length < 1) {
        return;
      }
      // Find index of current time step
      let idx = this.rows.findIndex(file => file.step === this.currentTimeStep);
      if (idx < 0) {
        let prevStep = this.currentTimeStep - 1;
        while (prevStep > 0 && idx < 0) {
          idx = this.rows.findIndex(file => file.step === prevStep);
          prevStep -= 1;
        }
        let nextStep = this.currentTimeStep + 1;
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
      let nextImage = this.loadedImages.find(img => img.timestep == this.currentTimeStep);
      if (isNil(nextImage) && this.loadedImages.length == 1)
        nextImage = this.loadedImages[0];
      if (!isNil(nextImage)) {
        if (isEqual(nextImage.ext, 'json')) {
          nextImage.layout.yaxis.autorange = true;
          if (this.zoom) {
            nextImage.layout.xaxis.range = this.zoom.xAxis;
          }
          if (this.itemId in this.globalRanges) {
            const range = this.globalRanges[`${this.itemId}`];
            if (range) {
              nextImage.layout.yaxis.range = range;
            } else if(this.zoom) {
              nextImage.layout.yaxis.range = this.zoom.yAxis;
            }
          }
          Plotly.react(this.$refs.plotly, nextImage.data, nextImage.layout, {autosize: true});
          if (!this.eventHandlersSet)
            this.setEventHandlers();
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

    setEventHandlers() {
      this.$refs.plotly.on('plotly_relayout', (eventdata) => {
        this.zoom = parseZoomValues(eventdata);
      });
      this.eventHandlersSet = true;
    },
  },

  mounted () {
    this.updateCellCount(1);
  },

  destroyed() {
    this.updateCellCount(-1);
  }
};
