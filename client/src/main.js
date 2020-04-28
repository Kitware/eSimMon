import Vue from 'vue'
import Girder, { RestClient, vuetify } from '@girder/components/src';
import {isNil} from 'lodash';

Vue.use(Girder);

let apiRoot = `${window.location}/api/v1`
let authenticateWithCredentials = false;
if (!isNil(process.env.VUE_APP_API_URL)) {
  apiRoot = process.env.VUE_APP_API_URL;
  authenticateWithCredentials = true;
}

let folderId = '5e722acfaf2e2eed3548fc3d';
if (!isNil(process.env.VUE_APP_FOLDER_ID)) {
  folderId = process.env.VUE_APP_FOLDER_ID;
}

const girderRest = new RestClient({ apiRoot, authenticateWithCredentials });
const defaultLocation = { _modelType: 'folder', _id: folderId };

import App from './App.vue'

Vue.config.productionTip = false

girderRest.fetchUser().then(() => {
  new Vue({
    provide: { girderRest, defaultLocation },
    vuetify,
    render: h => h(App),
  }).$mount('#app')
});
