import { ref, computed } from "@vue/composition-api";
import { useActions } from "vuex-composition-helpers";

export default {
  props: {
    param: String,
    visible: Boolean,
    id: String,
  },

  setup(props, { emit }) {
    const { updatePlotDetails } = useActions({
      updatePlotDetails: "PLOT_DETAILS_UPDATED",
    });

    const settingsDialog = computed({
      get: () => {
        if (props.visible) {
          checkValidity();
        }
        return props.visible;
      },
      set: (value) => {
        if (!value) {
          emit("close");
        }
      },
    });

    const newStart = ref(0.0);
    const newEnd = ref(0.0);
    function save() {
      const min = parseFloat(newStart.value);
      const max = parseFloat(newEnd.value);
      const range = max - min < 1 ? null : [min, max];
      updatePlotDetails({ [`${props.id}`]: { range } });
      settingsDialog.value = false;
    }
    function clear() {
      newStart.value = 0.0;
      newEnd.value = 0.0;
    }

    const invalidInput = ref(true);
    function checkValidity() {
      if (parseFloat(newStart.value) <= parseFloat(newEnd.value)) {
        invalidInput.value = false;
      } else {
        invalidInput.value = true;
      }
    }

    return {
      newStart,
      newEnd,
      invalidInput,
      settingsDialog,
      save,
      clear,
      checkValidity,
    };
  },
};
