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
  let fastRestUrl = "http://localhost:5000/api/v1";
  let authenticateWithCredentials = true;

  let deployment = window.location.hostname.split(".");
  deployment = deployment[deployment.length - 2];
  if (deployment === "kitware") {
    // AWS Deployment
    apiRoot = `https://api.${window.location.hostname}/api/v1`;
    fastRestUrl = apiRoot;
  } else if (deployment === "nersc") {
    // NERSC Deployment
    apiRoot = `https://${window.location.hostname}/api/v1`;
    fastRestUrl = apiRoot;
  } else {
    authenticateWithCredentials = false;
  }

  const defaultLocation = { _modelType: "folder", _id: null };
  const girderRest = new RestClient({ apiRoot, authenticateWithCredentials });

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
