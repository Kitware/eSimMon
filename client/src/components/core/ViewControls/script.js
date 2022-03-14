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
      viewInfo: {},
      views: []
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
    lastSaved: {
      type: String,
      default: '',
    },
    step: {
      type: Number,
      default: 1,
    },
    simulation: {
      type: String,
      default: '',
    },
    run: {
      type: String,
      default: '',
    },
  },

  created: async function () {
    this.$on('views-modified', this.getViews);
  },

  methods: {
    async getViews() {
      await this.girderRest.get('/view')
        .then(({ data }) => {
          this.views = data;
          this.viewInfo = {};
          data.forEach((view) => {
            if (this.viewCreatedByUser(view)) {
              this.viewInfo[view.name] = view._id;
            }
          });
        })
        .catch((error) => {
          console.log('Could not fetch views: ', error);
        });
    },
    async saveView() {
      await this.getViews();
      this.showSaveDialog = true;
      this.$root.$children[0].$emit("pause-gallery");
    },
    async loadView() {
      await this.getViews();
      this.showLoadDialog = true;
    },
    viewCreatedByUser(item) {
      return this.girderRest.user._id === item.creatorId;
    }
  },

  computed: {
    meta() {
      return { simulation: this.simulation, run: this.run };
    }
  },
};