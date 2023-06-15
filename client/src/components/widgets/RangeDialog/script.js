import { mapActions } from "vuex";

export default {
  inject: ["girderRest"],

  data() {
    return {
      newStart: 0.0,
      newEnd: 0.0,
      invalidInput: true,
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
  },
  computed: {
    settingsDialog: {
      get() {
        if (this.visible) {
          this.checkValidity();
        }
        return this.visible;
      },
      set(value) {
        if (!value) {
          this.$emit("close");
        }
      },
    },
  },
  methods: {
    ...mapActions({
      updatePlotDetails: "VIEW_DETAILS_UPDATED",
    }),
    save() {
      const min = parseFloat(this.newStart);
      const max = parseFloat(this.newEnd);
      const range = max - min < 1 ? null : [min, max];
      this.updatePlotDetails({ [`${this.id}`]: { range } });
      this.settingsDialog = false;
    },
    clear() {
      this.newStart = 0.0;
      this.newEnd = 0.0;
    },
    checkValidity() {
      if (parseFloat(this.newStart) <= parseFloat(this.newEnd)) {
        this.invalidInput = false;
      } else {
        this.invalidInput = true;
      }
    },
  },
};
