import _ from "lodash";
import { mapActions, mapGetters, mapMutations } from "vuex";

export default {
  inject: ["girderRest"],

  data() {
    return {
      activeTab: 0,
      rangeInput: "",
      rangeSelection: "selectAll",
      formatSelection: "0",
      filters: [
        { text: "No filter", value: undefined, inputs: [] },
        {
          text: "Savitzky-Golay Filter",
          value: "savgol_filter",
          inputs: [
            { model: { windowLength: 1 }, label: "window_length (int)" },
            { model: { polyorder: 1 }, label: "polyorder (int)" },
            { model: { deriv: 0 }, label: "deriv (int) (optional)" },
            { model: { delta: 1.0 }, label: "delta (float) (optional)" },
            { model: { axis: -1 }, label: "axis (int) (optional)" },
            { model: { mode: "mirror" }, label: "mode (str) (optional)" },
            { model: { cval: 0.0 }, label: "cval (scalar) (optional)" },
          ],
        },
        {
          text: "Rolling Average",
          value: "convolve",
          inputs: [
            { model: { kernel: 1 }, label: "kernel (int)" },
            { model: { mode: "full" }, label: "mode (str) (optional)" },
          ],
        },
      ],
      filter: { text: "No filter", value: undefined, inputs: [] },
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
      const filter = this.filterInfo();
      if (this.activeTab === 0) {
        this.fetchMovie(this.format, timeSteps, filter);
      } else {
        this.fetchImages(this.format, timeSteps, filter);
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
            (x) => x + start
          );
          timeSteps.push(...range);
        } else {
          timeSteps.push(parseInt(selection));
        }
      });
      return timeSteps;
    },
    validate() {
      const validTextInput = !this.invalidInput;
      const validFilter = _.isObject(this.filter);
      // let validFilterValue = true;
      // if (this.filter.inputs) {
      //   validFilterValue = parseInt(this.filterValue);
      // }
      return validTextInput && validFilter; // && validFilterValue;
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
    filterInfo() {
      if (this.filter.value == null) {
        return null;
      }
      return {
        filter: this.filter.value,
        // value: this.filter.inputs ? this.filterValue : false,
      };
    },
    updateDialog() {
      this.filter = this.filters[0];
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
