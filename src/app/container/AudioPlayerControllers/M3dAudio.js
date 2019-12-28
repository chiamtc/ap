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
     /*   const input = this.audio_buffer.getChannelData(0).slice();
        const output = this.audio_buffer.getChannelData(0).slice();
        let _coef =  [
            {
                fb: [1, -0.203502967954, 0.002077921294],
                ff: [-0.500006496906, 0.500003695488, -0.00000753813]
            },
            {
                fb: [1, -0.210254460573, 0.010951761156],
                ff: [1.000003933907, 0.030092282221, 0.000140675664]
            },
            {
                fb: [1, 0.878565192223, 0.000505236792],
                ff: [0.251294931769, 0.01082280064, 0.000114870157]
            },
            {
                fb: [1, -1.759878754616, 0.908428549767],
                ff: [0.801160097122, 0.037218801677, 0.000310876989]
            },
            {
                fb: [1, -1.924331188202, 0.945789158344],
                ff: [0.065244078636, 0.002754359506, 0.000019586514]
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
        }*/
        // this.audio_buffer.copyToChannel(output, 0); //works but i think memory footprint is going to be really high
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