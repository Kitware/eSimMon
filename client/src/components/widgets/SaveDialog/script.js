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
    };
  },

  props: {
    columns: {
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
    processLayout(formData) {
      const items = {}
      this.layout.forEach(item => {
        const { row, col } = item.$attrs;
        items[`${row}::${col}`] = item.itemId;
      });
      formData.set('items', JSON.stringify(items));
    },
    save() {
      var formData = new FormData();
      this.processLayout(formData);
      formData.set('name', this.newViewName);
      formData.set('rows', this.rows);
      formData.set('columns', this.columns);
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