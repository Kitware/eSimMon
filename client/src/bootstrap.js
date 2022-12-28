import Vue from "vue";
import App from "./components/core/App";
import Vuex from "vuex";
import Girder, { RestClient, vuetify } from "@girder/components/src";
import { isNil } from "lodash";
import VueMathjax from "vue-mathjax";
import store from "./store";

export function bootstrap() {
  Vue.use(Girder);
  Vue.use(VueMathjax);

  let apiRoot = `${window.location}api/v1`;
  let authenticateWithCredentials = false;

  var fastRestUrl = apiRoot;
  if (window.location.host === "esimmon.kitware.com") {
    fastRestUrl = `http://localhost:5000/api/v1`;
  }

  let folderId = null;
  if (!isNil(process.env.VUE_APP_FOLDER_ID)) {
    folderId = process.env.VUE_APP_FOLDER_ID;
  }

  const girderRest = new RestClient({ apiRoot, authenticateWithCredentials });
  const defaultLocation = { _modelType: "folder", _id: folderId };

  Vue.config.productionTip = false;
  Vue.use(Vuex);

  girderRest.fetchUser().then(() => {
    store.$girderRest = girderRest;
    new Vue({
      provide: { girderRest, defaultLocation, fastRestUrl },
      vuetify,
      store,
      render: (h) => h(App),
    }).$mount("#app");
  });
}
