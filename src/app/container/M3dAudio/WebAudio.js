import {Observable} from "rxjs";
import {subjects} from './M3dAudio';
import {SUSPENDED, PLAYING, PAUSED, FINISHED,READY} from './constants';

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
                subjects.webAudio_state.next(FINISHED); //fire webAudio_state(FINISHED:string):Subscription event
            },
            getPlayedPercents() {
                return 1;
            },
            getCurrentTime() {
                return this.getDuration();
            }
        }
    };

    constructor() {
        //Named by category from https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API. Each property, if present in this class, is named by class
        //Some of them are not declared but initialised via audioContext
        //General Audio Graph Definition
        this.audioContext = this.getAudioContext(); //AudioContext
        this.offlineAudioContext = null; //OfflineAudioContext

        //Audio Sources
        this.buffer = null; //AudioBuffer, original buffer from firebase storage
        this.filteredBuffer = null; //AudioBuffer //filtered buffer

        //Audio Sources
        this.source = null; //AudioBufferSourceNode, responsible to play, stop etc

        //Audio Effects Filters
        this.gainNode = null; //GainNode
        this.compressorNode = null; //CompressorNode

        //Audio processing
        this.scriptNode = null; //AudioScriptProcessor

        //Data analysis and visualization
        //this.analyserNode = null; //deprecated AnalyserNode


        //states
        this.states = {
            [PLAYING]: Object.create(this.stateBehaviors[PLAYING]),
            [PAUSED]: Object.create(this.stateBehaviors[PAUSED]),
            [FINISHED]: Object.create(this.stateBehaviors[FINISHED])
        };
        //current state
        this.state = null;

        //finish time
        this.scheduledPause = null;
        //startPosition if audio is paused. default is 0. if filter is applied, it goes back to 0
        this.startPosition = 0;
        //current time of playing, it's used for pause()
        this.lastPlay = this.audioContext.currentTime;
        //loop the audio
        this.loop = false;

        this.mergedPeaks = null;
        this.splitPeaks = null;
        this.peaks = null;
    }

    init() {
        // this.createCompressorNode();
        this.createGainNode();
        this.createScriptNode();
        this.setState(PAUSED);
        // this.createAnalyserNode(); //deprecated
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
            this.audioContext.decodeAudioData(arrayBuffer,
                (value) => {
                    observer.next(value); //observer fires (value:AudioBuffer):Observable
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
        subjects.webAudio_state.next(READY); //fire webAudio_state(READY:string):Subscription event
    }

    createBufferSource() {
        this.disconnectBufferSource();
        this.source = this.audioContext.createBufferSource();
        // TODO : add this.source.connect(xxNode) //xxNode = audio effects filter. refs:https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
        //start end effects filter
        // this.source.connect(this.compressorNode);
        // this.compressorNode.connect(this.gainNode);
        //end effects filter

        //final step
        // this.gainNode.connect(this.audioContext.destination); //has to connect
        this.source.connect(this.audioContext.destination); //has to connect
    }

    //used in init()
    createScriptNode() {
        if (this.audioContext.createScriptProcessor) {
            this.scriptNode = this.audioContext.createScriptProcessor(WebAudio.scriptBufferSize);
        }
        this.scriptNode.connect(this.audioContext.destination);
    }

    createCompressorNode(){
        const compressor = this.audioContext.createDynamicsCompressor();
        compressor.threshold.value = -50;
        compressor.knee.value = 40;
        compressor.ratio.value = 100;
        compressor.attack.value = 0;
        compressor.release.value = 0.25;
        this.compressorNode = compressor;
    }

    createGainNode() {
        if (this.audioContext.createGain) this.gainNode = this.audioContext.createGain();
        else this.gainNode = this.audioContext.createGainNode();
        // this.compressorNode.connect(this.gainNode)
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
                subjects.webAudio_state.next(FINISHED); //fire webAudio_state(FINISHED:string):Subscription event
            } else if (time >= this.scheduledPause) {
                this.pause();
            } else if (this.state === this.states[PLAYING]) {
                subjects.webAudio_scriptNode_onaudioprocess.next(time); //fire onaudioprocess(time:number):Subscription event
            }
        };
    }

    removeOnAudioProcess() {
        this.scriptNode.onaudioprocess = () => {
        };
    }

    play(start, end) {
        if (!this.buffer) return;

        this.createBufferSource(); // need to re-create source on each playback

        this.source.buffer = this.filteredBuffer; //always use filteredBuffer to play

        const adjustedTime = this.seekTo(start, end);
        start = adjustedTime.start;
        end = adjustedTime.end;

        this.scheduledPause = end; //the supposedly finish time

        this.source.loop = this.loop;
        this.source.start(0, start);

        if (this.audioContext.state === SUSPENDED) {
            this.audioContext.resume && this.audioContext.resume();
        }

        //used when user pause, then mute then play again. aka mute while playing
        if (this.getGain() === 0) this.source.disconnect();
        this.setState(PLAYING);
        subjects.webAudio_state.next(PLAYING); //fire webAudio_state(PLAYING:string):Subscription event
    }

    pause() {
        this.scheduledPause = null;

        this.startPosition += this.getPlayedTime();

        this.source && this.source.stop(0);

        this.setState(PAUSED);

        subjects.webAudio_state.next(PAUSED); //fire webAudio_state(PAUSED:string):Subscription event
    }

    isPaused() {
        return this.state !== this.states[PLAYING];
    }

    seekTo(start, end) {
        if (!this.buffer) return;

        this.scheduledPause = null;

        if (start == null) {
            start = this.getCurrentTime();
            if (start >= this.getDuration()) start = 0;
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
        return this.state.getPlayedPercents.call(this);
    }

    getDuration() {
        if (!this.buffer) return 0;
        return this.buffer.duration;
    }

    setLength(length) {
        // No resize, we can preserve the cached peaks.
        if (this.mergedPeaks && length == 2 * this.mergedPeaks.length - 1 + 2) {
            return;
        }

        this.splitPeaks = [];
        this.mergedPeaks = [];
        // Set the last element of the sparse array so the peak arrays are
        // appropriately sized for other calculations.
        const channels = this.buffer ? this.buffer.numberOfChannels : 1;
        let c;
        for (c = 0; c < channels; c++) {
            this.splitPeaks[c] = [];
            this.splitPeaks[c][2 * (length - 1)] = 0;
            this.splitPeaks[c][2 * (length - 1) + 1] = 0;
        }
        this.mergedPeaks[2 * (length - 1)] = 0;
        this.mergedPeaks[2 * (length - 1) + 1] = 0;
    }


    getPeaks(length, first, last) {
        if (this.peaks) return this.peaks; //not going to feed in peak data
        if (!this.buffer) return []; //usually not going to happen

        first = first || 0;
        last = last || length - 1;

        this.setLength(length);

        if (!this.buffer) return this.mergedPeaks; //usually not going to happen

        /**
         * The following snippet fixes a buffering data issue on the Safari
         * browser which returned undefined It creates the missing buffer based
         * on 1 channel, 4096 samples and the sampleRate from the current
         * webaudio context 4096 samples seemed to be the best fit for rendering
         * will review this code once a stable version of Safari TP is out
         */
        if (!this.buffer.length) {
            const newBuffer = this.audioContext.createBuffer(1, 4096, this.buffer.sampleRate);
            this.buffer = newBuffer.buffer;
        }

        const sampleSize = this.filteredBuffer.length / length;
        const sampleStep = ~~(sampleSize / 10) || 1; //not sure why step = sampleSize/10

        const peaks = this.splitPeaks[0];
        const channelData = this.filteredBuffer.getChannelData(0);
        let i;

        //0 to widht of the canvas aka 600
        for (i = first; i <= last; i++) {
            const start = ~~(i * sampleSize);
            const end = ~~(start + sampleSize);
            //start = 0 , end = 1600 and incremental step = 1600

            let min = 0;
            let max = 0;
            let j;

            //for every 160 (sampleStep) get the min and max value
            for (j = start; j < end; j += sampleStep) {
                const value = channelData[j];
                if (value > max) max = value;
                if (value < min) min = value;
            }

            peaks[2 * i] = max;
            peaks[2 * i + 1] = min;
            this.mergedPeaks[2 * i] = max;
            this.mergedPeaks[2 * i + 1] = min;
        }
        return this.mergedPeaks;
    }

    disconnectBufferSource() {
        if (this.source) this.source.disconnect();
    }

    // TODO: ~~clone this.buffer and apply the coefs~~
    // TODO: ~~try using iirfilternode //done~~ 29/12/2019. Nevermind, iirfilternode class only has getFrequencyResponse() not the time-domain method Im looking for to plot graph. 30/12/2019
    // TODO: clean up ~~iirfilter~~ when pause and changes of filter //done
    applyFilter(coef) {
        /* //the iirfilternode from webaudioapi
        coef.map((f, i) => {
                 const iirFilter = this.audioContext.createIIRFilter(f.ff, f.fb);
                 if (i === coef.length - 1) this.source.connect(iirFilter).connect(this.audioContext.destination);
                 else this.source.connect(iirFilter);
             });
        //coef loop is equivalent to code below. Code below is easier to track in order to disconnect when user changes new filter. To disconnect filter, only disconnect first iirfilter
        const iirFilter1 = this.audioContext.createIIRFilter(coef[0].ff, coef[0].fb);
        const iirFilter2 = this.audioContext.createIIRFilter(coef[1].ff, coef[1].fb);
        const iirFilter3 = this.audioContext.createIIRFilter(coef[2].ff, coef[2].fb);
        const iirFilter4 = this.audioContext.createIIRFilter(coef[3].ff, coef[3].fb);
        this.source.connect(iirFilter1).connect(iirFilter2).connect(iirFilter3).connect(iirFilter4).connect(this.audioContext.destination);*/

        const input = this.buffer.getChannelData(0).slice(); //uses original buffer for, formula x[n]/x[n-1]/x[n-2] | input[i]/input[i-1]/input[i-2]
        const outputBuff = this.audioContext.createBuffer(this.buffer.numberOfChannels, this.buffer.length, this.buffer.sampleRate)
        let output = outputBuff.getChannelData(0);
        let d = [0, 0]; //temp array to hold n-1 and n-2

        for (let j = 0; j < coef.length; j += 1) {
            for (let i = 0; i < this.buffer.length; i++) {
                //b = ff, a = fb, a direct reference from formula to coef
                /* //iirfilter formula from superpowered.com : y[n] = (b0/a0)*x[n] + (b1/a0)*x[n-1] + (b2/a0)*x[n-2] - (a1/a0)*y[n-1] - (a2/a0)*y[n-2]
                output[i] = (coef[j].ff[0] / coef[j].fb[0]) * input[i] + d[0];
                d[0] = ((coef[j].ff[1] / coef[j].fb[0]) * input[i]) - ((coef[j].fb[1] / coef[j].fb[0]) * output[i]) + d[1];
                d[1] = ((coef[j].ff[2] / coef[j].fb[0]) * input[i]) - ((coef[j].fb[2] / coef[j].fb[0]) * output[i]);
                input[i] = output[i];*/

                //not sure where we get this formula from but it is there since I was employed. 11.00am@30/12/2019. This is biquad filter formula? 11.25am@30/12/2019
                //biquad formula: y(n)=b0x(n)+ b1x(n−1)+ b2x(n−2) − a1y(n−1) −a2y(n−2) . source: https://arachnoid.com/BiQuadDesigner/index.html
                output[i] = coef[j].ff[0] * input[i] + d[0];
                d[0] = coef[j].ff[1] * input[i] - coef[j].fb[1] * output[i] + d[1];
                d[1] = coef[j].ff[2] * input[i] - coef[j].fb[2] * output[i];
                input[i] = output[i];
            }
            d[0] = d[1] = 0; //optIn or out? if in, value = -e7, out, value = 18 f points on bell filter.
        }

        this.startPosition = 0; //if new filter is applied, restart
        this.filteredBuffer = outputBuff; //set this.filteredbuffer
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

//https://chinmay.audio/iirfilter-workshop/ iirfilternode to check
//b=[ 1, -1.2621407508850098, 0.8533923625946045, 1, -1.225411295890808, 0.612431526184082, 1, -1.7005388736724854, 0.7515528202056885, 1, -1.9520241022109985, 0.9528384208679199]
//a=[0.1658635704779951, -0.17049753937028886, 0.004650211082637766, 0.6367747847741175, -0.655921592250425, 0.04247856434965213, 0.48852423462836897, 0.3494028802722561, 0.015667778677698384, 0.4142467303456515, -0.44225218786636344, 0.41445194667817475]
