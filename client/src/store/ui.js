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
  },
};
