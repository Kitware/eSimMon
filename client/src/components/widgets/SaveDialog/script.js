import { saveLayout } from "../../../utils/utilityFunctions";

export default {
  inject: ['girderRest'],

  data() {
    return {
      newViewName: '',
      rules: {
        required: value => !!value || 'Required',
        unique: value => !this.viewNames.includes(value) || 'View name already exists.',
      },
      visibility: 'true',
      dialogOverwrite: false,
    };
  },

  props: {
    columns: {
      type: Number,
      default: 1,
    },
    currentStep: {
      type: Number,
      default: 1,
    },
    layout: {
      type: Array,
      default: () => [],
    },
    rows: {
      type: Number,
      default: 1,
    },
    visible: {
      type: Boolean,
      default: false,
    },
    viewInfo: {
      type: Object,
      default: () => ({}),
    },
    meta: {
      type: Object,
      default: () => ({}),
    },
  },

  computed: {
    saveDialog: {
      get () {
        return this.visible
      },
      set (value) {
        if (!value) {
          this.$emit('close')
          this.newViewName = ''
        }
      }
    },
    viewNames() {
      return Object.keys(this.viewInfo || {});
    }
  },

  methods: {
    save(newView) {
      const isPublic = (this.visibility === 'public');
      const formData = saveLayout(
        this.layout,
        this.newViewName,
        this.rows,
        this.columns,
        this.meta,
        this.currentStep,
        isPublic);
      if (newView) {
        this.girderRest.post('/view', formData);
      } else {
        const viewId = this.viewInfo[this.newViewName];
        this.girderRest.put(`/view/${viewId}`, formData);
      }
      this.saveDialog = false;
    },
    checkForOverwrite(event) {
      event.preventDefault()
      const name = this.newViewName;
      if (!!name && this.viewNames.includes(name)) {
        this.dialogOverwrite = true;
      } else {
        this.save(true);
      }
    },
  },
}