import {Observable} from "rxjs";
import {subjects} from './M3dAudio';
import {SUSPENDED, PLAYING, PAUSED, FINISHED} from './constants';
import {BELL_FILTER, HEART_FILTER, listOfFilter} from "./constants/filterschema";

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
        // this.analyserNode = null; //deprecated
        this.gainNode = null; //GainNode
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
        this.createGainNode();
        this.createScriptNode();
        // this.createAnalyserNode(); //deprecated
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
        console.log('d') //meaning done here. TODO: subject next() here
    }

    //https://chinmay.audio/iirfilter-workshop/ iirfilternode to check
    //b=[ 1, -1.2621407508850098, 0.8533923625946045, 1, -1.225411295890808, 0.612431526184082, 1, -1.7005388736724854, 0.7515528202056885, 1, -1.9520241022109985, 0.9528384208679199]
    //a=[0.1658635704779951, -0.17049753937028886, 0.004650211082637766, 0.6367747847741175, -0.655921592250425, 0.04247856434965213, 0.48852423462836897, 0.3494028802722561, 0.015667778677698384, 0.4142467303456515, -0.44225218786636344, 0.41445194667817475]

    /* part 1
      gainNode   -|
                 -|-> audiocontext.destination aka speaker
      scriptNode -|

       part 2
       audioContext.createBufferSource --> connect to all the audio effects filters --> audiocontext.destination aka speaker
     */
    createBufferSource() {
        this.disconnectBufferSource();
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.buffer;

        this.applyFilter();

        // not anymore
        // TODO : add this.source.connect(xxNode) //xxNode = audio effects filter. refs:https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
        //start end effects filter
        // this.source.connect(this.gainNode);
        //end effects filter

        //final step
        this.source.connect(this.audioContext.destination); //has to connect
    }

    //used in init()
    createScriptNode() {
        if (this.audioContext.createScriptProcessor) {
            this.scriptNode = this.audioContext.createScriptProcessor(WebAudio.scriptBufferSize);
        }
        this.scriptNode.connect(this.audioContext.destination);
    }


    createGainNode() {
        if (this.audioContext.createGain) {
            this.gainNode = this.audioContext.createGain();
        } else {
            this.gainNode = this.audioContext.createGainNode();
        }
        this.gainNode.connect(this.audioContext.destination);
    }

    //pretty useless atm due to usage of offlineaudiocontext and analyser node doesn't support it source:https://stackoverflow.com/questions/25368596/web-audio-offline-context-and-analyser-node
    /* createAnalyserNode() {
         this.analyserNode = this.audioContext.createAnalyser();
         this.analyserNode.connect(this.gainNode);

         //this chunk of code was placed in createBufferSource()
         // this.analyserNode.fftSize = 1024;
         // this.analyserNode.connect(this.audioContext.destination);
         // var data = new Uint8Array(this.analyserNode.frequencyBinCount);
         // console.log(this.analyserNode)
         // this.analyserNode.getByteFrequencyData(data);
     }*/

    addOnAudioProcess() {
        return this.scriptNode.onaudioprocess = () => {
            const time = this.getCurrentTime();
            //TODO: add observable here for m3daudio to subscribe //done
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

        //used when user pause, then mute then play again. aka mute while playing
        if (this.getGain() === 0) this.source.disconnect();
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

    getGain() {
        return this.gainNode.gain.value;
    }

    /* TODO
        - min value is 0, max value is ?? in this context that we set, by "we", I mean "me"
        - use of slider to set min and max value to 0 to ??
        - percentage is calculate using slider.currentValue/gain.maxValue * 100
        - some thought: min =0 , max = 10 then use DynamicsCompressorNode to prevent distortion and clipping. https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode
        references:
        gainNode.gain.minValue = https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/minValue
        gainNode.gain.maxValue = https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/maxValue
     */
    setGain(value) {
        this.gainNode.gain.value = value;
        value > 0 ? this.source.connect(this.gainNode) : this.source.disconnect();
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

    disconnectBufferSource() {
        if (this.source) this.source.disconnect();
    }

    //TODO: ~~clone this.buffer and apply the coefs~~ try using iirfilternode //done
    //TODO: clean up iirfilter when pause and changes of filter
    applyFilter() {
        const coef = BELL_FILTER.coefficients;

        coef.map((f, i) => {
            const iirFilter = this.audioContext.createIIRFilter(f.ff, f.fb);
            if (i === coef.length - 1) this.source.connect(iirFilter).connect(this.audioContext.destination);
            else this.source.connect(iirFilter);
        })
        //above loop is equivalent to below
        //I think codes below are better for changing filter via dropdown menu since changing filter only requires  iirFilter1 to be disconnected.
       /* const iirFilter1 = this.audioContext.createIIRFilter(coef[0].ff, coef[0].fb);
        const iirFilter2 = this.audioContext.createIIRFilter(coef[1].ff, coef[1].fb);
        const iirFilter3 = this.audioContext.createIIRFilter(coef[2].ff, coef[2].fb);
        const iirFilter4 = this.audioContext.createIIRFilter(coef[3].ff, coef[3].fb);
        this.source.connect(iirFilter1).connect(iirFilter2).connect(iirFilter3).connect(iirFilter4).connect(this.audioContext.destination)*/
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
