import Vue from 'vue';
import Vuex from 'vuex';
import plots from './plots'
import ui from './ui'
import views from './views'

Vue.use(Vuex);

export default new Vuex.Store({
  modules: {
    plots,
    ui,
    views,
  },
});
