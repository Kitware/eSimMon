// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import "@kitware/vtk.js/Rendering/Profiles/Geometry";

import vtkRenderWindow from "@kitware/vtk.js/Rendering/Core/RenderWindow";
import vtkOpenGLRenderWindow from "@kitware/vtk.js/Rendering/OpenGL/RenderWindow";
import vtkRenderWindowInteractor from "@kitware/vtk.js/Rendering/Core/RenderWindowInteractor";
import vtkInteractorStyleManipulator from "@kitware/vtk.js/Interaction/Style/InteractorStyleManipulator";
import Manipulators from "@kitware/vtk.js/Interaction/Manipulators";

import { mapGetters, mapMutations } from "vuex";

export default {
  name: "RenderWindow",

  data() {
    return {
      openglRenderWindow: null,
      container: null,
    };
  },

  methods: {
    ...mapMutations({
      setInteractor: "UI_INTERACTOR_SET",
      setRenderWindow: "UI_RENDER_WINDOW_SET",
      setBoxSelector: "PLOT_BOX_SELECTOR_SET",
    }),
    resize() {
      const { width, height } = this.$el.getBoundingClientRect();
      this.openglRenderWindow.setSize(width, height);
      this.renderWindow.getRenderers().forEach((renderer) => {
        this.$nextTick(renderer.updateViewPort);
      });
      this.renderWindow.render();
    },
    animate() {
      this.renderWindow.render();
      window.requestAnimationFrame(this.animate);
    },
    resetAllZoom() {
      if (this.syncZoom && !this.selectTimeStep) {
        const allRenderers = this.$root.$children[0].$refs.imageGallery;
        allRenderers.forEach((plotCell) => {
          if (plotCell.renderer) {
            plotCell.resetZoom();
          }
        });
      }
    },
  },

  mounted() {
    // Single RenderWindow in fullscreen
    this.setRenderWindow(vtkRenderWindow.newInstance());
    this.openglRenderWindow = vtkOpenGLRenderWindow.newInstance();
    this.renderWindow.addView(this.openglRenderWindow);

    this.openglRenderWindow.setContainer(this.$el);

    // Create box selector for zooming
    this.setInteractor(vtkRenderWindowInteractor.newInstance());
    const boxSelector = Manipulators.vtkMouseBoxSelectorManipulator.newInstance(
      {
        button: 1,
      }
    );
    this.setBoxSelector(boxSelector);
    const iStyle = vtkInteractorStyleManipulator.newInstance();
    iStyle.addMouseManipulator(boxSelector);
    this.interactor.setInteractorStyle(iStyle);
    this.interactor.initialize();
    this.interactor.setView(this.openglRenderWindow);
    this.container = document.querySelector(".splitpanes__pane.main-content");
    this.interactor.bindEvents(this.container);
    this.interactor.disable();

    window.addEventListener("dblclick", this.resetAllZoom);
    window.addEventListener("resize", this.resize);
    this.resize();
    window.requestAnimationFrame(this.animate);
  },

  computed: {
    ...mapGetters({
      interactor: "UI_INTERACTOR",
      renderWindow: "UI_RENDER_WINDOW",
      renderersCount: "UI_RENDERER_COUNT",
      syncZoom: "UI_ZOOM_SYNC",
      selectTimeStep: "UI_TIME_STEP_SELECTOR",
    }),
  },

  watch: {
    renderersCount(count) {
      if (count) {
        this.openglRenderWindow.setContainer(this.$el);
        this.interactor.enable();
      } else {
        this.openglRenderWindow.setContainer(null);
        this.interactor.disable();
      }
    },
  },
};
