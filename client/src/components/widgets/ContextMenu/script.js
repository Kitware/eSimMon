import axios from 'axios';
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
    downloadImage(format) {
      const endpoint = `images/${this.itemInfo.id}/timesteps/${this.itemInfo.step}/format/${format}`;
      console.log(this.itemInfo.id, this.itemInfo.step, format)
      this.girderRest.get(
        `${this.fastRestUrl}/${endpoint}`, {responseType: 'blob'}
      ).then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${this.itemInfo.name}.${format}`);
        document.body.appendChild(link);
        link.click();
      });
    },
    fetchMovie() {
      let name = this.parameter;
      this.movieRequested = true;
      axios({
        url: `${this.fastRestUrl}/movie/${this.itemId}`,
        method: 'GET',
        headers: { 'girderToken': this.girderRest.token },
        responseType: 'blob'
      }).then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${name}.mp4`);
        document.body.appendChild(link);
        link.click();
      }).catch(() => {
        this.generationFailed = true;
      });
    },
  },
}
