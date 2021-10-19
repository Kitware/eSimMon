export default {
  data () {
    return {
      disableLoad: true,
      search: '',
      selection: null,
    };
  },

  props: {
    views: {
      type: Array,
      default: () => [],
    },
    visible: {
      type: Boolean,
      default: false,
    },
  },

  computed: {
    headers() {
      return [
        {text: 'View Name', value: 'name'},
        {text: 'Date Created', value: 'created'}
      ]
    },
    loadDialog: {
      get () {
        return this.visible;
      },
      set (value) {
        if (!value) {
          this.$emit('close');
        }
      }
    }
  },

  methods: {
    clearSelection() {
      this.selection = null;
      if (this.loadDialog) {
        this.loadDialog = false;
      }
    },
    load() {
      this.$root.$children[0].$emit('view-selected', this.selection);
      this.clearSelection();
    },
    rowSelected(selection) {
      this.selection = selection;
    },
    rowClass(item) {
      if (this.selection && this.selection._id === item._id) {
        return 'selectedRow';
      } else  {
        return '';
      }
    },
  },
}
