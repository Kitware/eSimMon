  <!-- This component extends the DataBrowser component in order to display a
  filtered list of items when a search is being performed. -->

<script>
import { DataBrowser as GirderDataBrowser } from '@girder/components/src/components';
import {
  getLocationType,
  getSingularLocationTypeName
} from '@girder/components/src/utils';

export default {
  mixins: [GirderDataBrowser],

  inject: ['girderRest'],

  props: {
    query: {
      type: Array,
      default: () => [],
    },
  },

  methods: {
    fetchPaginatedRows() {
      if (this.query.length) {
        return this.query;
      }
      const { location, counts } = this;
      if (counts.nFolders || counts.nItems) {
        return this.fetchPaginatedFolderRows();
      }
      const locationType = getLocationType(location);
      if (locationType === 'users' || locationType === 'collections') {
        if (counts.nUsers || counts.nCollections) {
          const singularType = getSingularLocationTypeName(location);
          return this.fetchPaginatedCollectionOrUserRows(singularType);
        }
      } else if (locationType === 'root') {
        return this.generateRootRows();
      }
      return [];
    }
  }
};
</script>
