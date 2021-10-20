import SaveDialog from '../../widgets/SaveDialog';
import LoadDialog from '../../widgets/LoadDialog';

export default {
  inject: ['girderRest'],

  components: {
    SaveDialog,
    LoadDialog
  },

  data() {
    return {
      showSaveDialog: false,
      showLoadDialog: false,
      viewNames: [],
    };
  },

  props: {
    imageGallery: {
      type: Array,
      default: () => [],
    },
    numrows: {
      type: Number,
      default: 1,
    },
    numcols: {
      type: Number,
      default: 1,
    },
  },

  methods: {
    async getViews() {
      await this.girderRest.get('/view')
        .then(({ data }) => {
          this.views = data;
          this.viewNames = [];
          data.forEach((view) => {
            this.viewNames.push(view.name);
          });
        })
        .catch((error) => {
          console.log('Could not fetch views: ', error);
        });
    },
    
    async saveView() {
      await this.getViews();
      this.showSaveDialog = true;
    },
    
    async loadView() {
      await this.getViews();
      this.showLoadDialog = true;
    },    
  },
};