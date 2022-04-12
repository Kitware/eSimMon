import RangeDialog from '../RangeDialog';
import { mapGetters, mapMutations } from 'vuex';

export default {
  name: 'ContextMenu',
  inject: ['girderRest', 'fastRestUrl'],

  components: {
    RangeDialog,
  },

  data () {
    return {
      showRangeDialog: false,
    };
  },

  computed: {
    ...mapGetters({
      visible: 'UI_SHOW_CONTEXT_MENU',
      itemInfo: 'UI_CONTEXT_MENU_ITEM_DATA',
      zoom: 'PLOT_ZOOM',
    }),
    showMenu: {
      get() {
        return this.visible;
      },
      set(value) {
        this.showContextMenu(value);
      },
    },
    pos() {
      if (this.itemInfo) {
        return [this.itemInfo.event.clientX, this.itemInfo.event.clientY];
      }
      return [0, 0];
    },
    parameter() {
      return this.itemInfo ? this.itemInfo.name : '';
    },
  },

  methods: {
    ...mapMutations({
      showContextMenu: 'UI_SHOW_CONTEXT_MENU_SET',
    }),
    fetchImage(format) {
      const { id, step } = this.itemInfo;
      const endpoint = `images/${id}/timesteps/${step}/format/${format}`;
      this.downloadData(endpoint, format);
    },
    fetchMovie(format) {
      this.movieRequested = true;
      const { id } = this.itemInfo;
      const endpoint = `movie/${id}/format/${format}`;
      this.downloadData(endpoint, format);
    },
    downloadData(endpoint, format) {
      const { name } = this.itemInfo;
      const zoom = this.zoom ? `?zoom=${JSON.stringify(this.zoom)}` : '';
      this.girderRest.get(
        `${this.fastRestUrl}/${endpoint}${zoom}`, {responseType: 'blob'}
      ).then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${name}.${format}`);
        document.body.appendChild(link);
        link.click();
      });
    },
  },
}
