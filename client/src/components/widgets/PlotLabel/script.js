import { mapGetters } from "vuex";

export default {
  inject: ["girderRest"],

  data() {
    return {};
  },
  props: {
    text: {
      type: String,
      default: "Title",
    },
    position: {
      type: String,
      default: "title",
    },
  },
  computed: {
    ...mapGetters({
      mathJaxOptions: "UI_MATH_JAX_OPTIONS",
    }),
    layoutClass() {
      const pos = this.position.toLowerCase();
      if (["title", "xaxis", "yaxis"].includes(pos)) {
        return `plot-${pos}`;
      }
      return "plot-title";
    },
  },
};
