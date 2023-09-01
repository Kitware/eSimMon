import _ from "lodash";
import { mapGetters, mapMutations } from "vuex";
import { extractRange } from "../../../utils/helpers";

export default {
  inject: ["girderRest"],

  data() {
    return {
      activeTab: 0,
      rangeInput: "",
      rangeSelection: "selectAll",
      formatSelection: "0",
      rangeHint: "",
      fpsInput: "10",
      fpsHint: "",
    };
  },
  props: {
    allPlots: {
      type: Object,
      // eslint-disable-next-line
      default: () => {},
    },
    id: {
      type: String,
      default: "",
    },
    param: {
      type: String,
      default: "",
    },
    fetchImages: {
      type: Function,
      // eslint-disable-next-line
      default: () => {},
    },
    fetchMovie: {
      type: Function,
      // eslint-disable-next-line
      default: () => {},
    },
  },
  computed: {
    ...mapGetters({
      visible: "UI_SHOW_DOWNLOAD_OPTIONS",
      mathJaxOptions: "UI_MATH_JAX_OPTIONS",
    }),
    downloadsDialog: {
      get() {
        return this.visible;
      },
      set(value) {
        this.showDownloadOptions(value);
        if (value) {
          this.updateDialog();
        }
      },
    },
    disableInput() {
      return this.rangeSelection === "selectAll";
    },
    minStep() {
      if (this.id) {
        let ats = this.$store.getters[`${this.id}/PLOT_AVAILABLE_TIME_STEPS`];
        let [min] = extractRange(ats);
        return min;
      }
      return 0;
    },
    maxStep() {
      if (this.id) {
        let ats = this.$store.getters[`${this.id}/PLOT_AVAILABLE_TIME_STEPS`];
        let [, max] = extractRange(ats);
        return max;
      }
      return 0;
    },
    choice() {
      return this.activeTab === 0 ? "Movie" : "Image";
    },
    formatOptions() {
      const movieOptions = ["mp4", "mpg"];
      const imageOptions = ["png", "pdf"];
      return this.choice === "Movie" ? movieOptions : imageOptions;
    },
    format() {
      return this.formatOptions[this.formatSelection];
    },
    invalidRangeInput() {
      if (this.rangeSelection == "selectAll") {
        return false;
      }
      const regex = /^[0-9](?:-[0-9])?(?:,\s?[0-9](?:-[0-9])?)*$/g;
      let validFormat = this.rangeInput.match(regex) === null;
      if (validFormat) {
        let selectedTimeSteps = this.rangeInput.split(/[-,]+/);
        // Make sure values are acceptable
        let containsInvalidTimeSteps = selectedTimeSteps.some((timeStep) => {
          return timeStep < this.minStep || timeStep > this.maxStep;
        });
        return containsInvalidTimeSteps;
      }
      return true;
    },
    invalidFPSInput() {
      if (_.isEmpty(this.fpsInput)) {
        return false;
      }
      return !parseFloat(this.fpsInput);
    },
  },
  methods: {
    ...mapMutations({
      showDownloadOptions: "UI_SHOW_DOWNLOAD_OPTIONS_SET",
    }),
    beginDownload() {
      const valid = this.validate();
      if (!valid) {
        this.updateDialog();
        return;
      }
      const timeSteps = this.computeListOfTimeSteps();
      const fps = this.fpsInput ? this.fpsInput : 10;
      if (this.activeTab === 0) {
        this.fetchMovie(this.format, timeSteps, fps);
      } else {
        this.fetchImages(this.format, timeSteps);
      }
      this.downloadsDialog = false;
    },
    computeListOfTimeSteps() {
      if (this.rangeSelection === "selectAll") {
        return;
      }
      let timeSteps = [];
      let selections = this.rangeInput.split(",");
      selections.forEach((selection) => {
        let vals = selection.split("-");
        if (vals.length > 1) {
          const start = parseInt(vals[0]);
          const end = parseInt(vals[1]);
          const range = [...Array(end - start + 1).keys()].map(
            (x) => x + start,
          );
          timeSteps.push(...range);
        } else {
          timeSteps.push(parseInt(selection));
        }
      });
      return timeSteps;
    },
    validate() {
      return !this.invalidRangeInput && !this.invalidFPSInput;
    },
    updateRangeHint() {
      if (this.invalidRangeInput) {
        this.rangeHint = `Input must be ranges(start-stop) or values seperated by
                    commas. Values must be within available range of time steps
                    (${this.minStep}-${this.maxStep})`;
      } else {
        this.rangeHint = `Available Range: ${this.minStep} - ${this.maxStep}`;
      }
    },
    updateFPSHint() {
      if (this.invalidFPSInput) {
        this.fpsHint = "Must be a single numeric value greater than zero.";
      } else {
        this.fpsHint = "Set the frames per second for movies";
      }
    },
    updateDialog() {
      this.updateRangeHint();
      this.updateFPSHint();
    },
  },
  watch: {
    rangeInput() {
      if (this.rangeHint.startsWith("Input")) {
        // We're in error mode but the user has changed their input.
        // Clear the error message if the input is now valid
        this.updateRangeHint();
      }
    },
    fpsInput() {
      if (this.fpsHint.startsWith("Must")) {
        // We're in error mode but the user has changed their input.
        // Clear the error message if the input is now valid
        this.updateFPSHint();
      }
    },
    minStep() {
      this.updateRangeHint();
    },
    maxStep() {
      this.updateRangeHint();
    },
  },
};
