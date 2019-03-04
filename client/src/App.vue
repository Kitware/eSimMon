<template lang="pug">
v-app.app
  v-toolbar
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
          :key="itemId")
      girder-data-browser(ref="girderBrowser",
          v-if="location",
          v-on:itemclick="setItem",
          :location.sync="location",
          :select-enabled="selectEnabled",
          :new-item-enabled="newItemEnabled",
          :new-folder-enabled="newFolderEnabled")
</template>

<script>
import ImageGallery from './components/ImageGallery.vue'
import {
  Authentication as GirderAuth,
  DataBrowser as GirderDataBrowser,
} from '@girder/components/src/components';

export default {
  name: 'App',
  inject: ['girderRest'],
  components: {
    GirderAuth,
    GirderDataBrowser,
    ImageGallery,
  },
  data() {
    return {
      browserLocation: null,
      forgotPasswordUrl: '/#?dialog=resetpassword',
      item: null,
      itemId: null,
      selectEnabled: false,
      newItemEnabled: false,
      newFolderEnabled: false,
    };
  },
  asyncComputed: {
    async get() {
      if (this.itemId) {
        const endpoint = `item/${this.itemId}`;
        const response = await this.girderRest.get(endpoint);
        this.item = response.data;
      }
    }
  },
  computed: {
    location: {
      get() {
        if (this.browserLocation) {
          return this.browserLocation;
        } else if (this.girderRest.user) {
          return { _modelType: 'collection', _id: '5c5b42678d777f072b2f955c' };
        }
        return null;
      },
      set(newVal) {
        this.browserLocation = newVal;
      },
    },
    loggedOut() {
      return this.girderRest.user === null;
    },
  },
  methods: {
    setItem: function (item) {
      this.itemId = item._id;
    }
  }
};
</script>
