<template lang="pug">
div.gallery
  div.slide(v-for="row in rows")
    img(v-bind:data-lazy="row.img")
    p {{row.name}}
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
      rows: [],
      galleryRendered: false,
    };
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

  updated () {
    if (this.rows.length < 1) {
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
      lazyLoad: 'progressive',
      speed: 0
    });
    this.galleryRendered = true;
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
