export default {
  state: {
    currentTimeStep: 1,
    cellCount: 0,
    selectedPlotId: null,
    maxTimeStep: 0,
    initialLoad: true,
    minTimeStep: 1,
    viewTimeStep: 1,
    numReady: 0,
    selectedPlots: [],
    loadingFromSaved: false,
  },
  getters: {
    VIEW_TIME_STEP(state) {
      return state.currentTimeStep;
    },
    VIEW_VISIBLE_CELL_COUNT(state) {
      return state.cellCount;
    },
    VIEW_CURRENT_ITEM_ID(state) {
      return state.selectedPlotId;
    },
    VIEW_MAX_TIME_STEP(state) {
      return state.maxTimeStep;
    },
    VIEW_INITIAL_LOAD(state) {
      return state.initialLoad;
    },
    VIEW_MIN_TIME_STEP(state) {
      return state.minTimeStep;
    },
    VIEW_SAVED_TIME_STEP(state) {
      return state.viewTimeStep;
    },
    VIEW_NUM_READY(state) {
      return state.numReady;
    },
    VIEW_SELECTIONS(state) {
      return state.selectedPlots;
    },
    VIEW_LOADING_FROM_SAVED(state) {
      return state.loadingFromSaved;
    },
  },
  mutations: {
    VIEW_TIME_STEP_SET(state, val) {
      state.currentTimeStep = val;
    },
    VIEW_VISIBLE_CELL_COUNT_SET(state, val) {
      state.cellCount += val;
    },
    VIEW_CURRENT_ITEM_ID_SET(state, val) {
      state.selectedPlotId = val;
    },
    VIEW_MAX_TIME_STEP_SET(state, val) {
      state.maxTimeStep = val;
    },
    VIEW_INITIAL_LOAD_SET(state, val) {
      state.initialLoad = val;
    },
    VIEW_MIN_TIME_STEP_SET(state, val) {
      state.minTimeStep = val;
    },
    VIEW_SAVED_TIME_STEP_SET(state, val) {
      state.viewTimeStep = val;
    },
    VIEW_NUM_READY_SET(state, val) {
      state.numReady = val;
    },
    VIEW_SELECTIONS_SET(state, val) {
      state.selectedPlots = val;
    },
    VIEW_LOADING_FROM_SAVED_SET(state, val) {
      state.loadingFromSaved = val;
    },
  },
  actions: {
    VIEW_SELECTIONS_UPDATED({ state }, data) {
      const { newId, oldId } = data;
      const pos = state.selectedPlots.findIndex((id) => id === oldId);
      if (pos !== -1) {
        state.selectedPlots.splice(pos, 1);
      }
      if (newId) {
        state.selectedPlots.push(newId);
      }
    },
  },
};
