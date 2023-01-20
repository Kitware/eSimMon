/* This component extends the DataBrowser component in order to display a
filtered list of items when a search is being performed. */

import { GirderDataBrowser } from "@girder/components/src";
import {
  getLocationType,
  getSingularLocationTypeName,
} from "@girder/components/src/utils";
import GirderDataTable from "../GirderDataTable";

export default {
  components: {
    GirderDataTable,
  },

  mixins: [GirderDataBrowser],

  inject: ["girderRest"],

  props: {
    query: {
      type: Array,
      default: () => [],
    },
  },

  computed: {
    serverItemsLength() {
      if (this.query.length) {
        return this.query.length;
      } else {
        return Object.values(this.counts).reduce(
          (total, value) => total + value,
          0,
        );
      }
    },
  },

  methods: {
    refresh() {
      this.selected = [];
      this.internalRefreshCounter += 1;
      this.options.page = 1;
    },
    rowClick(row) {
      this.$emit("rowclick", row, this.location);

      // If the row is not an item, call changeLocation
      const locationType = getLocationType(row);
      if (locationType && locationType !== "item") {
        this.changeLocation(row);
      }
    },
    fetchPaginatedRows() {
      if (this.query.length) {
        const {
          options: { page, itemsPerPage },
        } = this;
        const itemOffset = itemsPerPage === -1 ? 0 : (page - 1) * itemsPerPage;

        const limit =
          (itemsPerPage === -1 ? this.query.length : itemsPerPage) + itemOffset;
        return this.query.slice(itemOffset, limit);
      }
      const { location, counts } = this;
      if (counts.nFolders || counts.nItems) {
        return this.fetchPaginatedFolderRows().then((rows) => {
          // Filter out the internal 'timesteps'  and 'movies' folders
          return rows.filter((folder) => {
            return folder.name !== "timesteps" && folder.name !== "movies";
          });
        });
      }
      const locationType = getLocationType(location);
      if (locationType === "users" || locationType === "collections") {
        if (counts.nUsers || counts.nCollections) {
          const singularType = getSingularLocationTypeName(location);
          return this.fetchPaginatedCollectionOrUserRows(singularType);
        }
      } else if (locationType === "root") {
        return this.generateRootRows();
      }
      return [];
    },
  },

  mounted() {
    this.options.itemsPerPage = -1;
  },
};
