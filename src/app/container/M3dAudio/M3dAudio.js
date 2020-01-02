import WebAudio from "./WebAudio";
import WaveWrapper from './WaveWrapper';
import WaveCanvas from './WaveCanvas';
import HttpFetch from "./util/HttpFetch";
import {Subject} from "rxjs";

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
    }

    create(params) {
        //set m3daudio properties
        this.filters = params.filters;
        this.defaultFilter = params.filterId; //filterId recorded from mobile app

        //instantiations
        this.web_audio = new WebAudio();
        this.wave_wrapper = new WaveWrapper({container_id:params.container_id, height:200});
        this.wave_canvas = new WaveCanvas(this.wave_wrapper, {pixelRatio: window.devicePixelRatio, maxCanvasWidth:4000});

        //audio
        this.web_audio.init();
        subjects.webAudio_state.subscribe((i) => {
            this.web_audio_state = i;
            subjects.m3dAudio_state.next(i)
        });

        //wave_wrapper:HTMLElement
        this.wave_wrapper.init(); //TODO: put this in createWrapper() and listen to interaction via subject by subscribing to it

        //wave_cavnas:Canvas. wave_wrapper has to be initialised before wave_canvas.
        this.wave_canvas.init(); //TODO: put this in createCanvas() and listen to interaction via subject by subscribing to it
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

    playPause() {
        return this.web_audio.isPaused() ? this.play() : this.pause();
    }

    play(start, end) {
        console.log(this.web_audio.getPeaks(600, 0, 20))
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

    getCurrentTime(cb) {
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