import WebAudio from "./WebAudio";
import WaveWrapper from './WaveWrapper';
import WaveCanvas from './WaveCanvas';
import HttpFetch from "./util/HttpFetch";
import {Subject} from "rxjs";
import WaveTimeline from "./WaveTimeline";
import {debounceTime} from 'rxjs/operators'
import {fromEvent} from 'rxjs';
import Spectrogram from "./Spectrogram";
import {READY, CLICK, RESIZE, UNREADY, TIMELINE, SPECTROGRAM, ZOOM, PLAYING, CHANGE_FILTER} from "./constants";
export const subjects = {
    /**
     * @title m3dAudio_state
     * @description event indicator from webaudio.js (currently) to frontend consumer for ui rendering or something
     * @format event:String , refers all the constants from constants/index.js
     * @example .next(constants.PLAYING)
     * @example .subscribe(state=> console.log(state)) //returns 'PLAYING'
     * @currentUsage READY, PLAYING, PAUSED, FINISHED
     * */
    m3dAudio_state: new Subject(),
    /**
     * @title m3dAudio_control
     * @description external control that affects the wrapper. This is not to confuse with event that can be emitted from wrapper, which via Window or DOM API
     * @format {type: event:String, value:Object} for .next(params) and when subscribing
     * @example .next({type:'zoom', value:{level:x:Number}})
     * @example .subscribe((res)=> console.log(res)) //returns {type:'zoom', value:{level:21}}
     * @currentUsage 'zoom'
     * */
    m3dAudio_control: new Subject(),
    /**
     * @title webAudio_scripNode_onaudioprocess
     * @description event subscription from ScriptProcessorNode.onaudioprocess
     * @format value:Number , typically a float number from ScriptProcessorNode
     * @example .next(controlEvent)
     * @example .subscribe(controlEvent => console.log(controlEvent)) //returns 0.011239103912
     * @currentUsage from webaudio.js and returns audioContext.currentTime in float number
     * */
    webAudio_scriptNode_onaudioprocess: new Subject(), //WEB_AUDIO: time in float
    /**
     * @title webAudio_state
     * @description event indicator from webaudio.js
     * @format event:String , refers all the constants from constants/index.js
     * @example .next(constants.PLAYING)
     * @example .subscribe(state=> console.log(state)) //returns 'PLAYING'
     * @currentUsage READY, PLAYING, PAUSED, FINISHED
     * */
    webAudio_state: new Subject(),
    /**
     * @title waveWrapper_state
     * @description event indicator from waveWrapper.js.handleEvent_mainWave(e)
     * @format {event:String, value:Number}. Note: event is WindowEvent
     * @example .next({event:String, value:Number})
     * @example .subscribe(e=> console.log(e)) //returns {event:'click', value:0.51312}
     * @currentUsage event/e = 'click':WindowEvent
     * */
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
        this.web_audio_state = UNREADY; //default
        this.fill = true;
        this.scroll = false;
        this.minPxPerSec = 20; //for zoom
        this.pixelRatio = window.devicePixelRatio || screen.deviceXDPI / screen.logicalXDPI;
        this.plugins = [];
        this.previousWidth = 0;
        this.responsive = false;
    }

    create(params) {
        this.setRequiredParams(params);
        this.instantiate(params);
        this.init();
        this.initListeners(params);
        this.wave_wrapper.addCanvases(this.wave_canvas);
    }

    setRequiredParams(params) {
        //set m3daudio properties. url param is passed via a function call, im not setting it unless we want to cache eagerly and store it in indexedDB on client's pc
        this.filters = params.filters;
        this.defaultFilter = params.filterId; //filterId recorded from mobile app
        this.plugins = params.plugins;
        this.responsive = params.responsive;
        this.minZoom = params.minZoom;
        this.maxZoom = params.maxZoom;
        this.minPxPerSec = params.minZoom;
    }

    instantiate(params) {
        //instantiations
        this.web_audio = new WebAudio();
        this.wave_wrapper = new WaveWrapper({
            container_id: params.container_id,
            height: params.height,
            pixelRatio: this.pixelRatio,
            amplitude: params.amplitude,
            fill: this.fill,
            scroll: this.scroll,
            normalize: false,
            mainWaveStyle: params.mainWaveStyle,
            progressWaveStyle: params.progressWaveStyle,
            cursorStyle: params.cursorStyle,
        });
        this.wave_canvas = new WaveCanvas();
    }

    //call init() for fundamental building block for the entire m3daudio
    init() {
        this.web_audio.init();//web_audio:WebAudio
        this.wave_wrapper.init();//wave_wrapper:HTMLElement
        this.wave_canvas.init();//wave_canvas:Canvas
    }

    //listeners
    initListeners() {
        subjects.webAudio_state.subscribe((i) => {
            this.web_audio_state = i;
            if (i === READY) { //make it to switch statement if there's other mechanism other than 'ready'
                setTimeout(()=> this.createPlugins(), 0); //create plugin when webaudiostate is ready;
            }
            subjects.m3dAudio_state.next(i);
        });

        subjects.webAudio_scriptNode_onaudioprocess.subscribe((i) => {
            this.wave_wrapper.renderProgressWave(this.web_audio.getPlayedPercents())
        });

        subjects.waveWrapper_state.subscribe((i) => {
            switch (i.type) {
                case CLICK:
                    this.seekTo(i.value);
                    break;
                case RESIZE:
                    this.redraw();
                    break;
            }
        });

        if (this.responsive) {
            fromEvent(window, RESIZE).pipe(debounceTime(200))
                .subscribe((e) => {
                    if (this.previousWidth !== this.wave_wrapper.mainWave_wrapper.clientWidth) {
                        if (this.wave_wrapper.mainWave_wrapper.clientWidth >= 300) {
                            this.previousWidth = this.wave_wrapper.mainWave_wrapper.clientWidth;
                            subjects.waveWrapper_state.next({
                                type: RESIZE,
                                value: {width: this.wave_wrapper.mainWave_wrapper.clientWidth}
                            })
                        } else {
                            console.log(`window size is too small. current size: ${this.wave_wrapper.mainWave_wrapper.clientWidth}px`)
                            //TODO: make a notification saying it's way too small, a subject for audioplayer.js to subscribe
                        }
                    }
                });
        }
    }

    createPlugins() {
        this.plugins.map((plugin) => {
            switch (plugin.type) {
                case TIMELINE:
                    const t = new WaveTimeline(plugin.params, this);
                    t.init();
                    break;
                case SPECTROGRAM:
                    const p = new Spectrogram(plugin.params, this);
                    p.init();
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
        this.loadArrayBuffer(await this.getArrayBuffer(url));
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
    }

    changeFilter(newFilterId) {
        if (this.web_audio_state === PLAYING) {
            this.web_audio.pause();
        }
        if (newFilterId !== this.selectedFilter) {
            const newCoef = this.filters.find(f => f.filterID === newFilterId).coefficients;
            this.web_audio.applyFilter(newCoef);
            this.selectedFilter = newFilterId;
            this.drawBuffer();
            console.log('filter changed');
            subjects.m3dAudio_control.next({type: CHANGE_FILTER, value: {}})
        }
    }

    drawBuffer() {
        //determine changing width
        const nominalWidth = Math.round(this.getDuration() * this.minPxPerSec * this.pixelRatio);
        //mainwavewrapper width
        const parentWidth = this.wave_wrapper.getContainerWidth();

        //assign temporarily
        let width = nominalWidth;
        // always start at 0 after zooming for scrolling : issue redraw left part
        let start = 0;
        //determine whether parent or nominal width is bigger, if nominal width is bigger than parent width, resize;
        let end = Math.max(start + parentWidth, width);
        // Fill container
        if (this.fill && (!this.scroll || nominalWidth < parentWidth)) {
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
        // this.wave_canvas.clearWave(); //always clear wave before drawing, not so efficient. Used to apply it, i commented it out to see the performance differences as of date 07/01/2020
        this.wave_wrapper.drawWave(peaks, 0, start, end);
    }

    playPause() {
        return this.web_audio.isPaused() ? this.play() : this.pause();
    }

    play(start, end) {
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

    redraw() {
        this.drawBuffer();
        this.wave_wrapper.renderProgressWave(this.web_audio.getPlayedPercents());
    }

    zoom(level) {
        console.log('level',level)
        if (!level) {
            // this.minPxPerSec = this.minPxPerSec;
            this.scroll = false;
            this.wave_wrapper.scroll = false;
            this.wave_wrapper.autoCenter = false;
        } else {
            this.minPxPerSec = level;
            this.scroll = true;
            this.wave_wrapper.scroll = true;
            this.wave_wrapper.autoCenter = true; //has to be true otherwise, it will always center and renders the "selected" timeframe
        }
        this.redraw();
        this.wave_wrapper.recenter(this.getCurrentTime() / this.getDuration());
        subjects.m3dAudio_control.next({type: ZOOM, value: {scroll: true}})
    }

    seekTo(seekToTime) {
        const paused = this.web_audio.isPaused();
        if (!paused) this.web_audio.pause(); //pause and render, it's paused in webaudio.addOnAudioProcess() 2nd if else clause
        const oldScrollParent = this.scroll;
        this.scroll = false;
        this.web_audio.seekTo(seekToTime * this.getDuration());
        this.wave_wrapper.renderProgressWave(seekToTime); //TODO: setTimeout ?
        if (!paused) this.web_audio.play();
        this.scroll = oldScrollParent;
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
