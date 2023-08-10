export default {
  state: {
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
  },
  getters: {
    VIEWS_AUTO_SAVE_NAME(state) {
      return state.autoSaveName;
    },
    VIEWS_AUTO_SAVE_RUN(state) {
      return state.autoSaveRun;
    },
    VIEWS_AUTO_SAVED(state) {
      return state.autoSavedView;
    },
    VIEWS_COLUMNS(state) {
      return state.columns;
    },
    VIEWS_CREATOR(state) {
      return state.creator;
    },
    VIEWS_FORM_DATA(state) {
      return state.formData;
    },
    VIEWS_GRID_SIZE(state) {
      return state.gridSize;
    },
    VIEWS_INFO(state) {
      return state.info;
    },
    VIEWS_ITEMS(state) {
      return state.items;
    },
    VIEWS_LAST_LOADED_ID(state) {
      return state.lastLoadedID;
    },
    VIEWS_LAST_SAVED(state) {
      return state.lastSaved;
    },
    VIEWS_LIST_ALL(state) {
      return state.allViews;
    },
    VIEWS_META(state) {
      return {
        simulation: state.simulation,
        run: state.runId,
      };
    },
    VIEWS_PUBLIC(state) {
      return state.public;
    },
    VIEWS_RUN_ID(state) {
      return state.runId;
    },
    VIEWS_ROWS(state) {
      return state.rows;
    },
    VIEWS_SIMULATION(state) {
      return state.simulation;
    },
    VIEWS_STEP(state) {
      return state.step;
    },
  },
  mutations: {
    VIEWS_AUTO_SAVE_NAME_SET(state, val) {
      state.autoSaveName = val;
    },
    VIEWS_AUTO_SAVE_RUN_SET(state, val) {
      state.autoSaveRun = val;
    },
    VIEWS_AUTO_SAVED_SET(state, val) {
      state.autoSavedView = val;
    },
    VIEWS_COLUMNS_SET(state, val) {
      state.columns = val;
    },
    VIEWS_CREATOR_SET(state, val) {
      state.creator = val;
    },
    VIEWS_FORM_DATA_SET(state, val) {
      state.formData = val;
    },
    VIEWS_GRID_SIZE_SET(state, val) {
      state.gridSize = val;
    },
    VIEWS_INFO_SET(state, val) {
      state.info = val;
    },
    VIEWS_ITEMS_SET(state, val) {
      state.items = val;
    },
    VIEWS_LAST_LOADED_ID_SET(state, val) {
      state.lastLoadedID = val;
    },
    VIEWS_LAST_SAVED_SET(state, val) {
      state.lastSaved = val;
    },
    VIEWS_LIST_ALL_SET(state, val) {
      state.allViews = val;
    },
    VIEWS_PUBLIC_SET(state, val) {
      state.public = val;
    },
    VIEWS_ROWS_SET(state, val) {
      state.rows = val;
    },
    VIEWS_RUN_ID_SET(state, val) {
      state.runId = val;
    },
    VIEWS_SIMULATION_SET(state, val) {
      state.simulation = val;
    },
    VIEWS_STEP_SET(state, val) {
      state.step = val;
    },
  },
  actions: {
    async VIEWS_AUTO_SAVE({ state, commit, dispatch }) {
      dispatch("VIEWS_BUILD_FORM_DATA", state.autoSaveName);
      const formData = state.formData;
      // Check if auto-saved view already exists
      const { data } = await this.$girderRest.get(
        `/view?text=${state.autoSaveName}&exact=true&limit=50&sort=name&sortdir=1`,
      );
      if (data.length) {
        // If it does, update it
        await this.$girderRest
          .put(`/view/${data[0]._id}`, formData)
          .then(() => {
            commit("VIEWS_LAST_SAVED_SET", new Date());
          });
      } else {
        // If not, create it
        await this.$girderRest.post("/view", formData).then(() => {
          commit("VIEWS_LAST_SAVED_SET", new Date());
        });
      }
    },
    VIEWS_BUILD_FORM_DATA({ state, commit, getters }, name) {
      var formData = new FormData();
      formData.set("name", name);
      formData.set("rows", state.rows);
      formData.set("columns", state.columns);
      formData.set("step", getters.VIEW_TIME_STEP);
      formData.set("public", state.public);
      formData.set("items", JSON.stringify(state.items));
      formData.set("meta", JSON.stringify(getters.VIEWS_META));
      commit("VIEWS_FORM_DATA_SET", formData);
    },
    VIEWS_BUILD_ITEMS_OBJECT({ commit, getters }, layout) {
      const items = {};
      layout.forEach((item) => {
        const { row, col, itemId } = item;
        if (itemId) {
          const plotData = getters[`${itemId}/PLOT_DATA_COMPLETE`];
          items[`${row}::${col}`] = {
            id: itemId,
            log: plotData?.log || false,
            range: plotData?.range || null,
            xAxis: plotData?.xAxis || "",
            zoom: plotData?.zoom || null,
          };
        }
      });
      commit("VIEWS_ITEMS_SET", items);
    },
    VIEWS_CREATED({ state, dispatch }, name) {
      dispatch("VIEWS_BUILD_FORM_DATA", name);
      const formData = state.formData;
      this.$girderRest.post("/view", formData);
    },
    async VIEWS_FETCH_ALL_AVAILABLE({ state, commit }) {
      const { data } = await this.$girderRest.get(
        "/view?exact=false&limit=50&sort=name&sortdir=1",
      );
      commit("VIEWS_LIST_ALL_SET", data);
      let viewNames = [];
      let info = {};
      data.forEach((view) => {
        viewNames.push(view.name);
        if (state.creator === view.creatorId) {
          info[view.name] = view._id;
        }
      });
      commit("VIEWS_INFO_SET", info);
    },
    async VIEW_FETCH_AUTO_SAVE({ state, commit, getters }) {
      commit("VIEW_AUTO_SAVE_RUN_SET", false);
      const userId = this.$girderRest.user._id;
      const viewName = `${state.simulation}_${state.runId}_${userId}`;
      commit("VIEWS_AUTO_SAVE_NAME_SET", viewName);
      const { data } = await this.$girderRest.get(
        `/view?text=${viewName}&exact=true&limit=50&sort=name&sortdir=1`,
      );
      const view = data[0];
      if (view) {
        commit("VIEW_AUTO_SAVED_SET", view);
        // Show the auto-save dialog if it hasn't been disabled in the settings
        commit("UI_AUTO_SAVE_DIALOG_SET", getters.UI_AUTO_SAVE_DIALOG_ENABLED);
      }
    },
    VIEWS_LOAD_AUTO_SAVE({ state, commit, dispatch }) {
      commit("UI_AUTO_SAVE_DIALOG_SET", false);
      dispatch("VIEWS_LOADED", state.autoSavedView);
    },
    VIEWS_LOADED({ commit }, view) {
      // Make sure that view is registered as a change no matter size
      commit("VIEWS_GRID_SIZE_SET", 0);

      commit("VIEWS_ROWS_SET", parseInt(view.rows));
      commit("VIEWS_COLUMNS_SET", parseInt(view.columns));
      commit("VIEWS_ITEMS_SET", view.items);
      commit("VIEWS_PUBLIC_SET", view.public);
      commit("VIEWS_STEP_SET", parseInt(view.step));
      commit("VIEWS_RUN_ID_SET", view.meta.run);
      commit("VIEWS_SIMULATION_SET", view.meta.simulation);
      commit("VIEWS_LAST_LOADED_ID_SET", view._id);

      commit("VIEW_SAVED_TIME_STEP_SET", parseInt(view.step));
      commit("UI_PAUSE_GALLERY_SET", true);

      commit("VIEW_LOADING_FROM_SAVED_SET", true);
    },
    VIEWS_UPDATE_EXISTING({ state, dispatch }, name) {
      dispatch("VIEWS_BUILD_FORM_DATA", name);
      const formData = state.formData;
      this.$girderRest.put(`/view/${state.lastLoadedID}`, formData);
    },
  },
};
