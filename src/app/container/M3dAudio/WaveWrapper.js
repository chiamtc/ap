import style from './util/Style';
import {subjects} from "./M3dAudio";

export default class WaveWrapper {

    constructor(params) {
        //container which is to hold wrapper and wrapper's subsequent elements
        this.container_id = params.container_id;
        this._container = null;

        //wrapper params, the main element to have interaction registered and physical attributes (w,h)
        this.height = params.height;
        this.width = params.width || 0;

        this._mainWave_wrapper = null;

        this._progressWave_wrapper = null;

        this.fill = params.fill || true; //boolean indication to display whole wave
        this.scroll = params.scroll || false; //boolean indication to allow scrolling horizontally
    }

    /**
     * //try to make mainWave_wrapper and progressWave_wrapper on the same level. Doable?
     *  - container
     *      - mainWave_wrapper //main wave
     *          - element1
     *          - progressWave_wrapper2 //progress wave
     *              - element2
     *          - etc_wrapper3 //other wrappers like timeline,regions
     *              - element3
     *
     */
    init() {
        this.createContainer();
        this.createMainWaveWrapper();
        this.createProgressWaveWrapper();
    }

    createContainer() {
        const container = document.querySelector(this.container_id);

        if (!container) {
            throw new Error("No container element id found. Pass container id as a string.")
        } else this._container = container;
    }

    createMainWaveWrapper() {
        const wrapper = document.createElement('mainwave');
        style(wrapper, {
            display: 'block',
            position: 'relative',
            height: `${this.height}px`,
            border:'1px solid black'
        });
        if (this.fill || this.scroll) {
            style(wrapper, {
                width: '100%',
                overflowX: 'auto',//always turn it on //this.hideScrollbar ? 'hidden' : 'auto',
                overflowY: 'hidden'
            });
        }
        this._mainWave_wrapper = this._container.appendChild(wrapper);
        this.register_mainWrapper_events();
    }

    register_mainWrapper_events() {
        this._mainWave_wrapper.addEventListener('click', (e) => {
            const scrollbarHeight =
                this._mainWave_wrapper.offsetHeight - this._mainWave_wrapper.clientHeight;
            if (scrollbarHeight !== 0) {
                // scrollbar is visible.  Check if click was on it
                const bbox = this._mainWave_wrapper.getBoundingClientRect();
                if (e.clientY >= bbox.bottom - scrollbarHeight) {
                    // ignore mousedown as it was on the scrollbar
                    return;
                }
            }
            // this.fireEvent('click', e, this.handleEvent(e)); //TODO: create a new global canvas subject and fire here
            this.handleEvent_mainWave(e);
        });

        this._mainWave_wrapper.addEventListener('dblclick', e => {
            // this.fireEvent('dblclick', e, this.handleEvent(e));  //TODO: create a new global canvas subject and fire here
        });

        /*   this._mainWave_wrapper.addEventListener('scroll', e => {
               // this.handleEvent_mainWave(e);
               // this.fireEvent('scroll', e) //TODO: create a new global canvas subject and fire here
           });*/
    }

    handleEvent_mainWave(e) {
        e.preventDefault();
        const clientX = e.targetTouches
            ? e.targetTouches[0].clientX
            : e.clientX;
        const bbox = this._mainWave_wrapper.getBoundingClientRect();
        const nominalWidth = this.width;
        const parentWidth = this.getWidth();

        let progress;
        if (!this.fill && nominalWidth < parentWidth) {
            progress = (clientX - bbox.left) * (this.pixelRatio / nominalWidth) || 0;
            if (progress > 1) progress = 1;
        } else {
            progress = ((clientX - bbox.left) + this.mainWave_wrapper.scrollLeft) / this.mainWave_wrapper.scrollWidth || 0;
        }
        subjects.waveWrapper_state.next({type:e.type, progress});
        // return progress; //return float point corresponding to the width of mainWave_wrapper
    }

    getWidth() {
        return Math.round(this.container.clientWidth * this.pixelRatio);
    }

    createProgressWaveWrapper() {
        const wrapper = document.createElement('progresswave');
        style(wrapper, {
            position: 'absolute',
            zIndex: 3,
            left: 0,
            top: 0,
            bottom: 0,
            overflow: 'hidden',
            width: '0',
            display: 'none',
            boxSizing: 'border-box',
            borderRightStyle: 'solid',
            pointerEvents: 'none'
        });
        //append progress wave onto mainWave_wrapper so that it doesn't clip outside of mainwave_wrapper since we're going to add backgroudncolor
        //reason: position absolute;
        /**
         * if we append using this.container. | = progresswave, l = mainwave
         *          |
         *    ______|_____
         *   l      |     l
         *   l______|_____l
         *          |
         *
         * if we append using this.mainWave_wrapper
         *
         *    ____________
         *   l      |     l
         *   l______|_____l
         */
        this._progressWave_wrapper = this.mainWave_wrapper.appendChild(wrapper);
    }

    get container() {
        return this._container;
    }

    set container(value) {
        this._container = value;
    }

    get mainWave_wrapper() {
        return this._mainWave_wrapper;
    }

    set mainWave_wrapper(value) {
        this._mainWave_wrapper = value;
    }

    get progressWave_wrapper() {
        return this._progressWave_wrapper;
    }

    set progressWave_wrapper(value) {
        this._progressWave_wrapper = value;
    }

}
