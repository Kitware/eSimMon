export default {
  namespaced: true,
  state: () => ({
    legend: false,
    log: false,
    range: null,
    timeAverage: 0,
    xAxis: "",
    zoom: null,
  }),
  getters: {
    PLOT_LEGEND_VISIBILITY(state) {
      return state.legend;
    },
    PLOT_LOG_SCALING(state) {
      return state.log;
    },
    PLOT_GLOBAL_RANGE(state) {
      return state.range;
    },
    PLOT_TIME_AVERAGE(state) {
      return state.timeAverage;
    },
    PLOT_X_AXIS(state) {
      return state.xAxis;
    },
    PLOT_ZOOM(state) {
      return state.zoom;
    },
    PLOT_DATA_COMPLETE(state) {
      return { ...state };
    },
  },
  mutations: {
    PLOT_LEGEND_VISIBILITY_SET(state, val) {
      state.legend = val;
    },
    PLOT_LOG_SCALING_SET(state, val) {
      state.log = val;
    },
    PLOT_GLOBAL_RANGE_SET(state, val) {
      state.range = val;
    },
    PLOT_TIME_AVERAGE_SET(state, val) {
      state.timeAverage = val;
    },
    PLOT_X_AXIS_SET(state, val) {
      state.xAxis = val;
    },
    PLOT_ZOOM_SET(state, val) {
      state.zoom = val;
    },
  },
  actions: {
    PLOT_DATA_RESET({ commit }) {
      commit("PLOT_LEGEND_VISIBILITY_SET", false);
      commit("PLOT_LOG_SCALING_SET", false);
      commit("PLOT_GLOBAL_RANGE_SET", null);
      commit("PLOT_TIME_AVERAGE_SET", 0);
      commit("PLOT_X_AXIS_SET", "");
      commit("PLOT_ZOOM_SET", null);
    },
    PLOT_ZOOM_CHANGED({ getters, rootGetters, commit }, zoom) {
      commit("PLOT_ZOOM_SET", zoom);
      if (rootGetters.UI_ZOOM_SYNC) {
        rootGetters.VIEW_SELECTIONS.forEach((plotID) => {
          if (rootGetters[`${plotID}/PLOT_X_AXIS`] === getters.PLOT_X_AXIS) {
            commit(`${plotID}/PLOT_ZOOM_SET`, zoom, { root: true });
          }
        });
      }
    },
  },
};
