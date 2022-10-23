/*
This component extends the DataTable component in order to set the id on the
row elements.
*/
import { GirderDataTable } from "@girder/components/src";
import { mapGetters } from "vuex";

export default {
  mixins: [GirderDataTable],

  computed: {
    ...mapGetters({
      selectedPlots: "PLOT_SELECTIONS",
    }),
  },

  methods: {
    selectedPlot(id) {
      const color = this.selectedPlots.includes(id) ? "lightgray" : "black";
      return { color };
    },
  },
};
