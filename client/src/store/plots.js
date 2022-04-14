export default {
  state: {
    zoomPlotly: null,
    zoomVTK: null,
    currentTimeStep: 1,
    visibleCells: 0,
    globalRanges: {},
    itemId: null,
    zoomXAxis: null,
    zoomOrigin: null,
    maxTimeStep: 0,
    loadedFromView: false,
    initialLoad: true,
    minTimeStep: 1,
    boxSelector: null,
    focalPoint: null,
    scale: 0,
    viewTimeStep: 1,
  },
  getters: {
    PLOT_ZOOM_PLOTLY(state) {
      return state.zoomPlotly;
    },
    PLOT_ZOOM_VTK(state) {
      return state.zoomVTK;
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
    PLOT_MAX_TIME_STEP(state) {
      return state.maxTimeStep;
    },
    PLOT_LOADED_FROM_VIEW(state) {
      return state.loadedFromView;
    },
    PLOT_INITIAL_LOAD(state) {
      return state.initialLoad;
    },
    PLOT_MIN_TIME_STEP(state) {
      return state.minTimeStep;
    },
    PLOT_BOX_SELECTOR(state) {
      return state.boxSelector;
    },
    PLOT_FOCAL_POINT(state) {
      return state.focalPoint;
    },
    PLOT_SCALE(state) {
      return state.scale;
    },
    PLOT_VIEW_TIME_STEP(state) {
      return state.viewTimeStep;
    },
  },
  mutations: {
    PLOT_ZOOM_PLOTLY_SET(state, val) {
      state.zoomPlotly = val;
    },
    PLOT_ZOOM_VTK_SET(state, val) {
      state.zoomVTK = val;
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
    },
    PLOT_MAX_TIME_STEP_SET(state, val) {
      state.maxTimeStep = val;
    },
    PLOT_LOADED_FROM_VIEW_SET(state, val) {
      state.loadedFromView = val;
    },
    PLOT_INITIAL_LOAD_SET(state, val) {
      state.initialLoad = val;
    },
    PLOT_MIN_TIME_STEP_SET(state, val) {
      state.minTimeStep = val;
    },
    PLOT_BOX_SELECTOR_SET(state, val) {
      state.boxSelector = val;
    },
    PLOT_FOCAL_POINT_SET(state, val) {
      state.focalPoint = val;
    },
    PLOT_SCALE_SET(state, val) {
      state.scale = val;
    },
    PLOT_VIEW_TIME_STEP_SET(state, val) {
      state.viewTimeStep = val;
    },
  },
  actions: {
    PLOT_GLOBAL_RANGES_UPDATED({ state }, range) {
      state.globalRanges = {
        ...state.globalRanges,
        [`${state.itemId}`]: range,
      };
    },
    PLOT_ZOOM_DETAILS({ commit }, details) {
      const { xAxis } = details;
      if ("plotlyZoom" in details) {
        commit("PLOT_ZOOM_PLOTLY_SET", details.plotlyZoom);
      } else if ("vtkZoom" in details) {
        commit("PLOT_ZOOM_VTK_SET", details.vtkZoom);
      }
      commit("PLOT_ZOOM_X_AXIS_SET", xAxis);
    },
    PLOT_MIN_TIME_STEP_CHANGED({ state, commit }, val) {
      commit("PLOT_MIN_TIME_STEP_SET", val);
      commit("PLOT_TIME_STEP_SET", Math.max(state.currentTimeStep, val));
    },
  },
};
