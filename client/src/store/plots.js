export default {
  state: {
    currentTimeStep: 1,
    visibleCells: 0,
    itemId: null,
    maxTimeStep: 0,
    loadedFromView: false,
    initialLoad: true,
    minTimeStep: 1,
    boxSelector: null,
    focalPoint: null,
    scale: 0,
    viewTimeStep: 1,
    numReady: 0,
    times: null,
    loadedTimeStepData: null,
    availableTimeSteps: null,
    details: null,
    selectedPlots: [],
  },
  getters: {
    PLOT_TIME_STEP(state) {
      return state.currentTimeStep;
    },
    PLOT_VISIBLE_CELL_COUNT(state) {
      return state.visibleCells;
    },
    PLOT_CURRENT_ITEM_ID(state) {
      return state.itemId;
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
    PLOT_NUM_READY(state) {
      return state.numReady;
    },
    PLOT_TIMES(state) {
      return state.times;
    },
    PLOT_LOADED_TIME_STEPS(state) {
      return state.loadedTimeStepData;
    },
    PLOT_AVAILABLE_TIME_STEPS(state) {
      return state.availableTimeSteps;
    },
    PLOT_DETAILS(state) {
      return state.details;
    },
    PLOT_SELECTIONS(state) {
      return state.selectedPlots;
    },
  },
  mutations: {
    PLOT_TIME_STEP_SET(state, val) {
      state.currentTimeStep = val;
    },
    PLOT_VISIBLE_CELL_COUNT_SET(state, val) {
      state.visibleCells += val;
    },
    PLOT_CURRENT_ITEM_ID_SET(state, val) {
      state.itemId = val;
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
    PLOT_NUM_READY_SET(state, val) {
      state.numReady = val;
    },
    PLOT_TIMES_SET(state, val) {
      state.times = val;
    },
    PLOT_LOADED_TIME_STEPS_SET(state, val) {
      state.loadedTimeStepData = val;
    },
    PLOT_AVAILABLE_TIME_STEPS_SET(state, val) {
      state.availableTimeSteps = val;
    },
    PLOT_DETAILS_SET(state, val) {
      state.details = val;
    },
    PLOT_SELECTIONS_SET(state, val) {
      return (state.selectedPlots = val);
    },
  },
  actions: {
    PLOT_MIN_TIME_STEP_CHANGED({ state, commit }) {
      let newMin = Infinity;
      Object.values(state.availableTimeSteps).forEach((ats) => {
        const itemMin = Math.min(...ats);
        newMin = itemMin < newMin ? itemMin : newMin;
      });
      commit("PLOT_MIN_TIME_STEP_SET", newMin);
      if (!state.loadedFromView || !state.initialLoad) {
        commit("PLOT_TIME_STEP_SET", Math.max(state.currentTimeStep, newMin));
      }
    },
    PLOT_UPDATE_ITEM_TIMES({ state, commit }, data) {
      let itemId = Object.keys(data)[0];
      if (!itemId) {
        return;
      }

      commit("PLOT_TIMES_SET", { ...state.times, ...data });
    },
    PLOT_UPDATE_LOADED_TIME_STEPS({ state, commit }, data) {
      let itemId = Object.keys(data)[0];
      if (!itemId) {
        return;
      }

      commit("PLOT_LOADED_TIME_STEPS_SET", {
        ...state.loadedTimeStepData,
        ...data,
      });
    },
    PLOT_UPDATE_AVAILABLE_TIME_STEPS({ state, commit }, data) {
      let itemId = Object.keys(data)[0];
      if (!itemId) {
        return;
      }

      commit("PLOT_AVAILABLE_TIME_STEPS_SET", {
        ...state.availableTimeSteps,
        ...data,
      });
    },
    PLOT_DETAILS_UPDATED({ state, commit }, data) {
      let itemId = Object.keys(data)[0];
      if (!state.details) {
        commit("PLOT_DETAILS_SET", {});
      }
      let oldData = state.details[`${itemId}`] || {};
      let newData = Object.values(data)[0];
      let updated = { ...oldData, ...newData };
      commit("PLOT_DETAILS_SET", { ...state.details, [`${itemId}`]: updated });
    },
    PLOT_SELECTIONS_UPDATED({ state }, data) {
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
