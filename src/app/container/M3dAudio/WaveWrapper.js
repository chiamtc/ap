import style from './util/Style';
import {subjects} from "./M3dAudio";
import _ from 'lodash';

export default class WaveWrapper {

    constructor(params) {
        //container which is to hold wrapper and wrapper's subsequent elements
        this.container_id = params.container_id;
        this._container = null;

        //wrapper params, the main element to have interaction registered and physical attributes (w,h)
        this.height = params.height;
        this.width = 0;

        this._mainWave_wrapper = null;

        this._progressWave_wrapper = null;

        this.normalize = params.normalize || false;
        this.lastPos = 0;
        this.fill = params.fill || true; //boolean indication to display whole wave
        this.scroll = params.scroll || false; //boolean indication to allow scrolling horizontally
        this.autoCenter = true; //hardcoded
        this.pixelRatio = params.pixelRatio || 1;
        this.amplitude = params.amplitude || 1;
        this.wave_canvas = null;
        this.maxCanvasWidth = params.maxCanvasWidth || 4000; //4k

        this.mainWaveStyle = params.mainWaveStyle;
        this.progressWaveStyle = params.progressWaveStyle;
        this.cursorStyle = params.cursorStyle
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
        this.addCursor();
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
        subjects.waveWrapper_state.next({type: e.type, progress});
    }

    getWidth() {
        return Math.round(this.container.clientWidth * this.pixelRatio);
    }

    setWidth(width) {
        if (this.width === width) return false;

        this.width = width;

        if (this.fill || this.scroll) style(this.mainWave_wrapper, {width: ''});
        else style(this.mainWave_wrapper, {width: ~~(this.width / this.pixelRatio) + 'px'});

        this.updateSize();
        return true;
    }

    renderProgressWave(progress) {
        const minPxDelta = 1 / this.pixelRatio;
        const pos = Math.round(progress * this.width);

        if (pos < this.lastPos || pos - this.lastPos >= minPxDelta) {
            this.lastPos = pos;
            if (this.scroll && this.autoCenter) {
                const newPos = ~~(this.mainWave_wrapper.scrollWidth * progress);
                this.recenterOnPosition(newPos, true);
            }
            style(this.progressWave_wrapper, {display: 'block', width: `${pos}px`});
        }
    }

    prepareDraw(peaks, channelIndex, start, end, fn) {
        return requestAnimationFrame(() => {
            // calculate maximum modulation value, either from the barHeight
            // parameter or if normalize=true from the largest value in the peak
            // set
            let absmax = 1 / this.amplitude;
            if (this.normalize) {
                const max = _.max(peaks);
                const min = _.min(peaks);
                absmax = -min > max ? -min : max;
            }

            // Bar wave draws the bottom only as a reflection of the top,
            // so we don't need negative values
            const hasMinVals = [].some.call(peaks, val => val < 0);
            const height = this.height * this.pixelRatio;
            const offsetY = height * channelIndex || 0;
            const halfH = height / 2;

            return fn({
                absmax: absmax,
                hasMinVals: hasMinVals,
                height: height,
                offsetY: offsetY,
                halfH: halfH,
                peaks: peaks
            });
        });
    }

    drawWave(peaks, channelIndex, start, end) {
        this.wave_canvas.clearWave();
        this.setContextStyles();
        return this.prepareDraw(
            peaks,
            channelIndex,
            start,
            end,
            ({absmax, hasMinVals, height, offsetY, halfH, peaks}) => {
                if (!hasMinVals) {
                    const reflectedPeaks = [];
                    const len = peaks.length;
                    let i = 0;
                    for (i; i < len; i++) {
                        reflectedPeaks[2 * i] = peaks[i];
                        reflectedPeaks[2 * i + 1] = -peaks[i];
                    }
                    peaks = reflectedPeaks;
                }

                // if drawWave was called within ws.empty we don't pass a start and
                // end and simply want a flat line
                if (start !== undefined) this.drawLine(peaks, absmax, halfH, offsetY);

                this.wave_canvas.mainWave_ctx.fillRect(start, this.height / 2, this.width, 1);
            }
        );
    }

    drawLine(peaks, absmax, halfH, offsetY) {
        this.wave_canvas.drawLine(peaks, absmax, halfH, offsetY);
    }

    recenterOnPosition(position, immediate) {
        const scrollLeft = this.mainWave_wrapper.scrollLeft;
        //if canvas is zoomed to certain px.
        // scrollLeft is updated while playing
        // clientWidth is constant 600px
        // scrollWidth is the width after being zoomed
        const half = ~~(this.mainWave_wrapper.clientWidth / 2); //300
        const maxScroll = this.mainWave_wrapper.scrollWidth - this.mainWave_wrapper.clientWidth; //maximum value to scroll aka, the end usually
        let target = position - half;
        let offset = target - scrollLeft;

        if (maxScroll === 0) return;

        // if the cursor is currently visible... //not executed if I dont set immediate
        if (!immediate && -half <= offset && offset < half) {
            // set rate at which waveform is centered
            let rate = 5; //tweakable

            // make rate depend on width of view and length of waveform
            rate /= half;
            rate *= maxScroll;

            offset = Math.max(-rate, Math.min(rate, offset));
            target = scrollLeft + offset;
        }

        // limit target to valid range (0 to maxScroll)
        target = Math.max(0, Math.min(maxScroll, target));
        // no use attempting to scroll if we're not moving
        if (target != scrollLeft) {
            this.mainWave_wrapper.scrollLeft = target;
        }
    }

    //this function adds initialised canvases from m3daudio to this class so that it could update dimension of canvases in updateSize()
    //reasons 1. one wrapper can have multiple canvases 2. canvas' job is to clear and draw lines nothing to do with wrapper's updating size. 3. wrapper updates size followed by canvases 4. most properties used to update canvases size is in wrapper class
    addCanvases(waveCanvas) {
        this.wave_canvas = waveCanvas;
        this.mainWave_wrapper.appendChild(waveCanvas.mainWave_canvas);
        this.progressWave_wrapper.appendChild(waveCanvas.progressWave_canvas);
        //only allows user to set canvas background
        this.setCanvasStyles()
    }

    setContextStyles() {
        //ctx
        this.wave_canvas.setCtxWaveFillStyles(this.mainWaveStyle, this.progressWaveStyle);
    }

    setCanvasStyles() {
        //canvas
        this.wave_canvas.setCanvasWaveBgStyles(this.mainWaveStyle, this.progressWaveStyle);
    }

    updateSize() {
        /* //used to be like this if we want to set overlap.
          let canvasWidth = this.maxCanvasWidth + this.overlap;
          canvasWidth = this.wave_wrapper.getWidth() - this.maxCanvasWidth * 0;
          */
        const elementWidth = Math.round(this.getWidth() / this.pixelRatio);
        const totalWidth = Math.round(this.getWidth() / this.pixelRatio);
        this.wave_canvas.updateDimensions(elementWidth, totalWidth, this.getWidth(), this.height);
    }

    addCursor() {
        style(this.progressWave_wrapper, {
            zIndex: 1,
            borderRightWidth: this.cursorStyle.borderRightWidth,
            borderRightColor: this.cursorStyle.borderRightColor
        });
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
