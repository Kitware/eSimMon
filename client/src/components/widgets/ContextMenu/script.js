import RangeDialog from "../RangeDialog";
import { v4 as uuidv4 } from "uuid";
import { mapGetters, mapMutations } from "vuex";

// Enum values
const REQUEST = 0;
const COMPLETE = 1;
const FAIL = 2;

export default {
  name: "ContextMenu",
  inject: ["girderRest", "fastRestUrl"],

  components: {
    RangeDialog,
  },

  data() {
    return {
      showRangeDialog: false,
      requested: [],
      completed: [],
      failed: [],
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
    requests() {
      return this.requested.length > 0;
    },
    completions() {
      return this.completed.length > 0;
    },
    failures() {
      return this.failed.length > 0;
    },
  },

  methods: {
    ...mapMutations({
      showContextMenu: "UI_SHOW_CONTEXT_MENU_SET",
      updateItemInfo: "UI_CONTEXT_MENU_ITEM_DATA_SET",
    }),
    fetchImage(format) {
      const { id, step } = this.itemInfo;
      const endpoint = `images/${id}/timesteps/${step}/format/${format}`;
      this.downloadData(endpoint, format, "Image");
    },
    fetchMovie(format) {
      const { id } = this.itemInfo;
      const endpoint = `movie/${id}/format/${format}`;
      this.downloadData(endpoint, format, "Movie");
    },
    downloadData(endpoint, format, type) {
      const uuid = uuidv4();
      this.updateItemInfo({ ...this.itemInfo, uuid });
      const { name } = this.itemInfo;
      this.requested.push({ type, uuid, name });
      let zoom = this.itemInfo.isVTK ? this.vtkZoom : this.plotlyZoom;
      zoom = zoom ? `?zoom=${JSON.stringify(zoom)}` : "";
      this.girderRest
        .get(`${this.fastRestUrl}/${endpoint}${zoom}`, { responseType: "blob" })
        .then((response) => {
          let idx = this.requested.findIndex((d) => d.uuid === uuid);
          this.completed.push(this.requested[idx]);
          this.requested.splice(idx, 1);
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", `${name}.${format}`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        })
        .catch(() => {
          let idx = this.requested.findIndex((d) => d.uuid === uuid);
          this.failed.push(this.requested[idx]);
          this.requested.splice(idx, 1);
        })
        .finally(() => {
          // Clean up the notifications no matter the result
          setTimeout(() => {
            if (this.completions) {
              let idx = this.completed.findIndex((d) => d.uuid === uuid);
              if (idx >= 0) {
                this.completed.splice(idx, 1);
              }
            }
            if (this.failures) {
              let idx = this.failed.findIndex((d) => d.uuid === uuid);
              if (idx >= 0) {
                this.failed.splice(idx, 1);
              }
            }
          }, 3000);
        });
    },
    calcMargin(idx, notificationType) {
      // Find the total number of notifications visible
      let reqCount = this.requested.length;
      let failCount = this.failed.length;
      let compCount = this.completed.length;
      if (notificationType === REQUEST) {
        return `${idx * 80 + (failCount + compCount) * 65}px`;
      } else if (notificationType === COMPLETE) {
        return `${reqCount * 80 + (failCount + idx) * 65}px`;
      } else if (notificationType === FAIL) {
        return `${reqCount * 80 + (idx + compCount) * 65}px`;
      }
      return `${reqCount * 80 + (failCount + compCount) * 65}px`;
    },
    dismiss(idx, notificationType) {
      if (notificationType === REQUEST) {
        this.requested.splice(idx, 1);
      } else if (notificationType === COMPLETE) {
        this.completed.splice(idx, 1);
      } else if (notificationType === FAIL) {
        this.failed.splice(idx, 1);
      }
    },
  },
};
