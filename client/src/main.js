import Vue from 'vue'
import Girder, { RestClient, vuetify } from '@girder/components/src';
import {isNil} from 'lodash';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { ConcurrencyManager } from 'axios-concurrency';


Vue.use(Girder);

let apiRoot = `${window.location}/api/v1`
let authenticateWithCredentials = false;
if (!isNil(process.env.VUE_APP_API_URL)) {
  apiRoot = process.env.VUE_APP_API_URL;
  authenticateWithCredentials = true;
}

let flaskRest = `http://localhost:5000/api`
if (!isNil(process.env.VUE_APP_FLASK_API_URL)) {
  flaskRest = process.env.VUE_APP_FLASK_API_URL;
}

let folderId = '5e878dd32660cbefba885f22';
if (!isNil(process.env.VUE_APP_FOLDER_ID)) {
  folderId = process.env.VUE_APP_FOLDER_ID;
}
const client = axios.create();
ConcurrencyManager(client, 10);
axiosRetry(client, { retries: 5 });
const girderRest = new RestClient({ apiRoot, authenticateWithCredentials, axios: client });
const defaultLocation = { _modelType: 'folder', _id: folderId };

import App from './App.vue'

Vue.config.productionTip = false

girderRest.fetchUser().then(() => {
  new Vue({
    provide: { girderRest, defaultLocation, flaskRest},
    vuetify,
    render: h => h(App),
  }).$mount('#app')
});
