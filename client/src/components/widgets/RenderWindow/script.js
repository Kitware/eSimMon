// Load the rendering pieces we want to use (for both WebGL and WebGPU)
import '@kitware/vtk.js/Rendering/Profiles/Geometry';

import vtkRenderWindow from '@kitware/vtk.js/Rendering/Core/RenderWindow';
import vtkOpenGLRenderWindow from '@kitware/vtk.js/Rendering/OpenGL/RenderWindow';

import { mapGetters, mapMutations } from 'vuex';

export default {
  name: 'RenderWindow',

  data() {
    return {
      openglRenderWindow: null,
      rootContainer: null,
    };
  },

  methods: {
    ...mapMutations({
      setRenderWindow: 'UI_RENDER_WINDOW_SET',
    }),
    resize() {
      const { width, height } = this.$el.getBoundingClientRect();
      this.rootContainer.style.width = `${width}px`;
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
  },

  mounted() {
    // Single RenderWindow in fullscreen
    this.setRenderWindow(vtkRenderWindow.newInstance());
    this.openglRenderWindow = vtkOpenGLRenderWindow.newInstance();
    this.renderWindow.addView(this.openglRenderWindow);

    this.rootContainer = this.$el;
    this.openglRenderWindow.setContainer(this.rootContainer);
  
    window.addEventListener('resize', this.resize);
    this.resize();
    window.requestAnimationFrame(this.animate);
  },

  computed: {
    ...mapGetters({
      renderWindow: 'UI_RENDER_WINDOW',
    }),
  },
}
