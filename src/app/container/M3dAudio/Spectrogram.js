import {subjects} from "./M3dAudio";
import FFT from "./util/FFT";
import worker from "./worker.js";
import WebWorker from "./workerSetup";
const Chroma = require('chroma-js')
// import greenlet from 'greenlet'
// import operative from 'operative';
import threadify from 'threadify'
import {Canvas, Image, transfer} from 'canvas-webworker';
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

//TODO: read
// https://dsp.stackexchange.com/questions/42428/understanding-overlapping-in-stft
// https://dsp.stackexchange.com/questions/47448/window-periodoverlap-and-fft
// OG fft + spectrogram code https://developer.mozilla.org/en-US/docs/Archive/Misc_top_level/Visualizing_Audio_Spectrum
class Spectrogram {
    constructor(params, m3dAudio) {
        this.m3dAudio = m3dAudio;

        this.container_id = params.container_id;
        this.container = null;
        this.wrapper = null;
        if (!params.colorMap) {
            throw new Error('No colorMap parameter found.')
        } else {
            if (!Object.prototype.hasOwnProperty.call(params.colorMap, 'classes')) {
                throw new Error(`"colorMap" parameter is not a class of Chroma-JS.\n
                1. "npm install --save chroma-js" \n
                2. create "colorMap" parameter using "scale()". Reference: https://gka.github.io/chroma.js/#color-scales`)
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
    }

    init() {
        this.worker = new WebWorker(worker);
        this.setM3dAudioState();
        this.createContainer(); //comment it out for <spectrogram> tag instead of <div> <spectrogram> </div>
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
        // this.m3dAudio.wave_wrapper.mainWave_wrapper.appendChild(this.container); //append onto mainWave ?
    }

    createWrapper() {
        if (!this.wrapper) {
            const wrapper = document.createElement('spectrogram');
            // this.wrapper = this.m3dAudio.wave_wrapper.mainWave_wrapper.appendChild(wrapper);  //comment it out for <spectrogram> tag instead of <div> <spectrogram> </div>
            this.wrapper = this.container.appendChild(wrapper);

            //comment it out for <spectrogram> tag instead of <div> <spectrogram> </div>
            style(this.container, {
                display: 'block',
                position: 'relative',
                top: `-${this.height}px`,
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

        // this.wrapper.addEventListener('click', this._onWrapperClick); ws
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
        //TODO add loadFrequenciesData by fetching them via url ?

        this.worker.postMessage({
            type: 'getFrequencies',
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
            }
        })
        this.worker.onmessage = (event) => {
            console.log('main script - getFrequencies', event)
            this.drawSpectrogram(event.data, this);
        };
        //main thread execution // used to be
        // this.getFrequencies(this.drawSpectrogram);
    }


    //optimize this using https://github.com/casperlamboo/canvas-webworker
    drawSpectrogram(frequenciesData, my) {
        const spectrCc = my.spectrogramCtx;
        const length = my.web_audio.getDuration();
        const height = my.height;


        /* //using greenlet
          let getName = greenlet((username) => {
               let url = `https://api.github.com/users/${username}`
               return fetch(url).then((res) => {
                   return res.json()
               })
               // const res = await fetch(url);
               // let profile = await res.json()
               // return profile.name
           })

           getName('developit').then(console.log, console.error);*/

        /*
        let getName = greenlet((frequencies, colorMap, spectrumGain) => {
            const a = my.resample(frequencies);
            console.log('a',a)
        })
        getName({
            frequencies:frequenciesData,
            colorMap:this.colorMap,
            spectrumGain: this.spectrumGain
        })*/

        //using operative
        /* var lodashWorker = operative(function(method, args, cb) {
             cb(
                 _[method].apply(_, args)
             );
         }, [
             'http://cdnjs.cloudflare.com/ajax/libs/lodash.js/1.3.1/lodash.min.js'
         ]);

         lodashWorker('uniq', [[1, 2, 3, 3, 2, 1, 4, 3, 2]], function(output) {
             output; // => [1, 2, 3, 4]
         });*/


        // const ff = new Function(this.colorMap.toString());
        // console.log(ff.apply())




        //library worker https://blog.krawaller.se/posts/a-library-webworker-wrapper/ this one tomorrow
        this.worker.postMessage({
            type: 'resample',
            data: {
                oldMatrix: frequenciesData,
                // colorMap: this.colorMap,
                resample_width: this.width,
                spectrumGain: this.spectrumGain
            }
        });
        this.worker.onmessage = (event) => {
            console.log('main script - resample', event)
            // this.drawSpectrogram(event.data, this);
            const pixels = event.data//my.resample(frequenciesData);
            const heightFactor = my.buffer ? 2 / my.buffer.numberOfChannels : 1;
            let i;
            let j;
            //use canvas-webworker for this part
            for (i = 0; i < pixels.length; i++) {
                for (j = 0; j < pixels[i].length; j++) {
                    my.spectrogramCtx.beginPath();
                    my.spectrogramCtx.fillStyle = this.colorMap(pixels[i][j] * this.spectrumGain).hex();
                    my.spectrogramCtx.fillRect(i, height - j * heightFactor, 1, heightFactor);
                    my.spectrogramCtx.fill();
                }
            }
        };

        //main thread execution
        /* const pixels = my.resample(frequenciesData);
         const heightFactor = my.buffer ? 2 / my.buffer.numberOfChannels : 1;
         let i;
         let j;
         for (i = 0; i < pixels.length; i++) {
             for (j = 0; j < pixels[i].length; j++) {
                 my.spectrogramCtx.beginPath();
                 my.spectrogramCtx.fillStyle = this.colorMap(pixels[i][j] * 200).hex();
                 // my.spectrogramCtx.fillStyle = pixels[i][j];
                 my.spectrogramCtx.fillRect(i, height - j * heightFactor, 1, heightFactor);
                 my.spectrogramCtx.fill();
             }
         }*/
    }


    resample(oldMatrix) {
        const columnsNumber = this.width;
        const newMatrix = [];

        const oldPiece = 1 / oldMatrix.length;
        const newPiece = 1 / columnsNumber;
        let i;
        for (i = 0; i < columnsNumber; i++) {
            const column = new Array(oldMatrix[0].length);
            let j;

            for (j = 0; j < oldMatrix.length; j++) {
                const oldStart = j * oldPiece;
                const oldEnd = oldStart + oldPiece;
                const newStart = i * newPiece;
                const newEnd = newStart + newPiece;

                const overlap = oldEnd <= newStart || newEnd <= oldStart ? 0 : Math.min(Math.max(oldEnd, newStart), Math.max(newEnd, oldStart)) - Math.max(Math.min(oldEnd, newStart), Math.min(newEnd, oldStart));
                let k;
                /* eslint-disable max-depth */
                if (overlap > 0) {
                    for (k = 0; k < oldMatrix[0].length; k++) {
                        if (column[k] == null) {
                            column[k] = 0;
                        }
                        column[k] += (overlap / newPiece) * oldMatrix[j][k];
                    }
                }
                /* eslint-enable max-depth */
            }

            const intColumn = new Array(oldMatrix[0].length);
            const colorColumn = new Array(oldMatrix[0].length);
            let m;

            for (m = 0; m < oldMatrix[0].length; m++) {
                intColumn[m] = column[m];
                colorColumn[m] = this.colorMap(column[m] * this.spectrumGain).hex(); //the problem when using webworkers
                //prepares canvas colour for efficient actual drawing. Note: this array contains all hex code color
            }
            newMatrix.push(colorColumn);
        }
        return newMatrix;
    }

    clearCanvas = () => this.spectrogramCtx.clearRect(0, 0, this.spectrogramCtx.canvas.width, this.spectrogramCtx.canvas.height);

    onScroll = () => this.wrapper.scrollLeft = this.drawer.mainWave_wrapper.scrollLeft;

}

/**
 * Note:
 * 1. performance on drawing is significantly faster if I use hex() on colorColumn[m] (new array) and pushes to newMatrix[] rather than process it in drawSpectrogram's 2nd for loop (first loop length =600[width of canvas] and second loop = fftSamples/2)
 * 2. performance for fft itself.
 * TODO 1. wasm  (doable but not deplo-able)
 *      2. web-worker (doable)
 *      3. find even faster fft algo in dsp.js
 *      4.
 */

export default Spectrogram;
