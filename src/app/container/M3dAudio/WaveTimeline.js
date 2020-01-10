import style from "./util/Style";
import {subjects} from "./M3dAudio";
import {ZOOM} from "./constants";


class WaveTimeline {
    constructor(params, m3dAudio) {
        this.m3dAudio = m3dAudio;

        //container which is to hold wrapper and wrapper's subsequent elements
        this.container_id = params.container_id;
        this.container = null;
        this.wrapper = null;

        this.timelineCanvas = null;
        this.timelineCtx = null;
        //wrapper params, the main element to have interaction registered and physical attributes (w,h)
        this.height = params.height || 20; //height of the timeline default
        this.width = 0;
        this.fontFamily = params.fontFamily || 'Arial';
        this.fontSize = params.fontSize || 10;
        this.fontColor = params.fontColor || '#000000';
        this.fontWeight = params.fontWeight || 500;
        this.duration = null; //audio duration
        this.maxCanvasWidth = m3dAudio.wave_wrapper.maxCanvasWidth || 4000; //using parent's maxcanvaswidth or 4k as default
        this.maxCanvasElementWidth = 0; //using parent's maxcanvaswidth or 4k as default
        this.fill = true;
        this.scroll = true;
        this.drawer = null; //aka wrapper;
        this.direction = params.direction || 'bottom'; //export this to const?
        this.primaryInterval = params.interval || 5;

        this.displayInterval = params.displayInterval;
        this.strideWidth = params.strideWidth || 1;
    }

    /*
        1. create container
        2. create wrapper
        3. append wrapper to container
        4. create canvas
        5. create ctx on canvas for actual rendering/ drawing
        6. append canvas to wrapper
     */

    init() {
        this.setM3dAudioState();
        this.redrawTimeline();
        subjects.m3dAudio_control.subscribe((event) => {
            if (event.type === ZOOM) {
                this.scroll = event.value.scroll;
                this.clearTimeline();
                this.redrawTimeline();
                const scrolbarHeight = this.m3dAudio.wave_wrapper.height - this.m3dAudio.wave_wrapper.progressWave_wrapper.scrollHeight;
                if (this.direction === 'bottom') {
                    scrolbarHeight !== 0 ? style(this.container, {top: `-${this.height + scrolbarHeight}px`}) : style(this.container, {top: `-${this.height}px`})
                }
            }
        });
        this.m3dAudio.wave_wrapper.mainWave_wrapper.addEventListener('scroll', this.onScroll);
        subjects.waveWrapper_state.subscribe((res) => {
            this.clearTimeline();
            this.redrawTimeline();
        });
    }

    redrawTimeline() {
        this.createContainer();
        this.createWrapper();
        this.createCanvas();
        this.renderTimeline();
    }

    setM3dAudioState() {
        this.maxCanvasWidth = this.m3dAudio.wave_wrapper.maxCanvasWidth;
        this.fill = this.m3dAudio.fill;
        this.scroll = this.m3dAudio.scroll;
        this.drawer = this.m3dAudio.wave_wrapper;
        this.pixelRatio = this.m3dAudio.wave_wrapper.pixelRatio;
        this.maxCanvasElementWidth =
            this.drawer.maxCanvasElementWidth ||
            Math.round(this.maxCanvasWidth / this.pixelRatio);
    }

    createContainer() {
        const container = document.querySelector(this.container_id);
        if (!container) throw new Error("No container element id found. Pass container id as a string.");
        else this.container = container;
    }

    createWrapper() {
        if (!this.wrapper) {
            const wrapper = document.createElement('timeline');
            this.wrapper = this.container.appendChild(wrapper);
            //styling
            style(this.container, {
                display: 'block',
                position: 'relative',//this.direction === 'top' ? 'absolute' : 'relative', //absolute for top timeline display to clip and goes for bottom
                // height: `${this.height}px`,
                width: '100%',
            });

            switch (this.direction) {
                case 'top':
                    style(this.container, {top: `${this.height}px`});
                    break;
                case 'bottom':
                    style(this.container, {top: `-${this.height}px`});
                    break;
            }

            style(this.wrapper, {
                display: 'block',
                position: 'relative',//'relative',
                height: `${this.height}px`,
            });
        }

        if (this.m3dAudio.fill || this.m3dAudio.scroll) {
            style(this.wrapper, {
                width: '100%',
                overflowX: 'hidden',
                overflowY: 'hidden'
            });
        }
    }

    createCanvas() {
        const canvasEle = document.createElement('canvas');
        this.timelineCanvas = this.wrapper.appendChild(canvasEle);
        this.timelineCtx = this.timelineCanvas.getContext('2d', {desynchronized: true})
        this.setCanvasStyle();

        const canvasWidth = this.m3dAudio.wave_wrapper.mainWave_wrapper.scrollWidth - this.maxCanvasElementWidth * 0;
        canvasEle.width = canvasWidth * this.pixelRatio;
        canvasEle.height = (this.height + 1) * this.pixelRatio;
        style(this.timelineCanvas, {
            position: 'absolute',
            zIndex: 5,
            width: `${canvasWidth}px`,
            left: 0
        });
    }

    clearTimeline() {
        this.wrapper.removeChild(this.timelineCanvas);//not sure if it's efficient?
        // this.timelineCanvas.getContext('2d').clearRect(0,0,this.width, this.height);
    }

    setCanvasStyle() {
        this.setFontColor(this.fontColor);
        this.setFonts(this.fontSize, this.fontFamily);
        this.setFontWeight(this.fontWeight);
    }

    //TODO: make a new generic document/window event and extends from it
    //receives scroll event from mainwave_wrapper and update the scroll left
    onScroll = () => this.wrapper.scrollLeft = this.drawer.mainWave_wrapper.scrollLeft;


    renderTimeline() {
        this.setCanvasStyle();
        const duration = this.m3dAudio.web_audio.getDuration(); //total duration of the audio
        const width = this.fill && !this.scroll ? this.drawer.getContainerWidth() : this.drawer.getWidth();// : this.drawer.scrollWidth * this.pixelRatio;
        const primaryInterval = this.primaryInterval; //dynamic
        const primaryPxPerSec = width / duration;
        let primaryCurrentPixel = 0;
        let primaryCurrentSec = 0;
        let primaryPixels = [];
        for (let i = 0; i < duration / primaryInterval; i++) {
            primaryCurrentPixel += primaryPxPerSec * primaryInterval;
            primaryCurrentSec += primaryInterval;

            const labelPadding = primaryCurrentSec < 10 ? primaryCurrentPixel - 2 : primaryCurrentPixel - 5;
            if (i === (duration / primaryInterval) - 1) { //last
                this.renderPrimaryStride(primaryCurrentPixel - 2);
                this.renderPrimaryLabel(primaryCurrentSec, labelPadding - 10);
            } else {
                this.renderPrimaryStride(primaryCurrentPixel);
                this.renderPrimaryLabel(primaryCurrentSec, labelPadding)
            }
            primaryPixels.push(primaryCurrentPixel);
        }

        //start of rendering secondary stride
        let secondaryPxPerSec = primaryPixels[0] / primaryInterval; //get the secondary pxPerSec
        let secondaryCurrentPixel = 0;
        primaryPixels.map((p) => {
            for (let j = 0; j < duration / primaryPixels.length; j++) {
                if (j === 0) {
                    this.timelineCtx.fillRect(0, 0, this.strideWidth, this.height); //plot 0
                    this.displayInterval ? this.timelineCtx.fillText('0', 2, 8) : null;
                } else {
                    secondaryCurrentPixel += secondaryPxPerSec;
                    this.direction === 'top' ?
                        this.timelineCtx.fillRect(secondaryCurrentPixel, 0, this.strideWidth, this.height * 1 / 4) :
                        this.timelineCtx.fillRect(secondaryCurrentPixel, this.height * 3 / 4, this.strideWidth, this.height)
                }
            }
            secondaryCurrentPixel = p; //reset to the next primary Label
        })
    }

    renderPrimaryLabel(primaryCurrentSec, labelPadding) {
        this.displayInterval ? this.timelineCtx.fillText(primaryCurrentSec.toString(), labelPadding * this.pixelRatio, 8) : null;
    }

    renderPrimaryStride(primaryCurrentPixel) {
        this.direction === 'top' ? this.timelineCtx.fillRect(primaryCurrentPixel, 0, this.strideWidth, this.height) :
            this.timelineCtx.fillRect(primaryCurrentPixel, this.height / 2, this.strideWidth, this.height);
    }

    setFonts(fontSize, fontFamily) {
        //not working :(
        // this.timelineCanvas.getContext('2d').font = `${fontSize}px ${fontFamily}`;
        this.timelineCtx.font = `${fontSize}px ${fontFamily}`;
    }

    setFontWeight(fontWeight){
        this.timelineCtx.font = `${fontWeight} ${this.fontSize}px ${this.fontFamily}`;
    }

    setFontColor(fontColor){
        this.timelineCtx.fillStyle = fontColor;
    }
}

export default WaveTimeline;
