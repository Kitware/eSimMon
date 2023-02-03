export default {
  inject: ["girderRest"],

  data() {
    return {
      baseClass: "annotations",
    };
  },
  props: {
    text: {
      type: String,
      default: "",
    },
    top: {
      type: Boolean,
      default: false,
    },
    bottom: {
      type: Boolean,
      default: false,
    },
    right: {
      type: Boolean,
      default: false,
    },
    left: {
      type: Boolean,
      default: false,
    },
  },
};
