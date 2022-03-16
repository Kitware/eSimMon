export default {
  state: {
    zoom: null,
    currentTimeStep: 2862,
    visibleCells: 0,
    globalRanges: {},
    itemId: null,
    zoomXAxis: null,
    zoomOrigin: null,
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
    PLOT_ZOOM_X_AXIS(state) {
      return state.zoomXAxis;
    },
    PLOT_ZOOM_ORIGIN(state) {
      return state.zoomOrigin;
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
    PLOT_ZOOM_X_AXIS_SET(state, val) {
      state.zoomXAxis = val;
    },
    PLOT_ZOOM_ORIGIN_SET(state, val) {
      state.zoomOrigin = val;
    }
  },
  actions: {
    PLOT_GLOBAL_RANGES_UPDATED({state}, range) {
      state.globalRanges = {...state.globalRanges, [`${state.itemId}`]: range};
    },
    PLOT_ZOOM_DETAILS({commit}, zoom, xAxis) {
      commit('PLOT_ZOOM_SET', zoom);
      commit('PLOT_ZOOM_X_AXIS_SET', xAxis);
    },
  },
}
