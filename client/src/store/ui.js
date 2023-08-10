export default {
  state: {
    autoSavedViewDialog: false,
    galleryPaused: true,
    interactor: null,
    showLoadDialog: false,
    showSaveDialog: false,
    timeStepSelection: false,
    renderWindow: null,
    zoomSync: true,
    rendererCount: 0,
    contextMenu: false,
    contextMenuItemData: null,
    mathJaxOptions: {
      tex2jax: {
        inlineMath: [
          ["$", "$"],
          ["(", ")"],
        ],
        processEscapes: true,
        processEnvironments: true,
      },
    },
    showDownloadOptions: false,
    boxSelector: null,
    showSettings: false,
    autoSavedViewDialogEnabled: true,
    useRunGlobals: true,
    showXAxis: false,
    showYAxis: false,
    showScalarBar: false,
    showTitle: false,
    showLegend: false,
  },
  getters: {
    UI_AUTO_SAVE_DIALOG(state) {
      return state.autoSavedViewDialog;
    },
    UI_INTERACTOR(state) {
      return state.interactor;
    },
    UI_PAUSE_GALLERY(state) {
      return state.galleryPaused;
    },
    UI_SHOW_LOAD_DIALOG(state) {
      return state.showLoadDialog;
    },
    UI_SHOW_SAVE_DIALOG(state) {
      return state.showSaveDialog;
    },
    UI_RENDER_WINDOW(state) {
      return state.renderWindow;
    },
    UI_ZOOM_SYNC(state) {
      return state.zoomSync;
    },
    UI_TIME_STEP_SELECTOR(state) {
      return state.timeStepSelection;
    },
    UI_RENDERER_COUNT(state) {
      return state.rendererCount;
    },
    UI_SHOW_CONTEXT_MENU(state) {
      return state.contextMenu;
    },
    UI_CONTEXT_MENU_ITEM_DATA(state) {
      return state.contextMenuItemData;
    },
    UI_MATH_JAX_OPTIONS(state) {
      return state.mathJaxOptions;
    },
    UI_SHOW_DOWNLOAD_OPTIONS(state) {
      return state.showDownloadOptions;
    },
    UI_BOX_SELECTOR(state) {
      return state.boxSelector;
    },
    UI_SHOW_SETTINGS(state) {
      return state.showSettings;
    },
    UI_AUTO_SAVE_DIALOG_ENABLED(state) {
      return state.autoSavedViewDialogEnabled;
    },
    UI_USE_RUN_GLOBALS(state) {
      return state.useRunGlobals;
    },
    UI_SHOW_X_AXIS(state) {
      return state.showXAxis;
    },
    UI_SHOW_Y_AXIS(state) {
      return state.showYAxis;
    },
    UI_SHOW_SCALAR_BAR(state) {
      return state.showScalarBar;
    },
    UI_SHOW_TITLE(state) {
      return state.showTitle;
    },
    UI_SHOW_LEGEND(state) {
      return state.showLegend;
    },
  },
  mutations: {
    UI_AUTO_SAVE_DIALOG_SET(state, val) {
      state.autoSavedViewDialog = val;
    },
    UI_INTERACTOR_SET(state, val) {
      state.interactor = val;
    },
    UI_PAUSE_GALLERY_SET(state, val) {
      state.galleryPaused = val;
    },
    UI_SHOW_LOAD_DIALOG_SET(state, val) {
      state.showLoadDialog = val;
    },
    UI_SHOW_SAVE_DIALOG_SET(state, val) {
      state.showSaveDialog = val;
    },
    UI_RENDER_WINDOW_SET(state, val) {
      state.renderWindow = val;
    },
    UI_ZOOM_SYNC_SET(state, val) {
      state.zoomSync = val;
    },
    UI_TIME_STEP_SELECTOR_SET(state, val) {
      state.timeStepSelection = val;
    },
    UI_RENDERER_COUNT_SET(state, val) {
      state.rendererCount = val;
    },
    UI_SHOW_CONTEXT_MENU_SET(state, val) {
      state.contextMenu = val;
    },
    UI_CONTEXT_MENU_ITEM_DATA_SET(state, val) {
      state.contextMenuItemData = val;
    },
    UI_SHOW_DOWNLOAD_OPTIONS_SET(state, val) {
      state.showDownloadOptions = val;
    },
    UI_BOX_SELECTOR_SET(state, val) {
      state.boxSelector = val;
    },
    UI_SHOW_SETTINGS_SET(state, val) {
      state.showSettings = val;
    },
    UI_AUTO_SAVE_DIALOG_ENABLED_SET(state, val) {
      state.autoSavedViewDialogEnabled = val;
    },
    UI_USE_RUN_GLOBALS_SET(state, val) {
      state.useRunGlobals = val;
    },
    UI_SHOW_X_AXIS_SET(state, val) {
      state.showXAxis = val;
    },
    UI_SHOW_Y_AXIS_SET(state, val) {
      state.showYAxis = val;
    },
    UI_SHOW_SCALAR_BAR_SET(state, val) {
      state.showScalarBar = val;
    },
    UI_SHOW_TITLE_SET(state, val) {
      state.showTitle = val;
    },
    UI_SHOW_LEGEND_SET(state, val) {
      state.showLegend = val;
    },
  },
  actions: {
    UI_TOGGLE_PLAY_PAUSE({ state }) {
      state.galleryPaused = !state.galleryPaused;
    },
    UI_TOGGLE_ZOOM_SYNC({ state }) {
      state.zoomSync = !state.zoomSync;
    },
    UI_TOGGLE_TIME_STEP({ state }) {
      state.timeStepSelection = !state.timeStepSelection;
    },
    UI_TOGGLE_SHOW_SETTINGS({ state }) {
      state.showSettings = !state.showSettings;
    },
    UI_TOGGLE_RUN_GLOBALS({ state }) {
      state.useRunGlobals = !state.useRunGlobals;
    },
    UI_TOGGLE_X_AXIS({ state }) {
      state.showXAxis = !state.showXAxis;
    },
    UI_TOGGLE_Y_AXIS({ state }) {
      state.showYAxis = !state.showYAxis;
    },
    UI_TOGGLE_SCALAR_BAR({ state }) {
      state.showScalarBar = !state.showScalarBar;
    },
    UI_TOGGLE_TITLE({ state }) {
      state.showTitle = !state.showTitle;
    },
    UI_TOGGLE_LEGEND({ state }) {
      state.showLegend = !state.showLegend;
    },
  },
};
