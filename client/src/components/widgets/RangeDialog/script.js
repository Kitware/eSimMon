import { mapGetters } from "vuex";
import { PlotType } from "../../../utils/constants";
import { isEqual } from "lodash";

export default {
  inject: ["girderRest"],

  data() {
    return {
      x0: "",
      x1: "",
      y0: "",
      y1: "",
      s0: "",
      s1: "",
    };
  },
  props: {
    param: {
      type: String,
      default: "",
    },
    visible: {
      type: Boolean,
      default: false,
    },
    id: {
      type: String,
      default: "",
    },
    plotType: {
      type: String,
      default: PlotType.Plotly,
    },
  },
  computed: {
    ...mapGetters({
      useRunGlobals: "UI_USE_RUN_GLOBALS",
    }),
    xRange() {
      return this.$store.getters[`${this.id}/PLOT_X_RANGE`] || ["", ""];
    },
    yRange() {
      return this.$store.getters[`${this.id}/PLOT_Y_RANGE`] || ["", ""];
    },
    scalarRange() {
      return this.$store.getters[`${this.id}/PLOT_COLOR_RANGE`] || ["", ""];
    },
    userGlobalRange(range) {
      this.$store.commit(`${this.id}/PLOT_USER_GLOBAL_RANGE`, range);
    },
    settingsDialog: {
      get() {
        return this.visible;
      },
      set(value) {
        if (!value) {
          this.$emit("close");
        }
      },
    },
    showScalar() {
      return this.plotType !== PlotType.Plotly;
    },
  },
  methods: {
    updateUserGlobalRange(ranges) {
      this.$store.commit(`${this.id}/PLOT_USER_GLOBAL_RANGE_SET`, ranges);
    },
    save() {
      const inputs = {
        x: [this.x0, this.x1],
        y: [this.y0, this.y1],
        scalar: [this.s0, this.s1],
      };
      Object.entries(inputs).forEach(([key, value]) => {
        if (value) {
          let range = !value[0] || !value[1] ? null : value;
          if (range) {
            const [min, max] = [parseFloat(range[0]), parseFloat(range[1])];
            range = max <= min ? null : [min, max];
          }
          inputs[key] = range;
        }
      });
      this.updateUserGlobalRange(inputs);
      this.settingsDialog = false;
    },
    clear() {
      this.x0 = "";
      this.x1 = "";
      this.y0 = "";
      this.y1 = "";
      this.s0 = "";
      this.s1 = "";
    },
    auto() {
      this.x0 = this.xRange[0];
      this.x1 = this.xRange[1];
      this.y0 = this.yRange[0];
      this.y1 = this.yRange[1];
      this.s0 = this.scalarRange[0];
      this.s1 = this.scalarRange[1];
    },
  },
  watch: {
    id: {
      immediate: true,
      handler(newVal, oldVal) {
        if (!isEqual(newVal, oldVal)) {
          this.clear();
        }
      },
    },
  },
};
