<script>
import {
  DataBrowser as GirderDataBrowser,
  Breadcrumb as GirderBreadcrumb,
} from '@girder/components/src/components';
import {
  getLocationType,
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
      model: '',
      allItems: [],
      filteredItems: [],
      loading: false,
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
        this.allItems = [];
        this.$emit('update:location', newVal);
        this.filterResults();
      },
    },
  },
  created() {
    if (!createLocationValidator(!this.rootLocationDisabled)(this.internalLocation)) {
      throw new Error('root location cannot be used when root-location-disabled is true');
    }
    this.filterResults();
  },
  methods: {
    isRootLocation,
    refresh() {
      this.$refs.girderBrowser.refresh();
    },
    async getResults(folderId) {
      var details = await this.girderRest.get(`folder/${folderId}/details`);
      if (details.data.nItems > 0) {
        var items = await this.girderRest
          .get(`/item?folderId=${folderId}&sort=lowerName&sortdir=1`);
        items.data.forEach(async item => {
          var { data } = await this.girderRest
            .get(`/resource/${item._id}/path?type=item`);
          var path = data.split(this.currentFolder + '/')[1];
          this.allItems.push(path.substring(path.indexOf('/')+1));
        });
      }
      if (details.data.nFolders > 0) {
        var folders = await this.girderRest
          .get(`/folder?parentType=folder&parentId=${folderId}&sort=lowerName&sortdir=1`);
        for (var idx in folders.data) {
          await this.getResults(folders.data[idx]._id);
        }
      }
    },
    async filterResults() {
      let { data } = await this.girderRest.get(`/${this.location._modelType}/${this.location._id}`);
      this.currentFolder = data.name;
      this.loading = true;
      await this.getResults(this.location._id);
      this.loading = false;
      this.filteredItems = await this.allItems.filter(item => {return item.includes(this.model)});
    },
    submitSearch() {
      return;
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
            ref="model"
            v-model="model"
            :items="allItems"
            clearable
            dense
            solo
            placeholder="Search for Parameter"
            @click:append-outer="submitSearch"
            :append-outer-icon=" 'search' " />
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
