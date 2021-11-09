export default {
    inject: ['girderRest'],

    data() {
      return {
        newStart: 0.0,
        newEnd: 0.0,
        invalidInput: true,
      };
    },
    props: {
      param: {
        type: String,
        default: '',
      },
      visible: {
        type: Boolean,
        default: false,
      }
    },
    computed: {
      settingsDialog: {
        get () {
          return this.visible;
        },
        set (value) {
          if (!value) {
            this.$emit('close');
          }
        }
      }
    },
    methods: {
      save() {
        const range = this.newEnd - this.newStart;
        if (range < 1) {
          this.$root.$children[0].$emit('range-updated', null);
        } else {
          this.$root.$children[0].$emit(
            'range-updated', [this.newStart, this.newEnd]);
        }
        this.settingsDialog = false;
      },
      clear() {
        this.newStart = 0.0;
        this.newEnd = 0.0;
      },
      checkValidity() {
        if (parseFloat(this.newStart) <= parseFloat(this.newEnd)) {
          this.invalidInput = false;
        } else {
          this.invalidInput = true;
        }
      }
    },
  }