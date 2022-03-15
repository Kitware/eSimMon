import SaveDialog from '../../widgets/SaveDialog';
import LoadDialog from '../../widgets/LoadDialog';
import { mapActions, mapGetters, mapMutations } from 'vuex';

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
      zoomSync: 0,
    };
  },

  props: {
    imageGallery: {
      type: Array,
      default: () => [],
    },
  },

  methods: {
    ...mapActions({
      fetchAllViews: 'VIEW_FETCH_ALL_AVAILABLE',
      toggleSyncZoom: 'UI_TOGGLE_ZOOM_SYNC',
    }),
    ...mapMutations({
      setPaused: 'UI_PAUSE_GALLERY_SET',
      setLoadDialogVisible: 'UI_SHOW_LOAD_DIALOG_SET',
      setSaveDialogVisible: 'UI_SHOW_SAVE_DIALOG_SET',
      setZoomOrigin: 'PLOT_ZOOM_ORIGIN_SET',
    }),
    async saveView() {
      await this.fetchAllViews();
      this.setSaveDialogVisible(true);
      this.setPaused(true);
    },
    async loadView() {
      await this.fetchAllViews();
      this.setLoadDialogVisible(true);
    },
  },

  computed: {
    ...mapGetters({
      lastSaved: 'VIEW_LAST_SAVED',
      numcols: 'VIEW_COLUMNS',
      numrows: 'VIEW_ROWS',
      run: 'VIEW_RUN_ID',
      simulation: 'VIEW_SIMULATION',
      step: 'PLOT_TIME_STEP',
    }),
  },

  watch: {
    zoomSync(selected) {
      this.toggleSyncZoom();
      if(!selected) {
        this.setZoomOrigin(null);
      }
    }
  },
};
