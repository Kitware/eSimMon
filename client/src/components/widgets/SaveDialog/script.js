import { mapActions, mapGetters, mapMutations } from "vuex";

export default {
  inject: ["girderRest"],

  data() {
    return {
      newViewName: "",
      rules: {
        required: (value) => !!value || "Required",
        unique: (value) =>
          !this.viewNames.includes(value) || "View name already exists.",
      },
      visibility: "true",
      dialogOverwrite: false,
    };
  },

  props: {
    layout: {
      type: Array,
      default: () => [],
    },
  },

  computed: {
    ...mapGetters({
      visible: "UI_SHOW_SAVE_DIALOG",
      columns: "VIEWS_COLUMNS",
      items: "VIEWS_ITEMS",
      meta: "VIEWS_METAS",
      rows: "VIEWS_ROWS",
      viewInfo: "VIEWS_INFO",
    }),
    saveDialog: {
      get() {
        return this.visible;
      },
      set(value) {
        this.setShowSaveDialog(value);
        if (!value) {
          this.$emit("close");
          this.newViewName = "";
        }
      },
    },
    viewNames() {
      return Object.keys(this.viewInfo || {});
    },
  },

  methods: {
    ...mapActions({
      createView: "VIEWS_CREATED",
      setItems: "VIEWS_BUILD_ITEMS_OBJECT",
      updateView: "VIEWS_UPDATE_EXISTING",
    }),
    ...mapMutations({
      setPublic: "VIEWS_PUBLIC_SET",
      setShowSaveDialog: "UI_SHOW_SAVE_DIALOG_SET",
    }),
    save(newView) {
      const isPublicView = this.visibility === "public";
      this.setPublic(isPublicView);
      this.setItems(this.layout);
      if (newView) {
        this.createView(this.newViewName);
      } else {
        this.updateView(this.newViewName);
      }
      this.setShowSaveDialog(false);
    },
    checkForOverwrite(event) {
      event.preventDefault();
      const name = this.newViewName;
      if (!!name && this.viewNames.includes(name)) {
        this.dialogOverwrite = true;
      } else {
        this.save(true);
      }
    },
  },
};
