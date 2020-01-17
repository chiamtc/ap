import {subjects} from "./M3dAudio";
import worker from "./workers/worker.js";
import WebWorker from "./workers/workerSetup";
import FFT from './util/FFT'
/**
 * 1. create wrapper
 * 2. create canvas
 * 3. update canvas width + height + styling
 * 4. getFrequencies() with callback as parameter
 *     4.1  retrieves all audiobuffer data (channeldata, samplerate etc etc)
 *     4.2  check if overlap , true ? get max value based on the canvas width and buffer, false? 4.3
 *     4.3 new fft instance
 *     4.4 slicing channelone data into chunks depending on fftsampleSize (512,1024 ...).
 *          4.4.1 Immediately, calculate spectrum via fftinstance on each chunk
 *          4.4.2 push each chunk into frequencies []  and increase currentOffset by ffySample for next chunk to start and iterate
 * 5. drawing spectrogram using frequencies[]
 * 6. resample() immediately to the pixels (some complex loops and etc)
 * 7. x2 forloop to draw on canvas
 */

import style from "./util/Style";
import {CHANGE_FILTER, CLICK, RESIZE, ZOOM} from "./constants";

//TODO: read fft topic
// https://dsp.stackexchange.com/questions/42428/understanding-overlapping-in-stft
// https://dsp.stackexchange.com/questions/47448/window-periodoverlap-and-fft
// OG fft + spectrogram code https://developer.mozilla.org/en-US/docs/Archive/Misc_top_level/Visualizing_Audio_Spectrum

//TODO: read spectrogram drawing topic
// even better read: https://noisehack.com/build-music-visualizer-web-audio-api/
//http://arc.id.au/Spectrogram.html
//https://github.com/bastibe/WebGL-Spectrogram
// https://stackoverflow.com/questions/57125984/how-can-i-add-a-glsl-fragment-shader-audio-visualization/57126857#57126857
// https://github.com/a-vis/gl-spectrogram
class Spectrogram {
    constructor(params, m3dAudio) {
        this.m3dAudio = m3dAudio;
        this.container_id = params.container_id;
        this.container = null;
        this.wrapper = null;
        if (!params.colorMap) {
            throw new Error('No colorMap parameter found.')
        } else {
            if (!params.colorMap instanceof Array) {
                throw new Error('"colorMap" param is not an array of string. Provide in such format ["#ffffff", "#000000", ...]')
            }
        }
        this.colorMap = params.colorMap;
        this.spectrogramCanvas = null;
        this.spectrogramCtx = null;
        this.spectrumGain = params.spectrumGain || 100;
        this.drawer = m3dAudio.wave_wrapper;
        this.pixelRatio = m3dAudio.wave_wrapper.pixelRatio;
        this.fftSamples = params.fftSamples || 512;
        this.noverlap = params.noverlap;
        this.windowFunc = params.windowFunc;
        this.alpha = params.alpha;
        this.height = m3dAudio.wave_wrapper.height;
        this.width = m3dAudio.wave_wrapper.width;
        this.maxCanvasWidth = this.m3dAudio.wave_wrapper.maxCanvasWidth;
        this.maxCanvasElementWidth =
            this.drawer.maxCanvasElementWidth ||
            Math.round(this.maxCanvasWidth / this.pixelRatio);
        this.fill = true;
        this.scroll = true;
        this.drawer = null; //aka wrapper;
        this.web_audio = null; //aka web_audio
        this.worker = null;
        this.visible = true;
    }

    init() {
        this.worker = new WebWorker(worker);
        this.setM3dAudioState();
        this.createContainer();
        this.createWrapper();
        this.createCanvas();
        this.renderSpectrogram();

        this.m3dAudio.wave_wrapper.mainWave_wrapper.addEventListener('scroll', this.onScroll);
        subjects.m3dAudio_control.subscribe((res) => {
            switch (res.type) {
                case CHANGE_FILTER:
                    this.clearCanvas();
                    this.renderSpectrogram();
                    break;
                case ZOOM:
                    this.clearCanvas();
                    this.renderSpectrogram();
                    const scrolbarHeight = this.m3dAudio.wave_wrapper.height - this.m3dAudio.wave_wrapper.progressWave_wrapper.scrollHeight;
                    scrolbarHeight !== 0 ? style(this.container, {top: `-${this.height + scrolbarHeight}px`}) : style(this.container, {top: `-${this.height}px`});
                    break;
            }
        });

        subjects.waveWrapper_state.subscribe((i) => {
            switch (i.type) {
                case RESIZE:
                    this.clearCanvas();
                    this.renderSpectrogram();
                    break;
            }
        });
    }

    setM3dAudioState() {
        this.drawer = this.m3dAudio.wave_wrapper;
        this.web_audio = this.m3dAudio.web_audio;
        this.fill = this.m3dAudio.fill;
        this.scroll = this.m3dAudio.scroll;
    }

    createContainer() {
        const container = document.querySelector(this.container_id);
        if (!container) throw new Error("No container element id found. Pass container id as a string.");
        else this.container = container;
    }

    toggleVisibility(visible){
        this.visible = visible;
    }

    createWrapper() {
        if (!this.wrapper) {
            const wrapper = document.createElement('spectrogram');
            this.wrapper = this.container.appendChild(wrapper);

            style(this.container, {
                display: 'block',
                position: 'relative',
                top: this.visible? `-${this.height}px` :0,
                width: '100%'
            });

            style(this.wrapper, {
                display: 'block',
                position: 'absolute',
                height: `${this.height}px`
            });

            if (this.fill || this.scroll) {
                style(this.wrapper, {
                    width: '100%',
                    overflowX: 'hidden',
                    overflowY: 'hidden'
                });
            }
        }
    }

    createCanvas() {
        const canvasEle = document.createElement('canvas');
        this.spectrogramCanvas = this.wrapper.appendChild(canvasEle);
        this.spectrogramCtx = this.spectrogramCanvas.getContext('2d', {desynchronized: true});
        style(this.spectrogramCanvas, {
            position: 'absolute',
            zIndex: 4,
            left: 0,
        });
    }

    renderSpectrogram() {
        const canvasWidth = this.drawer.mainWave_wrapper.scrollWidth - this.maxCanvasElementWidth * 0;
        this.spectrogramCanvas.width = canvasWidth * this.pixelRatio;
        this.spectrogramCanvas.height = (this.height + 1) * this.pixelRatio;
        this.spectrogramCanvas.style.width = canvasWidth;
        this.width = this.drawer.width;
        //TODO add loadFrequenciesData() by fetching them via url ?

        this.worker.postMessage({
            type: 'ww_getFrequencies',
            data: {
                fftSamples: this.fftSamples,
                buffer: {
                    channelData: this.web_audio.filteredBuffer.getChannelData(0),
                    length: this.web_audio.filteredBuffer.length,
                    sampleRate: this.web_audio.filteredBuffer.sampleRate
                },
                noverlap: this.noverlap,
                width: this.spectrogramCanvas.width,
                windowFunc: this.windowFunc,
                alpha: this.alpha,
                // FFT_Blob: URL.createObjectURL(new Blob([FFT]))
            }
        });
        this.worker.onmessage = (event) => this.drawSpectrogram(event.data, this);
    }

    drawSpectrogram(frequenciesData, my) {
        const height = my.height;

        this.worker.postMessage({
            type: 'ww_resample',
            data: {
                oldMatrix: frequenciesData,
                resample_width: this.width,
                colorMap: this.colorMap,
                spectrumGain: this.spectrumGain
            }
        });
        this.worker.onmessage = (event) => {
            requestAnimationFrame(() => {
                const pixels = event.data
                const heightFactor = my.buffer ? 2 / my.buffer.numberOfChannels : 1;
                let i;
                let j;
                for (i = 0; i < pixels.length; i++) {
                    for (j = 0; j < pixels[i].length; j++) {
                        my.spectrogramCtx.beginPath();
                        my.spectrogramCtx.fillStyle = pixels[i][j];
                        my.spectrogramCtx.fillRect(i, height - j * heightFactor, 1, heightFactor);
                        my.spectrogramCtx.fill();
                    }
                }

                subjects.m3dAudio_state.next('ready')
            })
        };
    }

    clearCanvas = () => this.spectrogramCtx.clearRect(0, 0, this.spectrogramCtx.canvas.width, this.spectrogramCtx.canvas.height);

    onScroll = () => this.wrapper.scrollLeft = this.drawer.mainWave_wrapper.scrollLeft;

}

/**
 * Note:
 * 1. performance on drawing is significantly faster if I use hex() on colorColumn[m] (new array) and pushes to newMatrix[] rather than process it in drawSpectrogram's 2nd for loop (first loop length =600[width of canvas] and second loop = fftSamples/2)
 * 2. performance for fft itself.
 * TODO 1. wasm  (doable but not deployable)
 *      2. web-worker (doable)
 *      3. find even faster fft algo in dsp.js
 *      4.
 */

export default Spectrogram;
