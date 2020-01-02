import WebAudio from "./WebAudio";
import WaveWrapper from './WaveWrapper';
import WaveCanvas from './WaveCanvas';
import HttpFetch from "./util/HttpFetch";
import {Subject} from "rxjs";

//tobe removed :experimental only
import style from './util/Style';

export const subjects = {
    m3dAudio_state: new Subject(),
    webAudio_scriptNode_onaudioprocess: new Subject(),
    webAudio_state: new Subject(),
    waveWrapper_state: new Subject()
};

class M3dAudio {
    constructor() {
        //abstraction class aka web api
        this.wave_wrapper = null; //wave_wrapper class
        this.web_audio = null; //webaudio class

        //audio
        this.array_buffer = null;
        this.audio_buffer = null;
        this.savedVolume = 1; //default 1
        this.isMuted = false; //default 1
        this.defaultFilter = null;
        this.filters = null;
        this.filterId = null;
        this.selectedFilter = null; //new filter selected by user
        this.web_audio_state = 'unready'; //default

        this.minPxPerSec = 20; //for zoom
        this.pixelRatio = window.devicePixelRatio || screen.deviceXDPI / screen.logicalXDPI;

    }

    create(params) {
        //set m3daudio properties
        this.filters = params.filters;
        this.defaultFilter = params.filterId; //filterId recorded from mobile app
        this.minPxPerSec = params.minPxPerSec;

        this.maxCanvasWidth = params.maxCanvasWidth || 4000; //4k
        this.maxCanvasElementWidth = Math.round(this.maxCanvasWidth / this.pixelRatio);

        //instantiations
        this.web_audio = new WebAudio();
        this.wave_wrapper = new WaveWrapper({
            container_id: params.container_id,
            height: 200,
            pixelRatio: this.pixelRatio,
        });
        this.wave_canvas = new WaveCanvas();

        //audio
        this.web_audio.init();

        //wave_wrapper:HTMLElement
        this.wave_wrapper.init(); //TODO: put this in createWrapper() and listen to interaction via subject by subscribing to it

        //wave_cavnas:Canvas. wave_wrapper has to be initialised before wave_canvas.
        this.wave_canvas.init(); //TODO: put this in createCanvas() and listen to interaction via subject by subscribing to it


        this.wave_wrapper.addCanvases(this.wave_canvas, this.wave_canvas.mainWave_canvas, this.wave_canvas.progressWave_canvas);

        //listeners
        subjects.webAudio_state.subscribe((i) => {
            this.web_audio_state = i;
            subjects.m3dAudio_state.next(i)
        });

        subjects.webAudio_scriptNode_onaudioprocess.subscribe((i) => {
            this.wave_wrapper.renderProgressWave(this.web_audio.getPlayedPercents());
        });

        subjects.waveWrapper_state.subscribe((i) => {
            switch (i.type) {
                case 'click':
                    this.seekTo(i.progress);
                    break;
                case 'dblclick':
                    break;
            }
        });
    }

    /*
    * 1. get arraybuffer from url
    * 2. decodeArraybuffer
    * 3. set clean buffer in webaudio.js for future reuse + create new buffersource
    * 4. apply filter using defaultFilter.
    * */
    async load(url) {
        const ab = await this.getArrayBuffer(url);
        this.loadArrayBuffer(ab);
    }

    async getArrayBuffer(url) {
        const fetcher = new HttpFetch({url});
        return await fetcher.fetchFile();
    }

    async loadArrayBuffer(arrayBuffer) {
        this.array_buffer = arrayBuffer;
        this.audio_buffer = await this.web_audio.decodeArrayBuffer(arrayBuffer);
        this.web_audio.loadAudioBuffer(this.audio_buffer);
        this.changeFilter(this.defaultFilter); //do not remove
        this.drawBuffer();
    }

    changeFilter(newFilterId) {
        if (this.web_audio_state === 'playing') {
            this.web_audio.pause();
        }
        if (newFilterId !== this.selectedFilter) {
            const newCoef = this.filters.find(f => f.filterID === newFilterId).coefficients;
            this.web_audio.applyFilter(newCoef);
            this.selectedFilter = newFilterId;
        }
    }

    drawBuffer() {
        const nominalWidth = Math.round(this.getDuration() * this.minPxPerSec * this.pixelRatio);
        const parentWidth = this.wave_wrapper.getWidth();
        let width = nominalWidth;
        // always start at 0 after zooming for scrolling : issue redraw left part
        let start = 0;
        let end = Math.max(start + parentWidth, width); //600 = Math.max between 600 and 400
        // Fill container
        if (this.wave_wrapper.fill && (!this.wave_wrapper.scroll || nominalWidth < parentWidth)) {
            width = parentWidth;
            start = 0;
            end = width;
        }
        let peaks = this.web_audio.getPeaks(width, start, end);

        //this is drawPeaks in ws
        /**
         *  drawPeaks() {
                 if (!this.setWidth(length)) { //setWidth() { ... updatesize() ...}
                    this.clearWave();
                }
                this.params.barWidth ? this.drawBars(peaks, 0, start, end) : this.drawWave(peaks, 0, start, end);
                   }
         */
        /**
                1. set wrapper width -
                2. updates canvas size based on wrapper's width -
                3. clear the canvas and draw again
         setWidth(){
            updatesize() {... canvas.updateDimension() ...}
         }
         */
        this.wave_wrapper.setWidth(width);
        this.wave_canvas.clearWave();
        // this.wave_canvas.drawLines(peaks, 0, start, end); //TODO << draw
    }

    playPause() {
        return this.web_audio.isPaused() ? this.play() : this.pause();
    }

    play(start, end) {
        // this.fireEvent('interaction', () => this.play(start, end));
        if (this.isMuted) this.web_audio.setGain(0);
        this.web_audio.setGain(this.savedVolume);
        return this.web_audio.play(start, end);
    }

    pause() {
        if (!this.web_audio.isPaused()) {
            return this.web_audio.pause();
        }
    }

    setVolume(value) {
        this.savedVolume = value;
        if (this.savedVolume === 0) this.isMuted = true;
        this.isMuted = false;
        this.web_audio.setGain(this.savedVolume);
    }

    getVolume() {
        return this.web_audio.getGain();
    }

    getDuration() {
        return this.web_audio.getDuration()
    }

    getCurrentTime() {
        return this.web_audio.getCurrentTime();
    }

    seekTo(seekToTime) {
        //TODO: commented block from ws, check them
        const paused = this.web_audio.isPaused();
        if (!paused) this.web_audio.pause(); //pause and render, it's paused in webaudio.addOnAudioProcess() 2nd if else clause
       /* const oldScrollParent = this.params.scrollParent;
        this.params.scrollParent = false;*/
        this.web_audio.seekTo(seekToTime * this.getDuration());
        this.wave_wrapper.renderProgressWave(seekToTime); //TODO: setTimeout ?
         if (!paused) this.web_audio.play();
        // this.params.scrollParent = oldScrollParent;
    }

    getOnAudioProcessTime(cb) {
        subjects.webAudio_scriptNode_onaudioprocess.subscribe((res) => {
            const percent = this.web_audio.getPlayedPercents() * 100;
            cb({percent: percent.toFixed(2), ms: res.toFixed(2)});
        });
    }
}

//seems like this repo has all fft win func https://github.com/markert/fili.js/blob/master/src/fft.js
//good read: https://gist.github.com/chrisguttandin/e49764f9c29376780f2eb1f7d22b54e4
//biquad filter read: http://www.earlevel.com/main/2003/02/28/biquads/ // this has most of the implementation on coefs in central until
/*
y = x * biquad[0] + z111;
z111 = z222 – biquad[3] * y;
z222 = x * biquad[2] – biquad[4] * y;
 */

//webaudio api gain node, filter and etc etc https://www.html5rocks.com/en/tutorials/webaudio/intro/
//webaudio api example and demo https://webaudioapi.com/samples/ , github repo: https://github.com/borismus/webaudioapi.com/blob/master/content/posts/filter/filter-sample.js
//peaks.js is another good competitor compared to ws https://github.com/bbc/peaks.js
export default M3dAudio;
