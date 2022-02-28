export default {
  state: {
    zoom: null,
    currentTimeStep: 1,
    visibleCells: 0,
  },
  getters: {
    PLOT_ZOOM(state) {
      return state.zoom;
    },
    PLOT_TIME_STEP(state) {
      return state.currentTimeStep;
    },
    PLOT_VISIBLE_CELL_COUNT(state) {
      return state.visibleCells;
    },
  },
  mutations: {
    PLOT_ZOOM_SET(state, val) {
      state.zoom = val;
    },
    PLOT_TIME_STEP_SET(state, val) {
      state.currentTimeStep = val;
    },
    PLOT_VISIBLE_CELL_COUNT_SET(state, val) {
      state.visibleCells += val;
    },
  },
  actions: {
    PLOT_ZOOM_VALUES_UPDATED({commit}, zoomLevel) {
      if (zoomLevel) {
        zoomLevel = {
          xAxis: [zoomVals['xaxis.range[0]'], zoomVals['xaxis.range[1]']],
          yAxis: [zoomVals['yaxis.range[0]'], zoomVals['yaxis.range[1]']]
        }
      }
      commit('PLOT_ZOOM_SET', zoomLevel);
    }
  },
}
