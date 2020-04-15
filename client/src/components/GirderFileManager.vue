<script>
import GirderDataBrowser from './GirderDataBrowser.vue';
import {
  Breadcrumb as GirderBreadcrumb,
} from '@girder/components/src/components';
import {
  isRootLocation,
  createLocationValidator,
} from '@girder/components/src/utils';
export default {
  components: {
    GirderBreadcrumb,
    GirderDataBrowser,
  },
  props: {
    value: {
      type: Array,
      default: () => [],
    },
    location: {
      type: Object,
      validator: createLocationValidator(true),
      default: null,
    },
    rootLocationDisabled: {
      type: Boolean,
      default: false,
    },
    selectable: {
      type: Boolean,
      default: false,
    },
    dragEnabled: {
      type: Boolean,
      default: false,
    },
    initialItemsPerPage: {
      type: Number,
      default: 10,
    },
    itemsPerPageOptions: {
      type: Array,
      default: () => ([10, 25, 50]),
    },
  },
  inject: ['girderRest'],
  data() {
    return {
      lazyLocation: null,
      previousLocation: null,
      query: null,
      allItems: [],
      filteredItems: [],
      input: '',
    };
  },
  computed: {
    internalLocation: {
      get() {
        const { location, lazyLocation } = this;
        if (location) {
          return location;
        } if (lazyLocation) {
          return lazyLocation;
        }
        return { type: 'root' };
      },
      set(newVal) {
        this.lazyLocation = newVal;
        this.$emit('update:location', newVal);
        this.filterResults();
      },
    },
    queryValues: {
      get () {
        if (this.query)
          return [this.query.value];
        return [];
      }
    },
  },
  async created() {
    if (!createLocationValidator(!this.rootLocationDisabled)(this.internalLocation)) {
      throw new Error('root location cannot be used when root-location-disabled is true');
    }
    await this.setCurrentPath();
    await this.getAllResults(this.location._id);
    this.filteredItems = this.allItems;
  },
  watch: {
    async query() {
      if (this.query) {
        let { data } = await this.girderRest.get(`/folder/${this.query.value.folderId}`);
        this.previousLocation = this.lazyLocation;
        this.internalLocation = data;
      }
    },
  },
  methods: {
    isRootLocation,
    refresh() {
      this.$refs.girderBrowser.refresh();
    },
    async setCurrentPath(){
      var location = this.lazyLocation;
      if (!this.lazyLocation) {
        location = this.location;
      }
      let { data } = await this.girderRest.get(
        `/resource/${location._id}/path?type=${location._modelType}`);
      this.currentPath = data;
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
      this.filteredItems = this.allItems.filter(item => {
        if (item.fullPath.includes(this.currentPath)) {
          item.text = item.fullPath.split(this.currentPath + '/')[1];
          return item;
        }
      });
    },
    clear() {
      if (this.query) {
        this.internalLocation = this.previousLocation;
        this.previousLocation = null;
      }
    },
  },
};
</script>

<template>
  <v-card class="girder-data-browser-snippet">
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
        <v-autocomplete
            ref="query"
            v-model="query"
            :items="filteredItems"
            :append-outer-icon=" 'search' "
            :search.input.sync="input"
            placeholder="Search for Parameter"
            return-object
            clearable
            dense
            solo
            @click:clear="clear"/>
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
