import { ref, computed, inject, watch } from "@vue/composition-api";
import { useActions, useGetters, useMutations } from "vuex-composition-helpers";

export default {
  setup(_props, { emit }) {
    const girderRest = inject("girderRest");

    const disableLoad = ref(true);
    const search = ref("");

    // Table headers
    const headers = computed(() => {
      return [
        { text: "View Name", value: "name" },
        { text: "First Name", value: "creatorFirst" },
        { text: "Last Name", value: "creatorLast" },
        { text: "Date Created", value: "created" },
        { text: "Actions", value: "actions", sortable: false },
      ];
    });

    // LoadDialog visiblity status
    const { visible } = useGetters({ visible: "UI_SHOW_LOAD_DIALOG" });
    const { setShowLoadDialog } = useMutations({
      setShowLoadDialog: "UI_SHOW_LOAD_DIALOG_SET",
    });
    const loadDialog = computed({
      get: () => visible.value,
      set: (value) => {
        setShowLoadDialog(value);
        if (!value) {
          emit("close");
        }
      },
    });

    // Filter the avilable views
    const activeTab = ref(0);
    const { views } = useGetters({ views: "VIEW_LIST_ALL" });
    function viewIsNotAutoSave(item) {
      const userId = girderRest.user._id;
      // Safe to assume the user did not create this view and it is an
      // auto-saved view for a run if it contains their userId
      return !item.name.includes(`_${userId}`);
    }
    function viewIsPublic(item) {
      return item ? item.public : false;
    }
    function viewCreatedByUser(item) {
      return girderRest.user._id === item.creatorId;
    }
    const filteredViews = computed(() => {
      return views.value.filter((item) => {
        const notAutoSave = viewIsNotAutoSave(item);
        const isPublic = viewIsPublic(item);
        const createdByUser = viewCreatedByUser(item);
        if (parseInt(activeTab.value) === 0) {
          return notAutoSave && (isPublic || createdByUser);
        } else {
          return notAutoSave && createdByUser;
        }
      });
    });

    // Support selecting row, clearing selection
    const selection = ref(null);
    const clicks = ref(0);
    function clearSelection() {
      selection.value = null;
      if (visible) {
        setShowLoadDialog(false);
      }
    }
    function rowSelected(selectedRow) {
      clicks.value++;
      selection.value = selectedRow;
      if (clicks.value === 1) {
        setTimeout(() => {
          clicks.value = 0;
        }, 200);
      } else {
        clicks.value = 0;
        load();
      }
    }
    function rowClass(item) {
      if (selection && selection.value && selection.value._id === item._id) {
        return "selectedRow";
      } else {
        return "";
      }
    }

    // Load the user selected view
    const { loadView } = useActions({ loadView: "VIEW_LOADED" });
    const { meta } = useGetters({ meta: "VIEW_META" });
    const canBeTemplate = ref(false);
    function load() {
      loadView(selection ? selection.value : selection);
      clearSelection();
    }
    function loadSelectedRow(_event, rowSelection) {
      selection.value = rowSelection.item;
      load();
    }
    watch(selection, (selected) => {
      canBeTemplate.value = false;
      if (selected && meta.value) {
        const { simulation, run } = selected.meta;
        const sameSimulation = simulation === meta.value.simulation;
        const differentRun = run !== meta.value.run;
        canBeTemplate.value = sameSimulation && differentRun;
      }
    });
    async function loadAsTemplate() {
      // Create a list of selection's item ids
      let templateView = {
        rows: selection.value.rows,
        columns: selection.value.columns,
        items: {},
        step: 1,
        meta: { ...meta.value },
      };

      async function asyncForEach(keys, values, callback) {
        for (let index = 0; index < values.length; index++) {
          const data = await callback(values[index]);
          templateView.items[`${keys[index]}`] = { id: data, zoom: null };
        }
      }

      const keys = Object.keys(selection.value.items);
      const values = Object.values(selection.value.items);
      await asyncForEach(keys, values, async (value) => {
        console.log("value: ", value);
        const response = await girderRest.get(`/item/${value.id}`);
        const run = meta.value.run;
        const name = response.data.name;
        const endpoint = `/resource/${run}/search?type=folder&q=${name}`;
        const result = await girderRest.get(endpoint);
        if (result.data && result.data.results.length) {
          return result.data.results[0].value._id;
        }
        return null;
      });

      loadView(templateView);
      clearSelection();
    }

    // Delete user created view
    const dialogDelete = ref(false);
    const { fetchAllViews } = useActions({
      fetchAllViews: "VIEW_FETCH_ALL_AVAILABLE",
    });
    async function deleteView() {
      dialogDelete.value = false;
      await girderRest
        .delete(`/view/${selection.value._id}`)
        .then(() => {
          fetchAllViews();
          selection.value = null;
        })
        .catch((error) => {
          console.log("error: ", error);
        });
    }

    // Toggle public/private status of view
    const dialogTogglePublic = ref(false);
    async function toggleViewStatus() {
      dialogTogglePublic.value = false;
      var formData = new FormData();
      formData.set("public", !selection.value.public);
      await girderRest
        .put(`/view/${selection.value._id}`, formData)
        .then(() => {
          fetchAllViews();
        })
        .catch((error) => {
          console.log("error: ", error);
        });
    }

    return {
      activeTab,
      canBeTemplate,
      clearSelection,
      deleteView,
      dialogDelete,
      dialogTogglePublic,
      disableLoad,
      filteredViews,
      headers,
      load,
      loadAsTemplate,
      loadDialog,
      loadSelectedRow,
      rowClass,
      rowSelected,
      search,
      selection,
      toggleViewStatus,
      viewCreatedByUser,
      viewIsPublic,
      views,
    };
  },
};
