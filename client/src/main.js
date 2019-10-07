import Vue from 'vue'
import Vuetify from 'vuetify/lib'
import Girder, { utils, RestClient } from '@girder/components/src';

let vuetifyConfig = utils.vuetifyConfig;
vuetifyConfig.icons.logout = 'mdi-logout';
Vue.use(Vuetify, vuetifyConfig);
Vue.use(Girder);
const girderRest = new RestClient({ apiRoot: `${window.location}/api/v1` });
const defaultLocation = { _modelType: 'folder', _id: '5ceeb68e8d777f072bf261ed' };

import App from './App.vue'

Vue.config.productionTip = false

girderRest.fetchUser().then(() => {
  new Vue({
    provide: { girderRest, defaultLocation },
    render: h => h(App),
  }).$mount('#app')
});
