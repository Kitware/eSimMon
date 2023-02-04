import { mapActions, mapGetters, mapMutations } from "vuex";

export default {
  inject: ["girderRest"],

  data() {
    return {
      activeTab: 0,
      rangeInput: "",
      rangeSelection: "selectAll",
      formatSelection: "0",
      hint: "",
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
      availableTimeSteps: "PLOT_AVAILABLE_TIME_STEPS",
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
          this.updateHint();
        }
      },
    },
    disableInput() {
      return this.rangeSelection === "selectAll";
    },
    minStep() {
      if (this.id) {
        return Math.min(...this.availableTimeSteps[`${this.id}`]) || 0;
      }
      return 0;
    },
    maxStep() {
      if (this.id) {
        return Math.max(...this.availableTimeSteps[`${this.id}`]) || 0;
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
    invalidInput() {
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
  },
  methods: {
    ...mapActions({
      updatePlotDetails: "PLOT_DETAILS_UPDATED",
    }),
    ...mapMutations({
      showDownloadOptions: "UI_SHOW_DOWNLOAD_OPTIONS_SET",
    }),
    beginDownload() {
      const valid = this.validate();
      if (!valid) {
        this.updateHint();
        return;
      }
      const timeSteps = this.computeListOfTimeSteps();
      if (this.activeTab === 0) {
        this.fetchMovie(this.format, timeSteps);
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
      return !this.invalidInput;
    },
    updateHint() {
      if (this.invalidInput) {
        this.hint = `Input must be ranges(start-stop) or values seperated by
                    commas. Values must be within available range of time steps
                    (${this.minStep}-${this.maxStep})`;
      } else {
        this.hint = `Available Range: ${this.minStep} - ${this.maxStep}`;
      }
    },
  },
  watch: {
    rangeInput() {
      if (this.hint.startsWith("Input")) {
        // We're in error mode but the user has changed their input.
        // Clear the error message if the input is now valid
        this.updateHint();
      }
    },
    minStep() {
      this.updateHint();
    },
    maxStep() {
      this.updateHint();
    },
  },
};
