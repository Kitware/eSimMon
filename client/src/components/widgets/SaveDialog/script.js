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
      columns: "VIEW_COLUMNS",
      items: "VIEW_ITEMS",
      meta: "VIEW_METAS",
      rows: "VIEW_ROWS",
      visible: "UI_SHOW_SAVE_DIALOG",
      viewInfo: "VIEW_INFO",
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
      createView: "VIEW_CREATED",
      setItems: "VIEW_BUILD_ITEMS_OBJECT",
      updateView: "VIEW_UPDATE_EXISTING",
    }),
    ...mapMutations({
      setPublic: "VIEW_PUBLIC_SET",
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
