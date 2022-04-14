import Vue from "vue";
import Vuex from "vuex";
import Girder, { RestClient, vuetify } from "@girder/components/src";
import { isNil } from "lodash";
import VueMathjax from "vue-mathjax";
import store from "./store";

Vue.use(Girder);
Vue.use(VueMathjax);

let apiRoot = `${window.location}api/v1`;
let authenticateWithCredentials = false;
if (!isNil(process.env.VUE_APP_API_URL)) {
  apiRoot = process.env.VUE_APP_API_URL;
  authenticateWithCredentials = true;
}

var fastRestUrl = `http://localhost:5000/api/v1`;
if (!isNil(process.env.VUE_APP_FASTAPI_API_URL)) {
  fastRestUrl = process.env.VUE_APP_FASTAPI_API_URL;
}

let folderId = null;
if (!isNil(process.env.VUE_APP_FOLDER_ID)) {
  folderId = process.env.VUE_APP_FOLDER_ID;
}

const girderRest = new RestClient({ apiRoot, authenticateWithCredentials });
const defaultLocation = { _modelType: "folder", _id: folderId };

import App from "./components/core/App";

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
