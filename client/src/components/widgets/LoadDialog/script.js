export default {
  inject: ['girderRest'],

  data () {
    return {
      activeTab: 0,
      clicks: 0,
      dialogDelete: false,
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
    meta: {
      type: Object,
      default: () => {},
    },
  },

  computed: {
    headers() {
      return [
        {text: 'View Name', value: 'name'},
        {text: 'First Name', value: 'creatorFirst'},
        {text: 'Last Name', value: 'creatorLast'},
        {text: 'Date Created', value: 'created'},
        {text: 'Actions', value: 'actions', sortable: false}
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
    },
    filteredViews() {
      return this.views.filter((item) => {
        const notAutoSave = this.viewIsNotAutoSave(item);
        const isPublic = this.viewIsPublic(item);
        const createdByUser = this.viewCreatedByUser(item);
        if (parseInt(this.activeTab) === 0) {
          return notAutoSave && (isPublic || createdByUser);
        } else {
          return notAutoSave && createdByUser;
        }
      })
    },
  },

  methods: {
    clearSelection() {
      this.selection = null;
      if (this.loadDialog) {
        this.loadDialog = false;
      }
    },
    async deleteView() {
      this.dialogDelete = false;
      await this.girderRest.delete(`/view/${this.selection._id}`)
        .then(() => {
          this.$parent.$emit('views-modified');
          this.selection = null;
        })
        .catch((error) => { console.log('error: ', error) });
    },
    load() {
      this.$root.$children[0].$emit('view-selected', this.selection);
      this.clearSelection();
    },
    async loadAsTemplate() {
      // Create a list of selection's item ids
      let templateView = {
        rows: this.selection.rows,
        columns: this.selection.columns,
        items: {},
        step: 1,
        meta: {...this.meta},
      }

      async function asyncForEach(keys, values, callback) {
        for (let index = 0; index < values.length; index++) {
          const data = await callback(values[index]);
          templateView.items[`${keys[index]}`] = data;
        }
      }

      const keys = Object.keys(this.selection.items);
      const values = Object.values(this.selection.items);
      await asyncForEach(keys, values, async(value) => {
        const response = await this.girderRest.get(`/item/${value}`);
        const run = this.meta.run;
        const name = response.data.name;
        const endpoint = `/resource/${run}/search?type=folder&q=${name}`;
        const result = await this.girderRest.get(endpoint);
        if (result.data && result.data.results.length) {
          return result.data.results[0].value._id;
        }
        return null;
      });

      this.$root.$children[0].$emit('view-selected', templateView);
      this.clearSelection();
    },
    rowSelected(selection) {
      this.clicks++;
      this.selection = selection;
      if (this.clicks === 1) {
        setTimeout(() => {
          this.clicks = 0;
        }, 200);
      } else {
        this.clicks = 0;
        this.load();
      }
    },
    loadSelectedRow(_event, selection) {
      this.selection = selection.item;
      this.load();
    },
    rowClass(item) {
      if (this.selection && this.selection._id === item._id) {
        return 'selectedRow';
      } else  {
        return '';
      }
    },
    viewCreatedByUser(item) {
      return this.girderRest.user._id === item.creatorId;
    },
    viewIsPublic(item) {
      if (item) {
        return item.public;
      }
      return false;
    },
    viewIsNotAutoSave(item) {
      const userId = this.girderRest.user._id;
      // Safe to assume the user did not create this view and it is an
      // auto-saved view for a run if it contains their userId
      const nameIncludes = item.name.includes(`_${userId}`);
      return !nameIncludes;
    },
    async toggleViewStatus() {
      this.dialogTogglePublic = false;
      var formData = new FormData();
      formData.set('public', !this.selection.public);
      await this.girderRest.put(`/view/${this.selection._id}`, formData)
        .then(() => {
          this.$parent.$emit('views-modified');
        })
        .catch((error) => { console.log('error: ', error) });
    },
    canBeTemplate() {
      if (this.selection && this.meta) {
        const { simulation, run } = this.selection.meta;
        return simulation === this.meta.simulation && run !== this.meta.run;
      }
      return false;
    },
  },
}
