export default {
  state: {
    allNames: [],
    allViews: [],
    autoSaveName: "",
    autoSaveRun: false,
    autoSavedView: null,
    columns: 1,
    creator: "",
    formData: {},
    gridSize: 0,
    info: null,
    items: null,
    lastLoadedID: null,
    lastSaved: "",
    public: true,
    rows: 1,
    runId: null,
    simulation: null,
    step: 1,
    zoomLevels: null,
  },
  getters: {
    VIEW_AUTO_SAVE_NAME(state) {
      return state.autoSaveName;
    },
    VIEW_AUTO_SAVE_RUN(state) {
      return state.autoSaveRun;
    },
    VIEW_AUTO_SAVED(state) {
      return state.autoSavedView;
    },
    VIEW_COLUMNS(state) {
      return state.columns;
    },
    VIEW_CREATOR(state) {
      return state.creator;
    },
    VIEW_FORM_DATA(state) {
      return state.formData;
    },
    VIEW_GRID_SIZE(state) {
      return state.gridSize;
    },
    VIEW_INFO(state) {
      return state.info;
    },
    VIEW_ITEMS(state) {
      return state.items;
    },
    VIEW_LAST_LOADED_ID(state) {
      return state.lastLoadedID;
    },
    VIEW_LAST_SAVED(state) {
      return state.lastSaved;
    },
    VIEW_LIST_ALL(state) {
      return state.allViews;
    },
    VIEW_META(state) {
      return {
        simulation: state.simulation,
        run: state.runId,
      };
    },
    VIEW_NAMES(state) {
      return state.allNames;
    },
    VIEW_PUBLIC(state) {
      return state.public;
    },
    VIEW_RUN_ID(state) {
      return state.runId;
    },
    VIEW_ROWS(state) {
      return state.rows;
    },
    VIEW_SIMULATION(state) {
      return state.simulation;
    },
    VIEW_STEP(state) {
      return state.step;
    },
    VIEW_ZOOM_LEVELS(state) {
      return state.zoomLevels;
    },
  },
  mutations: {
    VIEW_AUTO_SAVE_NAME_SET(state, val) {
      state.autoSaveName = val;
    },
    VIEW_AUTO_SAVE_RUN_SET(state, val) {
      state.autoSaveRun = val;
    },
    VIEW_AUTO_SAVED_SET(state, val) {
      state.autoSavedView = val;
    },
    VIEW_COLUMNS_SET(state, val) {
      state.columns = val;
    },
    VIEW_CREATOR_SET(state, val) {
      state.creator = val;
    },
    VIEW_FORM_DATA_SET(state, val) {
      state.formData = val;
    },
    VIEW_GRID_SIZE_SET(state, val) {
      state.gridSize = val;
    },
    VIEW_INFO_SET(state, val) {
      state.info = val;
    },
    VIEW_ITEMS_SET(state, val) {
      state.items = val;
    },
    VIEW_LAST_LOADED_ID_SET(state, val) {
      state.lastLoadedID = val;
    },
    VIEW_LAST_SAVED_SET(state, val) {
      state.lastSaved = val;
    },
    VIEW_LIST_ALL_SET(state, val) {
      state.allViews = val;
    },
    VIEW_NAMES_SET(state, val) {
      state.allNames = val;
    },
    VIEW_PUBLIC_SET(state, val) {
      state.public = val;
    },
    VIEW_ROWS_SET(state, val) {
      state.rows = val;
    },
    VIEW_RUN_ID_SET(state, val) {
      state.runId = val;
    },
    VIEW_SIMULATION_SET(state, val) {
      state.simulation = val;
    },
    VIEW_STEP_SET(state, val) {
      state.step = val;
    },
    VIEW_ZOOM_LEVELS_SET(state, val) {
      state.zoomLevels = val;
    },
  },
  actions: {
    async VIEW_AUTO_SAVE({ state, commit, dispatch }) {
      dispatch("VIEW_BUILD_FORM_DATA", state.autoSaveName);
      const formData = state.formData;
      // Check if auto-saved view already exists
      const { data } = await this.$girderRest.get(
        `/view?text=${state.autoSaveName}&exact=true&limit=50&sort=name&sortdir=1`
      );
      if (data.length) {
        // If it does, update it
        await this.$girderRest
          .put(`/view/${data[0]._id}`, formData)
          .then(() => {
            commit("VIEW_LAST_SAVED_SET", new Date());
          });
      } else {
        // If not, create it
        await this.$girderRest.post("/view", formData).then(() => {
          commit("VIEW_LAST_SAVED_SET", new Date());
        });
      }
    },
    VIEW_BUILD_FORM_DATA({ state, commit, getters }, name) {
      var formData = new FormData();
      formData.set("name", name);
      formData.set("rows", state.rows);
      formData.set("columns", state.columns);
      formData.set("step", getters.PLOT_TIME_STEP);
      formData.set("public", state.public);
      formData.set("items", JSON.stringify(state.items));
      formData.set("meta", JSON.stringify(getters.VIEW_META));
      commit("VIEW_FORM_DATA_SET", formData);
    },
    VIEW_BUILD_ITEMS_OBJECT({ commit, getters }, layout) {
      const items = {};
      const plotDetails = getters.PLOT_DETAILS;
      layout.forEach((item) => {
        const { row, col } = item;
        const { legend, log, range, xAxis, zoom } =
          plotDetails[`${item.itemId}`];
        items[`${row}::${col}`] = {
          id: item.itemId,
          legend,
          log,
          range,
          xAxis,
          zoom,
        };
      });
      commit("VIEW_ITEMS_SET", items);
    },
    VIEW_CREATED({ state, dispatch }, name) {
      dispatch("VIEW_BUILD_FORM_DATA", name);
      const formData = state.formData;
      this.$girderRest.post("/view", formData);
    },
    async VIEW_FETCH_ALL_AVAILABLE({ state, commit }) {
      const { data } = await this.$girderRest.get(
        "/view?exact=false&limit=50&sort=name&sortdir=1"
      );
      commit("VIEW_LIST_ALL_SET", data);
      let viewNames = [];
      let info = {};
      data.forEach((view) => {
        viewNames.push(view.name);
        if (state.creator === view.creatorId) {
          info[view.name] = view._id;
        }
      });
      commit("VIEW_NAMES_SET", viewNames);
      commit("VIEW_INFO_SET", info);
    },
    async VIEW_FETCH_AUTO_SAVE({ state, commit }) {
      commit("VIEW_AUTO_SAVE_RUN_SET", false);
      const userId = this.$girderRest.user._id;
      const viewName = `${state.simulation}_${state.runId}_${userId}`;
      commit("VIEW_AUTO_SAVE_NAME_SET", viewName);
      const { data } = await this.$girderRest.get(
        `/view?text=${viewName}&exact=true&limit=50&sort=name&sortdir=1`
      );
      const view = data[0];
      if (view) {
        commit("VIEW_AUTO_SAVED_SET", view);
        commit("UI_AUTO_SAVE_DIALOG_SET", true);
      }
    },
    VIEW_LOAD_AUTO_SAVE({ state, commit, dispatch }) {
      commit("UI_AUTO_SAVE_DIALOG_SET", false);
      dispatch("VIEW_LOADED", state.autoSavedView);
    },
    VIEW_LOADED({ commit }, view) {
      commit("VIEW_ROWS_SET", parseInt(view.rows));
      commit("VIEW_COLUMNS_SET", parseInt(view.columns));
      commit("VIEW_GRID_SIZE_SET", view.rows * view.columns);
      commit("VIEW_ITEMS_SET", view.items);
      commit("VIEW_PUBLIC_SET", view.public);
      commit("VIEW_STEP_SET", parseInt(view.step));
      commit("VIEW_ITEMS_SET", view.items);
      commit("VIEW_RUN_ID_SET", view.meta.run);
      commit("VIEW_SIMULATION_SET", view.meta.simulation);
      commit("VIEW_LAST_LOADED_ID_SET", view._id);
      // commit('VIEW_ZOOM_LEVELS', view.zoomLevels);

      commit("PLOT_VIEW_TIME_STEP_SET", parseInt(view.step));
      commit("UI_PAUSE_GALLERY_SET", true);
    },
    VIEW_UPDATE_EXISTING({ state, dispatch }, name) {
      dispatch("VIEW_BUILD_FORM_DATA", name);
      const formData = state.formData;
      this.$girderRest.put(`/view/${state.lastLoadedID}`, formData);
    },
  },
};
