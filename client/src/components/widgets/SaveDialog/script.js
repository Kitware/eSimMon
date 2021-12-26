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
      invalidInput: true,
      visibility: 'true',
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
    viewNames: {
      type: Array,
      default: () => [],
    }
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
    }
  },

  methods: {
    save() {
      const isPublic = (this.visibility === 'public');
      const formData = saveLayout(
        this.layout,
        this.newViewName,
        this.rows,
        this.columns,
        this.currentStep,
        isPublic);
      this.girderRest.post('/view', formData);
      this.saveDialog = false;
    },
  },

  watch: {
    newViewName(name) {
      if (!!name && this.viewNames.includes(name)) {
        this.invalidInput = true;
      } else {
        this.invalidInput = false;
      }
    },
  },
}