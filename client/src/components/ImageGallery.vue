<template lang="pug">
div
  div.gallery
    div.slide(v-for="row in rows")
      img(v-bind:data-lazy="row.img")
      p {{row.name}}
  div.controls
    button(v-on:click="togglePlayPause")
      span(v-show="paused") &#9654;
      span(v-show="!paused") &#9208;
</template>

<script>
import JQuery from 'jquery'
let $ = JQuery
import('slick-carousel');

export default {
  props: {
    itemId: {
      type: String,
      required: true
    }
  },
  inject: ['girderRest'],
  data() {
    return {
      galleryRendered: false,
      itemIdChanged: true,
      paused: false,
      rows: [],
    };
  },

  methods: {
    togglePlayPause() {
      if (this.paused) {
        $('.gallery')
          .slick('slickPlay')
          .slick('slickSetOption', 'pauseOnDotsHover', true);
      } else {
        $('.gallery')
          .slick('slickPause')
          .slick('slickSetOption', 'pauseOnDotsHover', false);
      }
      this.paused = !this.paused;
    },
  },

  asyncComputed: {
    rows: {
      default: [],
      async get() {
        const endpoint = `item/${this.itemId}/files?limit=0`;
        const response = await this.girderRest.get(endpoint);
        this.rows = response.data.map(function(val) {
          return {
            img: this.girderRest.apiRoot + "/file/" + val._id + "/download?contentDisposition=inline",
            name: val.name
          };
        }, this);
        return this.rows;
      },
    },
  },

  watch: {
    itemId: {
      immediate: true,
      handler () {
        this.itemIdChanged = true;
      }
    }
  },

  updated () {
    if (!this.itemIdChanged || this.rows.length < 1) {
      return;
    }
    if (this.galleryRendered) {
      $('.gallery').slick('unslick');
    }
    $('.gallery').slick({
      autoplay: true,
      autoplaySpeed: 1000,
      dots: true,
      dotsClass: 'gallery-dots',
      lazyLoad: 'anticipated',
      pauseOnHover: false,
      pauseOnFocus: false,
      speed: 0
    });
    this.galleryRendered = true;
    this.itemIdChanged = false;
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
