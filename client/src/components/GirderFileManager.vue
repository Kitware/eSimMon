<!-- This component extends the FileManager component in order to provide a
search bar and to collect and filter parameter options. -->

<script>
import { FileManager as GirderFileManager } from '@girder/components/src/components/Snippet';
import GirderDataBrowser from './GirderDataBrowser.vue';
import {
  Breadcrumb as GirderBreadcrumb,
} from '@girder/components/src/components';
export default {
  components: {
    GirderBreadcrumb,
    GirderDataBrowser,
  },

  mixins: [GirderFileManager],

  inject: ['girderRest'],

  data() {
    return {
      query: null,
      allItems: [],
      filteredItems: [],
      input: '',
      showPartials: false,
      root: null,
      outsideOfRoot: false,
    };
  },

  computed: {
    queryValues: {
      get () {
        if (this.query && this.query.hasOwnProperty('value') && !this.showPartials) {
          return [this.query.value];
        }
        else if (this.showPartials) {
          let values = this.filteredItems
            .filter(item => {
              return item.value.name.includes(this.input ? this.input : '');
            })
            .map(item => { return {...item.value, 'name': item.text}; });
            if (!this.input)
              this.$refs.query.blur();
            return values;
          }
        return [];
      }
    },
  },

  async created() {
    await this.setCurrentPath();
    await this.getAllResults(this.location._id);
    this.filteredItems = this.allItems;
  },

  watch: {
    async query() {
      if (this.input === '' || this.input && !typeof(this.query) == 'object'){
        this.showPartials = true;
      } else if (typeof(this.query) == 'object') {
        this.showPartials = false;
      }
      this.refresh();
      if (!this.showPartials && typeof(this.query) == 'object') {
        let { data } = await this.girderRest.get(`/folder/${this.query.value.folderId}`);
        this.internalLocation = {...data, 'search': true};
      }
    },
    showPartials() {
      this.refresh();
    },
    input() {
      if (this.input == '') {
        this.clear();
      }
    },
    internalLocation() {
      if (!this.lazyLocation.hasOwnProperty('search')) {
        this.clear();
      }
      this.filterResults();
    }
  },

  methods: {
    async setCurrentPath(){
      var location = this.lazyLocation ? this.lazyLocation : this.location;

      this.currentPath = '';
      if (location.hasOwnProperty('_id')) {
        let { data } = await this.girderRest.get(
          `/resource/${location._id}/path?type=${location._modelType}`);
        this.currentPath = data;
      }

      if (!this.root) {
        this.root = this.currentPath;
      } else {
        if (!this.outsideOfRoot && !this.currentPath.includes(this.root)) {
          this.outsideOfRoot = true;
        } else if (this.outsideOfRoot && this.currentPath.includes(this.root)) {
          this.outsideOfRoot = false;
        }
      }
    },
    async getAllResults(folderId) {
      var details = await this.girderRest.get(`folder/${folderId}/details`);
      if (details.data.nItems > 0) {
        var items = await this.girderRest
          .get(`/item?folderId=${folderId}&sort=lowerName&sortdir=1`);
        items.data.forEach(async item => {
          var { data } = await this.girderRest
            .get(`/resource/${item._id}/path?type=item`);
          this.allItems.push({
            'text': data.split(this.currentPath + '/')[1],
            'value': item,
            'fullPath': data
          });
        });
      }
      if (details.data.nFolders > 0) {
        var folders = await this.girderRest
          .get(`/folder?parentType=folder&parentId=${folderId}&sort=lowerName&sortdir=1`);
        for (var idx in folders.data) {
          await this.getAllResults(folders.data[idx]._id);
        }
      }
    },
    async filterResults() {
      await this.setCurrentPath();
      if (this.outsideOfRoot)
        return;

      this.filteredItems = this.allItems.filter(item => {
        if (item.fullPath.includes(this.currentPath)) {
          item.text = item.fullPath.split(this.currentPath + '/')[1];
          return item;
        }
      });
    },
    clear() {
      this.showPartials = false;
      this.query = null;
      this.input = '';
      this.refresh();
    },
    showMatches() {
      if (this.query == this.input) {
        this.showPartials = true;
      }
      if (this.$refs.query.isMenuActive) {
        this.$refs.query.blur();
      }
    },
    async fetchMovie(e) {
      let name = e.target.textContent.trim();
      var item = await this.girderRest.get(`/item?folderId=${this.location._id}&name=${name}`);
      this.$parent.$parent.$parent.$parent.$emit("param-selected", item.data[0]._id, name, e);
    },
  },
};
</script>

<template>
  <v-card class="girder-data-browser-snippet"
          @contextmenu.prevent="fetchMovie">
    <girder-data-browser
      ref="girderBrowser"
      :location.sync="internalLocation"
      :selectable="selectable"
      :draggable="dragEnabled"
      :root-location-disabled="rootLocationDisabled"
      :value="value"
      :initial-items-per-page="initialItemsPerPage"
      :items-per-page-options="itemsPerPageOptions"
      :query="queryValues"
      @input="$emit('input', $event)"
      @selection-changed="$emit('selection-changed', $event)"
      @rowclick="$emit('rowclick', $event)"
      @drag="$emit('drag', $event)"
      @dragstart="$emit('dragstart', $event)"
      @dragend="$emit('dragend', $event)"
      @drop="$emit('drop', $event)"
    >
      <template #breadcrumb="props">
        <girder-breadcrumb
          :location="props.location"
          :root-location-disabled="props.rootLocationDisabled"
          @crumbclick="props.changeLocation($event)"
        />
      </template>
      <template #headerwidget="props">
        <slot name="headerwidget" />
        <v-combobox
            ref="query"
            v-model="query"
            :items="filteredItems"
            :append-icon=" 'clear' "
            :append-outer-icon=" 'search' "
            :search-input.sync="input"
            placeholder="Search for Parameter"
            return-object
            dense
            solo
            @click:append="clear"
            @click:append-outer="showMatches"
            @keyup.enter="showMatches"
            @keyup.esc="$refs.query.blur()"
            v-bind:class="[outsideOfRoot ? 'hide-search' : '']">
          <template v-slot:no-data>
            <v-list-item dense v-bind:style="{fontSize: '0.8rem'}">
              No Matches Found
            </v-list-item>
          </template>
        </v-combobox>
      </template>
      <template #row-widget="props">
        <slot
          v-bind="props"
          name="row-widget"
        />
      </template>
    </girder-data-browser>
  </v-card>
</template>
