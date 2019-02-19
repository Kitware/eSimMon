<template lang="pug">
v-app.app
  v-toolbar
    v-toolbar-title Controls
    v-spacer
    v-toolbar-items
      v-layout.pt-3(row, align-center, justify-center)
      v-btn(flat, icon, @click="girderRest.logout()")
        v-icon $vuetify.icons.logout
  v-dialog(:value="loggedOut", persistent, full-width, max-width="600px")
    girder-auth(
        :register="true",
        :oauth="false",
        :forgot-password-url="forgotPasswordUrl")
  v-container(v-show="!loggedOut")
    h4.display-1.pb-3(v-if="item", :item.sync="item") {{item.name}}
    v-card
      image-gallery(ref="girderBrowser",
          v-if="itemId",
          :itemId.sync="itemId",
          )
</template>

<script>
import ImageGallery from './components/ImageGallery.vue'
import {Authentication as GirderAuth} from '@girder/components/src/components';

export default {
  name: 'App',
  inject: ['girderRest'],
  components: {
    ImageGallery,
    GirderAuth
  },
  data() {
    return {
      multiple: true,
      uploader: false,
      newFolder: false,
      browserLocation: null,
      forgotPasswordUrl: '/#?dialog=resetpassword',
      item: null,
    };
  },
  asyncComputed: {
    async get() {
      const endpoint = `item/${this.itemId}`;
      const response = await this.girderRest.get(endpoint);
      this.item = response.data;
    }
  },
  computed: {
    itemId: {
      get() {
        return '5c5b45a38d777f072b2fd21d';
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

<style lang="scss">
.app {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
