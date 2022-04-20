import RangeDialog from "../RangeDialog";
import { v4 as uuidv4 } from "uuid";
import { mapGetters, mapMutations } from "vuex";

// Enum values
const REQUEST = "in progress";
const COMPLETE = "complete";
const FAIL = "failed";

export default {
  name: "ContextMenu",
  inject: ["girderRest", "fastRestUrl"],

  components: {
    RangeDialog,
  },

  data() {
    return {
      showRangeDialog: false,
      downloads: [],
    };
  },

  computed: {
    ...mapGetters({
      visible: "UI_SHOW_CONTEXT_MENU",
      itemInfo: "UI_CONTEXT_MENU_ITEM_DATA",
      plotlyZoom: "PLOT_ZOOM_PLOTLY",
      vtkZoom: "PLOT_ZOOM_VTK",
      mathJaxOptions: "UI_MATH_JAX_OPTIONS",
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
      return this.itemInfo ? this.itemInfo.name : "";
    },
    downloading() {
      return this.downloads.length > 0;
    },
  },

  methods: {
    ...mapMutations({
      showContextMenu: "UI_SHOW_CONTEXT_MENU_SET",
      updateItemInfo: "UI_CONTEXT_MENU_ITEM_DATA_SET",
    }),
    fetchImage(format) {
      const { id, step } = this.itemInfo;
      const endpoint = `variables/${id}/timesteps/${step}/image?format=${format}`;
      this.downloadData(endpoint, format, "image");
    },
    fetchMovie(format) {
      const { id } = this.itemInfo;
      const endpoint = `variables/${id}/timesteps/movie?format=${format}`;
      this.downloadData(endpoint, format, "movie");
    },
    downloadData(endpoint, format, type) {
      const uuid = uuidv4();
      this.updateItemInfo({ ...this.itemInfo, uuid });
      const { name } = this.itemInfo;
      this.downloads.push({ type, uuid, name, status: REQUEST });
      let zoom = this.itemInfo.isVTK ? this.vtkZoom : this.plotlyZoom;
      zoom = zoom ? `&zoom=${JSON.stringify(zoom)}` : "";
      this.girderRest
        .get(`${this.fastRestUrl}/${endpoint}${zoom}`, { responseType: "blob" })
        .then((response) => {
          let idx = this.downloads.findIndex((d) => d.uuid === uuid);
          this.$set(this.downloads, idx, {
            ...this.downloads[idx],
            status: COMPLETE,
          });
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", `${name}.${format}`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        })
        .catch(() => {
          let idx = this.downloads.findIndex((d) => d.uuid === uuid);
          this.$set(this.downloads, idx, {
            ...this.downloads[idx],
            status: FAIL,
          });
        })
        .finally(() => {
          // Clean up the notifications no matter the result
          setTimeout(() => {
            let idx = this.downloads.findIndex((d) => {
              return d.uuid === uuid && d.status !== REQUEST;
            });
            if (idx >= 0) {
              this.downloads.splice(idx, 1);
            }
          }, 5000);
        });
    },
    dismiss(idx) {
      this.downloads.splice(idx, 1);
    },
  },
};
