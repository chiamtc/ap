import {Observable} from "rxjs";
import {subjects} from './M3dAudio';
import {SUSPENDED, PLAYING, PAUSED, FINISHED} from './constants';

class WebAudio {
    static scriptBufferSize = 512;
    stateBehaviors = {
        [PLAYING]: {
            init() {
                this.addOnAudioProcess();
            },
            getPlayedPercents() {
                const duration = this.getDuration();
                return this.getCurrentTime() / duration || 0;
            },
            getCurrentTime() {
                return this.startPosition + this.getPlayedTime();
            }
        },
        [PAUSED]: {
            init() {
                this.removeOnAudioProcess();
            },
            getPlayedPercents() {
                const duration = this.getDuration();
                return this.getCurrentTime() / duration || 0;
            },
            getCurrentTime() {
                return this.startPosition;
            }
        },
        [FINISHED]: {
            init() {
                this.removeOnAudioProcess();
                subjects.webAudio_state.next(FINISHED);
                // this.fireEvent('finish'); //done
            },
            getPlayedPercents() {
                return 1;
            },
            getCurrentTime() {
                return this.getDuration();
            }
        }
    };

    constructor(params) {
        // this.subjects = subjects;
        this.buffer = null;
        this.audioContext = this.getAudioContext();
        this.offlineAudioContext = null;
        this.scriptNode = null; //AudioScriptProcessor
        this.source = null; //AudioBufferSourceNode
        this.states = {
            [PLAYING]: Object.create(this.stateBehaviors[PLAYING]),
            [PAUSED]: Object.create(this.stateBehaviors[PAUSED]),
            [FINISHED]: Object.create(this.stateBehaviors[FINISHED])
        };
        this.state = null;
        this.scheduledPause = null;
        this.startPosition = 0;
        this.lastPlay = this.audioContext.currentTime;
    }

    init() {
        this.createScriptNode();
        this.setState(PAUSED);
    }

    getAudioContext() {
        return new (window.AudioContext || window.webkitAudioContext)();
    }


    getOfflineAudioContext(sampleRate) {
        return new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 2, sampleRate);
    }

    decodeArrayBuffer(arrayBuffer) {
        if (!this.offlineAudioContext) {
            this.offlineAudioContext = this.getOfflineAudioContext(this.audioContext && this.audioContext.sampleRate ? this.audioContext.sampleRate : 44100);
        }
        //method 1: callback fn
        /*   this.offlineAudioContext.decodeAudioData(arrayBuffer, data => {
               cb(data);
           }, errorCb);*/

        //method 2: rxjs observable design pattern
        /*return new Observable(observer => {
                this.offlineAudioContext.decodeAudioData(arrayBuffer,
                    (value) => {
                        observer.next(value);
                        observer.complete();
                    },
                    (error) => observer.error(error)
                );
            });*/

        //method 3: rxjs -> promise
        return new Observable(observer => {
            this.offlineAudioContext.decodeAudioData(arrayBuffer,
                (value) => {
                    observer.next(value);
                    observer.complete();
                },
                (error) => observer.error(error)
            );
        }).toPromise();
    }

    //used to be load(), same as ws
    loadAudioBuffer(audioBuffer) {
        this.startPosition = 0;
        this.lastPlay = this.audioContext.currentTime;
        this.buffer = audioBuffer;
        this.createBufferSource();
    }

    createBufferSource() {
        this.disconnectBufferSource();
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.audioContext.destination);
        // this.source.start();
      /*  if (!this.offlineAudioContext) {
            this.offlineAudioContext = this.getOfflineAudioContext(this.audioContext && this.audioContext.sampleRate ? this.audioContext.sampleRate : 44100);
            this.offlineAudioContext.startRendering().then((buffer) => {
                console.log(buffer);
                let d = [0, 0]; //Array.apply(null, Array(ord)).map(Number.prototype.valueOf,0);
                let input = buffer.getChannelData(0);
                let outputBuff = audioContext.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate)

                let output = outputBuff.getChannelData(0);
                let maxes = [];
                for (let j = 0; j < _coef.length; j += 1) {
                    for (let i = 0; i < bufferSize; i++) {
                        output[i] = _coef[j].ff[0] * input[i] + d[0];
                        d[0] = _coef[j].ff[1] * input[i] - _coef[j].fb[1] * output[i] + d[1];
                        d[1] = _coef[j].ff[2] * input[i] - _coef[j].fb[2] * output[i];
                        input[i] = output[i];
                        maxes.push(output[i]);
                        output[i] = output[i] * gain;
                    }
                    d[0] = d[1] = 0;
                }
            })
        }*/

    }

    //used in init()
    createScriptNode() {
        if (this.audioContext.createScriptProcessor) {
            this.scriptNode = this.audioContext.createScriptProcessor(WebAudio.scriptBufferSize);
        }
        //TODO: create gain node and connects to audioContext.destination. Then, scriptNode connects to gainNode
        //Wavesurfer uses this idea.
        //1. gainNode connects to audioContext.destination
        //2. analyserNode connects to gainNode
        //3. scriptNode connects to analyserNode
        this.scriptNode.connect(this.audioContext.destination);
    }

    addOnAudioProcess() {
        return this.scriptNode.onaudioprocess = () => {
            const time = this.getCurrentTime();
            //TODO: add observable here for m3daudio to subscribe
            if (time >= this.getDuration()) {
                this.setState(FINISHED);
                subjects.webAudio_state.next(FINISHED);
                // this.fireEvent('pause'); //done
            } else if (time >= this.scheduledPause) {
                this.pause();
            } else if (this.state === this.states[PLAYING]) {
                subjects.webAudio_scriptNode_onaudioprocess.next(time);
                // this.fireEvent('audioprocess', time); //done
            }
        };
    }

    removeOnAudioProcess() {
        this.scriptNode.onaudioprocess = () => {
        };
    }

    play(start, end) {
        if (!this.buffer) return;

        // need to re-create source on each playback
        this.createBufferSource();

        const adjustedTime = this.seekTo(start, end);
        start = adjustedTime.start;
        end = adjustedTime.end;

        this.scheduledPause = end; //the supposedly finish time

        this.source.start(0, start);

        if (this.audioContext.state === SUSPENDED) {
            this.audioContext.resume && this.audioContext.resume();
        }

        this.setState(PLAYING);
        subjects.webAudio_state.next(PLAYING);
        // this.fireEvent('play'); //done
    }

    pause() {
        this.scheduledPause = null;

        this.startPosition += this.getPlayedTime();
        this.source && this.source.stop(0);

        this.setState(PAUSED);

        subjects.webAudio_state.next(PAUSED);
        // this.fireEvent('pause'); //done
    }

    isPaused() {
        return this.state !== this.states[PLAYING];
    }

    seekTo(start, end) {
        if (!this.buffer) return;

        this.scheduledPause = null;

        if (start == null) {
            start = this.getCurrentTime();
            if (start >= this.getDuration()) {
                start = 0;
            }
        }
        if (end == null) end = this.getDuration();

        this.startPosition = start;
        this.lastPlay = this.audioContext.currentTime;

        if (this.state === this.states[FINISHED]) this.setState(PAUSED);

        return {
            start: start,
            end: end
        };
    }

    setState(state) {
        if (this.state !== this.states[state]) {
            this.state = this.states[state];
            this.state.init.call(this);
        }
    }

    getCurrentTime() {
        return this.state.getCurrentTime.call(this);
    }

    getPlayedTime() {
        return (this.audioContext.currentTime - this.lastPlay);
    }

    getPlayedPercents() {
        return this.state.getPlayedPercents.call(this); //TODO: * 100 ?
    }

    getDuration() {
        if (!this.buffer) return 0;
        return this.buffer.duration;
    }

    //clear buffersource
    disconnectBufferSource() {
        if (this.source) this.source.disconnect();
    }

    //TODO: clone this.buffer and apply the coefs
    applyFilter() {

    }

}

export default WebAudio
// general flow of web audio processing
// 1. arraybuffer via http -> ArrayBuffer
// 2. audiocontext.decodeAudioDatat() -> AudioBuffer
// 3. pass audioBuffer to AudioBufferSourceNode via audioContext
// 4. then start() via source:AudioBufferSourceNode

//TODO: get the understanding of general play, pause and stop state
//TODO: get the understanding of drawing


/** caller class
 * [util]fetch -> [util]arraybuffer ->
 * [webaudio]ac.decodeArraybuffer() {[html]]decodeAudioData} ->
 * [webuaudio] setBuffer {this.buffer = buffer} && [webaudio]setofflineaudiocontext (){ new OfflineAudioContext(xx,xx,xx) } ->
 * [webaudio] createSource() { this.source = ac.createBufferSource(); this.source.buffer = this.buffer; this.source.connect(this.analyser); //maybe doens't need to connect to analyser;
 * //more about bufferSource property and stuffs} ->
 *
 * **/
/**
 * [ws] load() -> [ws]loadBuffer() -> [ws] getArrayBuffer() http -> arrayBuffer length  -> [ws] loadArrayBuffer() { -> [ws] decodeArrayBuffer () { [wa] decodeArrayBuffer... done? then [ws]loadDecodedBuffer.. -> [wa] load() -> createBufferSource() via offlinecontext}}
 */
