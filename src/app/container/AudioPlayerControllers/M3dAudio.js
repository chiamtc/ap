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
        const input = this.audio_buffer.getChannelData(0).slice();
        const output = this.audio_buffer.getChannelData(0).slice();
        let _coef =   [
        {
            fb: [1, -1.2621407508850098, 0.8533923625946045],
            ff: [0.1658635704779951, -0.17049753937028886, 0.004650211082637766]
        },
        {
            fb: [1, -1.225411295890808, 0.612431526184082],
            ff: [0.6367747847741175, -0.655921592250425, 0.04247856434965213]
        },
        {
            fb: [1, -1.7005388736724854, 0.7515528202056885],
            ff: [0.48852423462836897, 0.3494028802722561, 0.015667778677698384]
        },
        {
            fb: [1, -1.9520241022109985, 0.9528384208679199],
            ff: [0.4142467303456515, -0.44225218786636344, 0.41445194667817475]
        }
    ]
        let d = [0, 0];
        let maxes = [];
        for (let j = 0; j < _coef.length; j += 1) {
            for (let i = 0; i < this.audio_buffer.length; i++) {
                output[i] = _coef[j].ff[0] * input[i] + d[0];
                d[0] = _coef[j].ff[1] * input[i] - _coef[j].fb[1] * output[i] + d[1];
                d[1] = _coef[j].ff[2] * input[i] - _coef[j].fb[2] * output[i];
                input[i] = output[i];
                maxes.push(output[i]);
                output[i] = output[i];
            }
            d[0] = d[1] = 0;
        }
        this.audio_buffer.copyToChannel(output, 0); //works but i think memory footprint is going to be really high
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

//seems like this repo has all fft win func https://github.com/markert/fili.js/blob/master/src/fft.js
//good read: https://gist.github.com/chrisguttandin/e49764f9c29376780f2eb1f7d22b54e4
//biquad filter read: http://www.earlevel.com/main/2003/02/28/biquads/ // this has most of the implementation on coefs in central until
/*
y = x * biquad[0] + z111;
z111 = z222 – biquad[3] * y;
z222 = x * biquad[2] – biquad[4] * y;
 */

export default M3dAudio;