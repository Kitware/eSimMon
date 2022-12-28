import Vue from "vue";
import App from "./components/core/App";
import Vuex from "vuex";
import Girder, { RestClient, vuetify } from "@girder/components/src";
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

  const defaultLocation = { _modelType: "folder", _id: null };
  const girderRest = new RestClient({ apiRoot, authenticateWithCredentials });
  girderRest.get("/collection?text=eSimMon").then((collections) => {
    // The dashboard will always use the eSimMon collection to collect all data
    let id = collections.data[0]._id;
    girderRest
      .get(`/folder?parentType=collection&parentId=${id}`)
      .then((folders) => {
        // The eSimMon collection should have a single folder that contains all
        // data and serves as the top-level directory.
        defaultLocation._id = folders.data[0]._id;
      });
  });

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
