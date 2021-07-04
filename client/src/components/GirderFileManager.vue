<!-- This component extends the FileManager component in order to provide a
search bar and to collect and filter parameter options. -->

<script>
import _ from 'lodash';
import { GirderBreadcrumb, GirderFileManager } from '@girder/components/src';
import GirderDataBrowser from './GirderDataBrowser.vue';
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
        if (this.query && _.has(this.query, 'value') && !this.showPartials) {
          return [this.query.value];
        }
        else if (this.showPartials && this.filteredItems) {
          let values = this.filteredItems.map(item => {
            return {...item.value, 'name': item.text};
          });
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
  },

  watch: {
    async query() {
      if (this.$refs.query.isFocused && !(_.isObject(this.query))){
        this.showPartials = true;
      } else if (_.isObject(this.query)) {
        this.showPartials = false;
      }
      this.refresh();
      if (!this.showPartials && _.isObject(this.query)) {
        let { data } = await this.girderRest.get(
          `/folder/${this.query.value.folderId}`);
        this.internalLocation = {...data, 'search': true};
      }
    },
    showPartials() {
      this.refresh();
    },
    input() {
      if (_.isEmpty(this.input)) {
        this.clear();
      }
    },
    internalLocation() {
      if (!('serach' in this.lazyLocation)) {
        this.clear();
      }
      this.setCurrentPath();
      this.getFilteredResults();
    }
  },

  methods: {
    async setCurrentPath(){
      var location = this.lazyLocation ? this.lazyLocation : this.location;

      this.currentPath = '';
      if (_.has(location, '_id')) {
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
    clear() {
      this.showPartials = false;
      this.query = null;
      this.input = '';
      this.refresh();
    },
    showMatches() {
      if (_.isEqual(this.query, this.input) ||
            (_.isNull(this.query) && _.isEmpty(this.input))) {
        this.showPartials = true;
      }
      if (this.$refs.query.isMenuActive) {
        this.$refs.query.blur();
      }
    },
    async fetchMovie(e) {
      let name = e.target.textContent.trim();
      var item = await this.girderRest.get(
        `/item?folderId=${this.location._id}&name=${name}`);
      let files = await this.girderRest.get(`/item/${item.data[0]._id}/files`);
      if (files.data[0]['exts'] == 'json')
        return;
      this.$parent.$parent.$parent.$parent.$emit(
        "param-selected", item.data[0]._id, name, e);
    },
    getFilteredResults:  _.debounce(async function() {
      if (this.outsideOfRoot)
        return;

      let input = this.input ? this.input : '';
      let { data } = await this.girderRest.get(
        `resource/${this.location._id}/search?type=folder&q=${input}`);
      this.filteredItems = data.results;
    }, 500),
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
      <template #headerwidget>
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
            @update:search-input="getFilteredResults"
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
