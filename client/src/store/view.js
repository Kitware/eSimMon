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
    VIEW_TIME_STEP(state) {
      return state.currentTimeStep;
    },
    VIEW_VISIBLE_CELL_COUNT(state) {
      return state.visibleCells;
    },
    VIEW_CURRENT_ITEM_ID(state) {
      return state.itemId;
    },
    VIEW_MAX_TIME_STEP(state) {
      return state.maxTimeStep;
    },
    VIEW_LOADED_FROM_VIEW(state) {
      return state.loadedFromView;
    },
    VIEW_INITIAL_LOAD(state) {
      return state.initialLoad;
    },
    VIEW_MIN_TIME_STEP(state) {
      return state.minTimeStep;
    },
    VIEW_BOX_SELECTOR(state) {
      return state.boxSelector;
    },
    VIEW_FOCAL_POINT(state) {
      return state.focalPoint;
    },
    VIEW_SCALE(state) {
      return state.scale;
    },
    VIEW_SAVED_TIME_STEP(state) {
      return state.viewTimeStep;
    },
    VIEW_NUM_READY(state) {
      return state.numReady;
    },
    VIEW_TIMES(state) {
      return state.times;
    },
    VIEW_LOADED_TIME_STEPS(state) {
      return state.loadedTimeStepData;
    },
    VIEW_AVAILABLE_TIME_STEPS(state) {
      return state.availableTimeSteps;
    },
    VIEW_DETAILS(state) {
      return state.details;
    },
    VIEW_SELECTIONS(state) {
      return state.selectedPlots;
    },
  },
  mutations: {
    VIEW_TIME_STEP_SET(state, val) {
      state.currentTimeStep = val;
    },
    VIEW_VISIBLE_CELL_COUNT_SET(state, val) {
      state.visibleCells += val;
    },
    VIEW_CURRENT_ITEM_ID_SET(state, val) {
      state.itemId = val;
    },
    VIEW_MAX_TIME_STEP_SET(state, val) {
      state.maxTimeStep = val;
    },
    VIEW_LOADED_FROM_VIEW_SET(state, val) {
      state.loadedFromView = val;
    },
    VIEW_INITIAL_LOAD_SET(state, val) {
      state.initialLoad = val;
    },
    VIEW_MIN_TIME_STEP_SET(state, val) {
      state.minTimeStep = val;
    },
    VIEW_BOX_SELECTOR_SET(state, val) {
      state.boxSelector = val;
    },
    VIEW_FOCAL_POINT_SET(state, val) {
      state.focalPoint = val;
    },
    VIEW_SCALE_SET(state, val) {
      state.scale = val;
    },
    VIEW_SAVED_TIME_STEP_SET(state, val) {
      state.viewTimeStep = val;
    },
    VIEW_NUM_READY_SET(state, val) {
      state.numReady = val;
    },
    VIEW_TIMES_SET(state, val) {
      state.times = val;
    },
    VIEW_LOADED_TIME_STEPS_SET(state, val) {
      state.loadedTimeStepData = val;
    },
    VIEW_AVAILABLE_TIME_STEPS_SET(state, val) {
      state.availableTimeSteps = val;
    },
    VIEW_DETAILS_SET(state, val) {
      state.details = val;
    },
    VIEW_SELECTIONS_SET(state, val) {
      return (state.selectedPlots = val);
    },
  },
  actions: {
    VIEW_MIN_TIME_STEP_CHANGED({ state, commit }) {
      let newMin = Infinity;
      Object.values(state.availableTimeSteps).forEach((ats) => {
        const itemMin = Math.min(...ats);
        newMin = itemMin < newMin ? itemMin : newMin;
      });
      if (state.maxTimeStep < newMin) {
        commit("VIEW_MAX_TIME_STEP_SET", newMin);
      }
      commit("VIEW_MIN_TIME_STEP_SET", newMin);
      if (!state.loadedFromView || !state.initialLoad) {
        commit("VIEW_TIME_STEP_SET", Math.max(state.currentTimeStep, newMin));
      }
    },
    VIEW_UPDATE_ITEM_TIMES({ state, commit }, data) {
      let itemId = Object.keys(data)[0];
      if (!itemId) {
        return;
      }

      commit("VIEW_TIMES_SET", { ...state.times, ...data });
    },
    VIEW_UPDATE_LOADED_TIME_STEPS({ state, commit }, data) {
      let itemId = Object.keys(data)[0];
      if (!itemId) {
        return;
      }

      commit("VIEW_LOADED_TIME_STEPS_SET", {
        ...state.loadedTimeStepData,
        ...data,
      });
    },
    VIEW_UPDATE_AVAILABLE_TIME_STEPS({ state, commit }, data) {
      let itemId = Object.keys(data)[0];
      if (!itemId) {
        return;
      }

      commit("VIEW_AVAILABLE_TIME_STEPS_SET", {
        ...state.availableTimeSteps,
        ...data,
      });
    },
    VIEW_DETAILS_UPDATED({ state, commit }, data) {
      let itemId = Object.keys(data)[0];
      if (!state.details) {
        commit("VIEW_DETAILS_SET", {});
      }
      let oldData = state.details[`${itemId}`] || {};
      let newData = Object.values(data)[0];
      let updated = { ...oldData, ...newData };
      commit("VIEW_DETAILS_SET", { ...state.details, [`${itemId}`]: updated });
    },
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
