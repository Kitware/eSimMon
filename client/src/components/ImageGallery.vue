<template lang="pug">
v-card.vertical-center(
       height="300px" min-height="300px"
       width="300px"  min-width="300px"
       v-on:drop="loadGallery($event)"
       v-on:dragover="preventDefault($event)")
  v-card-title(v-if="item") {{item.name}}
  v-card-text.text-xs-center
    div(v-if="itemId")
      div(v-bind:class="'gallery-' + uid")
        div.slide(v-for="row in rows")
          img(v-bind:data-lazy="row.img")
          p {{row.name}}
    v-icon(v-if="!itemId" large) input
</template>

<script>
import JQuery from 'jquery'
let $ = JQuery
import('slick-carousel');

export default {
  props: {
    currentTimeStep: {
      type: Number,
      required: true
    },

    uid: {
      type: String,
      required: true
    },
  },

  inject: ['girderRest'],

  data() {
    return {
      item: null,
      itemId: null,
      itemIdChanged: true,
      galleryRendered: false,
      rows: [],
    };
  },

  asyncComputed: {
    rows: {
      default: [],
      async get() {
        if (!this.itemId) {
          return [];
        }
        const endpoint = `item/${this.itemId}/files?limit=0`;
        const response = await this.girderRest.get(endpoint);
        this.rows = response.data.map(function(val) {
          return {
            img: this.girderRest.apiRoot + "/file/" + val._id + "/download?contentDisposition=inline",
            name: val.name
          };
        }, this);
        // Not sure why this level of parent chaining is required
        // to get the app to be able to hear the event.
        this.$parent.$parent.$emit("data-loaded", this.rows.length);
        return this.rows;
      },
    },
  },

  watch: {
    currentTimeStep: {
      immediate: true,
      handler () {
        $(this.selector)
          .slick('slickGoTo', this.currentTimeStep, true);
      }
    },
    itemId: {
      immediate: true,
      handler () {
        this.itemIdChanged = true;
      }
    },
    uid: {
      immediate: true,
      handler () {
        this.selector = '.gallery-' + this.uid;
      },
    },
  },

  updated () {
    if (!this.itemIdChanged || this.rows.length < 1) {
      return;
    }
    if (this.galleryRendered) {
      $(this.selector).slick('unslick');
    }
    $(this.selector).slick({
      arrows: false,
      autoplay: false,
      dots: false,
      lazyLoad: 'anticipated',
    });
    this.galleryRendered = true;
    this.itemIdChanged = false;
  },

  methods: {
    preventDefault: function (event) {
      event.preventDefault();
    },

    loadGallery: function (event) {
      event.preventDefault();
      var items = JSON.parse(event.dataTransfer.getData('application/x-girder-items'));
      this.itemId = items[0];
    },
  },
};
</script>

<style lang="scss" type="text/scss">
    /** Import required slick styling. */
    @import 'slick-carousel/slick/slick.scss';

    /** Use their optional themes too, but fixup some broken paths first. */
    $slick-font-path: "~slick-carousel/slick/fonts/" !default;
    $slick-font-family: "slick" !default;
    $slick-loader-path: "~slick-carousel/slick/" !default;
    $slick-arrow-color: black !default;
    @import 'slick-carousel/slick/slick-theme.scss';

    /** Finally load our own custom styling. */
    @import '../scss/gallery.scss';
</style>
