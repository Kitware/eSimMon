export default {
  state: {
    zoom: null,
    currentTimeStep: 1,
    visibleCells: 0,
    globalRanges: {},
    itemId: null,
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
    PLOT_GLOBAL_RANGES(state) {
      return state.globalRanges;
    },
    PLOT_CURRENT_ITEM_ID(state) {
      return state.itemId;
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
    PLOT_GLOBAL_RANGES_SET(state, val) {
      state.globalRanges = val;
    },
    PLOT_CURRENT_ITEM_ID_SET(state, val) {
      state.itemId = val;
    },
  },
  actions: {
    PLOT_ZOOM_VALUES_UPDATED({commit}, zoomLevel) {
      if (zoomLevel) {
        zoomLevel = {
          xAxis: [zoomLevel['xaxis.range[0]'], zoomLevel['xaxis.range[1]']],
          yAxis: [zoomLevel['yaxis.range[0]'], zoomLevel['yaxis.range[1]']]
        }
      }
      commit('PLOT_ZOOM_SET', zoomLevel);
    },
    PLOT_GLOBAL_RANGES_UPDATED({state}, range) {
      state.globalRanges = {...state.globalRanges, [`${state.itemId}`]: range};
    },
  },
}
