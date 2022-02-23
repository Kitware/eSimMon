import Vuex from 'vuex';
import plots from './plots'
import ui from './ui'
import views from './views'


function createStore() {
  return new Vuex.Store({
    modules: {
      plots,
      ui,
      views,
    },
  });
}

export default createStore;
