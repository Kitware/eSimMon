// TODO:
// - Test download all images
// - Test download range of images
// - Test download all as movie
// - Test download range as movie
// - Try to input invalid range
import { ref, computed } from "@vue/composition-api";
import { useGetters, useMutations } from "vuex-composition-helpers";

export default {
  props: {
    id: String,
    param: String,
    fetchImages: Function,
    fetchMovie: Function,
  },

  setup(props) {
    // Template params ====================================================
    const { mathJaxOptions } = useGetters({
      mathJaxOptions: "UI_MATH_JAX_OPTIONS",
    });

    // Set up dialog ======================================================
    const { visible } = useGetters({ visible: "UI_SHOW_DOWNLOAD_OPTIONS" });
    const { showDownloadOptions } = useMutations({
      showDownloadOptions: "UI_SHOW_DOWNLOAD_OPTIONS_SET",
    });
    const downloadsDialog = computed({
      get: () => {
        if (visible.value) {
          updateHint();
        }
        return visible.value;
      },
      set: (value) => {
        showDownloadOptions(value);
        if (value) {
          updateHint();
        }
      },
    });

    // Dialog Values and behavior =========================================
    const rangeSelection = ref("selectAll");
    const rangeInput = ref("");
    const hint = ref("");
    const { availableTimeSteps } = useGetters({
      availableTimeSteps: "PLOT_AVAILABLE_TIME_STEPS",
    });

    const minStep = computed(() => {
      if (props.id) {
        return Math.min(...availableTimeSteps.value[`${props.id}`]) || 0;
      }
      return 0;
    });
    const maxStep = computed(() => {
      if (props.id) {
        return Math.max(...availableTimeSteps.value[`${props.id}`]) || 0;
      }
      return 0;
    });
    const invalidInput = computed(() => {
      if (rangeSelection.value == "selectAll") {
        return false;
      }
      const regex = /^[0-9](?:-[0-9])?(?:,\s?[0-9](?:-[0-9])?)*$/g;
      let validFormat = rangeInput.value.match(regex) === null;
      if (validFormat) {
        let selectedTimeSteps = rangeInput.value.split(/[-,]+/);
        // Make sure values are acceptable
        let containsInvalidTimeSteps = selectedTimeSteps.some((timeStep) => {
          return timeStep < minStep.value || timeStep > maxStep.value;
        });
        return containsInvalidTimeSteps;
      }
      return true;
    });
    const disableInput = computed(() => rangeSelection.value === "selectAll");
    const choice = computed(() => (activeTab.value === 0 ? "Movie" : "Image"));

    function validate() {
      return !invalidInput.value;
    }
    function updateHint() {
      if (invalidInput.value) {
        hint.value = `Input must be ranges(start-stop) or values seperated by
                            commas. Values must be within available range of time steps
                            (${minStep.value}-${maxStep.value})`;
      } else {
        hint.value = `Available Range: ${minStep.value} - ${maxStep.value}`;
      }
    }
    function computeListOfTimeSteps() {
      if (rangeSelection.value === "selectAll") {
        return;
      }
      let timeSteps = [];
      let selections = rangeInput.value.split(",");
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
    }

    // Downloading ========================================================
    const activeTab = ref(0);
    const formatSelection = ref("0");

    const formatOptions = computed(() => {
      const movieOptions = ["mp4", "mpg"];
      const imageOptions = ["png", "pdf"];
      return choice.value === "Movie" ? movieOptions : imageOptions;
    });
    const format = computed(() => formatOptions[formatSelection.value]);

    function beginDownload() {
      const valid = validate();
      if (!valid) {
        updateHint();
        return;
      }
      const timeSteps = computeListOfTimeSteps();
      if (activeTab.value === 0) {
        props.fetchMovie(format.value, timeSteps);
      } else {
        props.fetchImages(format.value, timeSteps);
      }
      downloadsDialog.value = false;
    }

    return {
      activeTab,
      beginDownload,
      disableInput,
      downloadsDialog,
      formatOptions,
      formatSelection,
      hint,
      mathJaxOptions,
      props,
      rangeInput,
      rangeSelection,
    };
  },
};
