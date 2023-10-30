import { extractRange } from "../utils/helpers";

export default {
  namespaced: true,
  state: () => ({
    log: false,
    userRange: null,
    timeAverage: 0,
    xAxis: "",
    zoom: null,
    times: null,
    loadedTimeStepData: null,
    availableTimeSteps: null,
    xRange: null,
    yRange: null,
    colorRange: null,
  }),
  getters: {
    PLOT_LOG_SCALING(state) {
      return state.log;
    },
    PLOT_USER_GLOBAL_RANGE(state) {
      return state.userRange;
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
      return {
        log: state.log,
        userRange: state.userRange,
        zoom: state.zoom,
        xRange: state.xRange,
        yRange: state.yRange,
        colorRange: state.colorRange,
      };
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
    PLOT_X_RANGE(state) {
      return state.xRange;
    },
    PLOT_Y_RANGE(state) {
      return state.yRange;
    },
    PLOT_COLOR_RANGE(state) {
      return state.colorRange;
    },
  },
  mutations: {
    PLOT_LOG_SCALING_SET(state, val) {
      state.log = val;
    },
    PLOT_USER_GLOBAL_RANGE_SET(state, val) {
      state.userRange = val;
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
    PLOT_TIMES_SET(state, val) {
      state.times = val;
    },
    PLOT_LOADED_TIME_STEPS_SET(state, val) {
      state.loadedTimeStepData = val;
    },
    PLOT_AVAILABLE_TIME_STEPS_SET(state, val) {
      state.availableTimeSteps = val;
    },
    PLOT_X_RANGE_SET(state, val) {
      state.xRange = val;
    },
    PLOT_Y_RANGE_SET(state, val) {
      state.yRange = val;
    },
    PLOT_COLOR_RANGE_SET(state, val) {
      state.colorRange = val;
    },
  },
  actions: {
    PLOT_DATA_RESET({ commit }) {
      commit("PLOT_LOG_SCALING_SET", false);
      commit("PLOT_USER_GLOBAL_RANGE_SET", null);
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
    PLOT_AVAILABLE_TIME_STEPS_CHANGED({ commit, rootGetters }, timeSteps) {
      commit("PLOT_AVAILABLE_TIME_STEPS_SET", timeSteps);

      let newMin = Infinity;
      let newMax = -Infinity;
      rootGetters.VIEW_SELECTIONS.forEach((id) => {
        let steps = rootGetters[`${id}/PLOT_AVAILABLE_TIME_STEPS`] || [];
        let [tsMin, tsMax] = extractRange(steps);
        newMin = Math.min(newMin, tsMin);
        newMax = Math.max(newMax, tsMax);
      });
      commit("VIEW_MIN_TIME_STEP_SET", newMin, { root: true });
      commit("VIEW_MAX_TIME_STEP_SET", newMax, { root: true });
      if (!rootGetters.VIEW_LOADING_FROM_SAVED) {
        let timeStep = rootGetters.VIEW_TIME_STEP;
        let newCurr = Math.max(Math.min(timeStep, newMax), newMin);
        commit("VIEW_TIME_STEP_SET", newCurr, { root: true });
      }
    },
    PLOT_META_DATA_CHANGED({ commit, dispatch }, meta) {
      dispatch("PLOT_AVAILABLE_TIME_STEPS_CHANGED", meta.steps);

      if (meta?.x_range) {
        commit("PLOT_X_RANGE_SET", meta.x_range);
      }
      if (meta?.y_range) {
        commit("PLOT_Y_RANGE_SET", meta.y_range);
      }
      if (meta?.color_range) {
        commit("PLOT_COLOR_RANGE_SET", meta.color_range);
      }
    },
  },
};
