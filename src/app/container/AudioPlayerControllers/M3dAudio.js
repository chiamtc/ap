import WebAudio from "./WebAudio";
import HttpFetch from "./util/HttpFetch";
import {Subject} from "rxjs";

export const subjects = {
    webAudio_scriptNode_onaudioprocess: new Subject(),
    webAudio_state: new Subject(),
};

class M3dAudio {
    constructor(params) {
        this.web_audio = null;
        this.array_buffer = null;
        this.audio_buffer = null;
    }

    create() {
        this.web_audio = new WebAudio();
        this.web_audio.init();
        subjects.webAudio_state.subscribe((i) => console.log('status', i))
    }

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
    }

    playPause() {
        return this.web_audio.isPaused() ? this.play() : this.pause();
    }

    play(start, end) {
        // this.fireEvent('interaction', () => this.play(start, end));
        return this.web_audio.play(start, end);
    }

    pause() {
        if (!this.web_audio.isPaused()) {
            return this.web_audio.pause();
        }
    }

    getCurrentTime(cb) {
        subjects.webAudio_scriptNode_onaudioprocess.subscribe((res) => {
            const percent = this.web_audio.getPlayedPercents() * 100;
            cb({percent: percent.toFixed(2), ms: res.toFixed(2)});
        });
    }
}

export default M3dAudio;