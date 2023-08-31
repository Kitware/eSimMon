import { mapGetters } from "vuex";

export default {
  name: "StaticImage",
  inject: ["girderRest", "fastRestUrl"],

  props: {
    itemId: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      imageURL: "",
    };
  },

  computed: {
    ...mapGetters({
      currentTimeStep: "VIEW_TIME_STEP",
      numCols: "VIEWS_COLUMNS",
      numRows: "VIEWS_ROWS",
    }),
    availableTimeSteps() {
      return (
        this.$store.getters[`${this.itemId}/PLOT_AVAILABLE_TIME_STEPS`] || []
      );
    },
    loadedTimeStepData() {
      return this.$store.getters[`${this.itemId}/PLOT_LOADED_TIME_STEPS`] || [];
    },
    localTimeStep() {
      let timeStep = this.currentTimeStep;
      if (!this.availableTimeSteps.find((v) => v === timeStep)) {
        let idx = this.availableTimeSteps.findIndex((v) => v >= timeStep);
        idx = Math.max((idx -= 1), 0);
        timeStep = this.availableTimeSteps[idx];
      }
      return timeStep;
    },
  },

  methods: {
    react() {
      this.imageURL = this.loadedTimeStepData.find(
        (img) => img.timestep == this.localTimeStep,
      )?.url;
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
  },
};
