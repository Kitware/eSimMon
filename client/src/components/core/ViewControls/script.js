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
    }),
    ...mapMutations({
      setPaused: 'UI_PAUSE_GALLERY_SET',
      setLoadDialogVisible: 'UI_SHOW_LOAD_DIALOG_SET',
      setSaveDialogVisible: 'UI_SHOW_SAVE_DIALOG_SET',
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
};
