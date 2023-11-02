import { mapGetters, mapMutations } from "vuex";
import Annotations from "../Annotations";
import { PlotFetcher } from "../../../utils/plotFetcher";
import { nextAvailableTimeStep } from "../../../utils/helpers";

export default {
  name: "StaticImage",
  inject: ["girderRest", "fastRestUrl"],

  components: {
    Annotations,
  },

  props: {
    itemId: {
      type: String,
      required: true,
    },
    plotFetcher: {
      type: PlotFetcher,
      required: true,
    },
  },

  data() {
    return {
      imageURL: "",
      availableTimeSteps: [],
      localTimeStep: 1,
      nextTimeStep: 1,
    };
  },

  computed: {
    ...mapGetters({
      enableStepAnnotations: "UI_SHOW_STEP_ANNOTATION",
      numReady: "VIEW_NUM_READY",
      currentTimeStep: "VIEW_TIME_STEP",
      numCols: "VIEWS_COLUMNS",
      numRows: "VIEWS_ROWS",
    }),
    itemTimeSteps() {
      return (
        this.$store.getters[`${this.itemId}/PLOT_AVAILABLE_TIME_STEPS`] || []
      );
    },
    loadedTimeStepData() {
      return this.$store.getters[`${this.itemId}/PLOT_LOADED_TIME_STEPS`] || [];
    },
  },

  methods: {
    ...mapMutations({
      updateNumReady: "VIEW_NUM_READY_SET",
    }),
    react() {
      this.imageURL = this.loadedTimeStepData.find(
        (img) => img.timestep == this.nextTimeStep,
      )?.url;
      this.updateNumReady(this.numReady + 1);
      this.$nextTick(this.recomputeRatio);
    },
    recomputeRatio() {
      this.$nextTick(() => {
        const { width, height } = this.$el.getBoundingClientRect();
        const el = document.getElementById(`static-${this.itemId}`);
        if (width < height) {
          const newHeight = (el.naturalHeight / el.naturalWidth) * width;
          el.style.height = newHeight;
          el.style.width = "auto";
        } else {
          const newWidth = height / (el.naturalHeight / el.naturalWidth);
          el.style.width = newWidth;
          el.style.height = "auto";
        }
      });
    },
  },

  watch: {
    numCols() {
      this.$nextTick(this.recomputeRatio);
    },
    numRows() {
      this.$nextTick(this.recomputeRatio);
    },
    loadedTimeStepData(loaded) {
      this.availableTimeSteps =
        loaded.map((d) => d.timestep).sort((a, b) => a - b) || [];
    },
    currentTimeStep(step) {
      this.localTimeStep = nextAvailableTimeStep(step, this.itemTimeSteps);
      this.plotFetcher.setCurrentTimestep(this.localTimeStep, true);
      this.nextTimeStep = nextAvailableTimeStep(step, this.availableTimeSteps);
    },
    availableTimeSteps(ats) {
      // Continue displaying the time step closest to the
      // requested step if the requested step is unavailable.
      this.nextTimeStep = nextAvailableTimeStep(this.currentTimeStep, ats);
    },
  },
};
