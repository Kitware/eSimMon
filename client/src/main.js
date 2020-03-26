import Vue from 'vue'
import Girder, { RestClient, vuetify } from '@girder/components/src';
Vue.use(Girder);
const girderRest = new RestClient({ apiRoot: `${window.location}/api/v1` });
const defaultLocation = { _modelType: 'folder', _id: '5e722acfaf2e2eed3548fc3d' };

import App from './App.vue'

Vue.config.productionTip = false

girderRest.fetchUser().then(() => {
  new Vue({
    provide: { girderRest, defaultLocation },
    vuetify,
    render: h => h(App),
  }).$mount('#app')
});
