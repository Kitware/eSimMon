import { mapGetters } from "vuex";

export default {
  inject: ["girderRest"],

  props: {
    text: {
      type: Array,
      default: () => [],
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
  computed: {
    ...mapGetters({
      mathJaxOptions: "UI_MATH_JAX_OPTIONS",
    }),
  },
};
