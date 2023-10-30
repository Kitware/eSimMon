import RangeDialog from "../RangeDialog";
import DownloadOptions from "../DownloadOptions";
import { v4 as uuidv4 } from "uuid";
import { mapGetters, mapMutations } from "vuex";
import { PlotType } from "../../../utils/constants";

// Enum values
const REQUEST = "in progress";
const COMPLETE = "complete";
const FAIL = "failed";
const OFFSET_PLOTLY = [135, 150];
const OFFSET_VTK = [90, 50];

export default {
  name: "ContextMenu",
  inject: ["girderRest", "fastRestUrl"],

  components: {
    RangeDialog,
    DownloadOptions,
  },

  data() {
    return {
      showRangeDialog: false,
      downloads: [],
      averageDialog: false,
      range: "",
    };
  },

  watch: {
    averageDialog: {
      immediate: true,
      handler(visible) {
        if (visible) {
          this.setPaused(true);
        }
      },
    },
  },

  computed: {
    ...mapGetters({
      visible: "UI_SHOW_CONTEXT_MENU",
      itemInfo: "UI_CONTEXT_MENU_ITEM_DATA",
      mathJaxOptions: "UI_MATH_JAX_OPTIONS",
      minTimeStep: "VIEW_MIN_TIME_STEP",
      maxTimeStep: "VIEW_MAX_TIME_STEP",
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
    offsetPos() {
      if (this.isPlotly) {
        return [this.pos[0] + OFFSET_PLOTLY[0], this.pos[1] + OFFSET_PLOTLY[1]];
      }
      return [this.pos[0] + OFFSET_VTK[0], this.pos[1] + OFFSET_VTK[1]];
    },
    parameter() {
      return this.itemInfo ? this.itemInfo.name : "";
    },
    downloading() {
      return this.downloads.length > 0;
    },
    invalidInput() {
      let range = Number(this.range);
      return range < 0 && range > this.maxRange;
    },
    maxRange() {
      return this.maxTimeStep - this.minTimeStep;
    },
    averaging() {
      return !this.itemInfo ? false : !!this.itemInfo?.averaging;
    },
    isPlotly() {
      return this.itemInfo?.plotType === PlotType.Plotly;
    },
    plotDetails() {
      return (
        this.$store.getters[`${this.itemInfo?.id}/PLOT_DATA_COMPLETE`] || {}
      );
    },
    logScaling() {
      if (!this.itemInfo?.id) {
        return false;
      }

      return (
        this.$store.getters[`${this.itemInfo?.id}/PLOT_LOG_SCALING`] || false
      );
    },
  },

  methods: {
    ...mapMutations({
      showContextMenu: "UI_SHOW_CONTEXT_MENU_SET",
      updateItemInfo: "UI_CONTEXT_MENU_ITEM_DATA_SET",
      showDownloadOptions: "UI_SHOW_DOWNLOAD_OPTIONS_SET",
      setPaused: "UI_PAUSE_GALLERY_SET",
    }),
    fetchImage(format) {
      const { id, step } = this.itemInfo;
      const endpoint = `variables/${id}/timesteps/${step}/image?format=${format}`;
      this.downloadData(endpoint, format, "image");
    },
    fetchImages(format, timeSteps = null) {
      const { id } = this.itemInfo;
      let endpoint = `variables/${id}/timesteps/image?format=${format}`;
      if (timeSteps) {
        endpoint = `${endpoint}&selectedTimeSteps=${JSON.stringify(timeSteps)}`;
      }
      this.downloadData(endpoint, "zip", "image");
    },
    fetchMovie(format, timeSteps = null, fps = 10, useDefault = false) {
      const { id } = this.itemInfo;
      let endpoint = `variables/${id}/timesteps/movie?format=${format}`;
      if (timeSteps) {
        endpoint = `${endpoint}&selectedTimeSteps=${JSON.stringify(timeSteps)}`;
      }
      endpoint = `${endpoint}&fps=${fps}&useDefault=${useDefault}`;
      this.downloadData(endpoint, format, "movie");
    },
    downloadData(endpoint, format, type) {
      this.showMenu = false;
      const uuid = uuidv4();
      this.updateItemInfo({ ...this.itemInfo, uuid });
      const { name } = this.itemInfo;
      this.downloads.push({ type, uuid, name, status: REQUEST });
      let details = this.plotDetails
        ? `&details=${JSON.stringify(this.plotDetails)}`
        : "";
      this.girderRest
        .get(`${this.fastRestUrl}/${endpoint}${details}`, {
          responseType: "blob",
        })
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
    downloadOptions() {
      this.showMenu = false;
      this.showDownloadOptions(true);
    },
    clearGallery() {
      this.itemInfo.clearGallery();
    },
    useAverage(clear = false) {
      this.averageDialog = false;
      if (clear) {
        this.range = 0;
      }
      this.$store.commit(
        `${this.itemInfo.id}/PLOT_TIME_AVERAGE_SET`,
        Number(this.range),
      );
    },
    canAverage() {
      const xAxis = this.itemInfo?.xAxis || "";
      return !xAxis.toLowerCase().includes("time") && this.isPlotly;
    },
    toggleLogScale() {
      if (this.itemInfo?.id) {
        this.$store.commit(
          `${this.itemInfo.id}/PLOT_LOG_SCALING_SET`,
          !this.logScaling,
        );
      }
    },
  },
};
