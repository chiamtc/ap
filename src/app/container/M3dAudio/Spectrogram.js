export const FFT = function (bufferSize, sampleRate, windowFunc, alpha) {
    this.bufferSize = bufferSize;
    this.sampleRate = sampleRate;
    this.bandwidth = (2 / bufferSize) * (sampleRate / 2);

    this.sinTable = new Float32Array(bufferSize);
    this.cosTable = new Float32Array(bufferSize);
    this.windowValues = new Float32Array(bufferSize);
    this.reverseTable = new Uint32Array(bufferSize);

    this.peakBand = 0;
    this.peak = 0;

    var i;
    switch (windowFunc) {
        case 'bartlett':
            for (i = 0; i < bufferSize; i++) {
                this.windowValues[i] =
                    (2 / (bufferSize - 1)) *
                    ((bufferSize - 1) / 2 - Math.abs(i - (bufferSize - 1) / 2));
            }
            break;
        case 'bartlettHann':
            for (i = 0; i < bufferSize; i++) {
                this.windowValues[i] =
                    0.62 -
                    0.48 * Math.abs(i / (bufferSize - 1) - 0.5) -
                    0.38 * Math.cos((Math.PI * 2 * i) / (bufferSize - 1));
            }
            break;
        case 'blackman':
            alpha = alpha || 0.16;
            for (i = 0; i < bufferSize; i++) {
                this.windowValues[i] =
                    (1 - alpha) / 2 -
                    0.5 * Math.cos((Math.PI * 2 * i) / (bufferSize - 1)) +
                    (alpha / 2) *
                    Math.cos((4 * Math.PI * i) / (bufferSize - 1));
            }
            break;
        case 'cosine':
            for (i = 0; i < bufferSize; i++) {
                this.windowValues[i] = Math.cos(
                    (Math.PI * i) / (bufferSize - 1) - Math.PI / 2
                );
            }
            break;
        case 'gauss':
            alpha = alpha || 0.25;
            for (i = 0; i < bufferSize; i++) {
                this.windowValues[i] = Math.pow(
                    Math.E,
                    -0.5 *
                    Math.pow(
                        (i - (bufferSize - 1) / 2) /
                        ((alpha * (bufferSize - 1)) / 2),
                        2
                    )
                );
            }
            break;
        case 'hamming':
            for (i = 0; i < bufferSize; i++) {
                this.windowValues[i] =
                    (0.54 - 0.46) *
                    Math.cos((Math.PI * 2 * i) / (bufferSize - 1));
            }
            break;
        case 'hann':
        case undefined:
            for (i = 0; i < bufferSize; i++) {
                this.windowValues[i] =
                    0.5 * (1 - Math.cos((Math.PI * 2 * i) / (bufferSize - 1)));
            }
            break;
        case 'lanczoz':
            for (i = 0; i < bufferSize; i++) {
                this.windowValues[i] =
                    Math.sin(Math.PI * ((2 * i) / (bufferSize - 1) - 1)) /
                    (Math.PI * ((2 * i) / (bufferSize - 1) - 1));
            }
            break;
        case 'rectangular':
            for (i = 0; i < bufferSize; i++) {
                this.windowValues[i] = 1;
            }
            break;
        case 'triangular':
            for (i = 0; i < bufferSize; i++) {
                this.windowValues[i] =
                    (2 / bufferSize) *
                    (bufferSize / 2 - Math.abs(i - (bufferSize - 1) / 2));
            }
            break;
        default:
            throw Error('No such window function \'' + windowFunc + '\'');
    }

    var limit = 1;
    var bit = bufferSize >> 1;
    var i;

    while (limit < bufferSize) {
        for (i = 0; i < limit; i++) {
            this.reverseTable[i + limit] = this.reverseTable[i] + bit;
        }

        limit = limit << 1;
        bit = bit >> 1;
    }

    for (i = 0; i < bufferSize; i++) {
        this.sinTable[i] = Math.sin(-Math.PI / i);
        this.cosTable[i] = Math.cos(-Math.PI / i);
    }

    this.calculateSpectrum = function (buffer) {
        // Locally scope variables for speed up
        var bufferSize = this.bufferSize,
            cosTable = this.cosTable,
            sinTable = this.sinTable,
            reverseTable = this.reverseTable,
            real = new Float32Array(bufferSize),
            imag = new Float32Array(bufferSize),
            bSi = 2 / this.bufferSize,
            sqrt = Math.sqrt,
            rval,
            ival,
            mag,
            spectrum = new Float32Array(bufferSize / 2);

        var k = Math.floor(Math.log(bufferSize) / Math.LN2);
        if (Math.pow(2, k) !== bufferSize) {
            throw 'Invalid buffer size, must be a power of 2.';
        }
        if (bufferSize !== buffer.length) {
            throw 'Supplied buffer is not the same size as defined FFT. FFT Size: ' +
            bufferSize +
            ' Buffer Size: ' +
            buffer.length;
        }

        var halfSize = 1,
            phaseShiftStepReal,
            phaseShiftStepImag,
            currentPhaseShiftReal,
            currentPhaseShiftImag,
            off,
            tr,
            ti,
            tmpReal;

        for (var i = 0; i < bufferSize; i++) {
            real[i] =
                buffer[reverseTable[i]] * this.windowValues[reverseTable[i]];
            imag[i] = 0;
        }

        while (halfSize < bufferSize) {
            phaseShiftStepReal = cosTable[halfSize];
            phaseShiftStepImag = sinTable[halfSize];

            currentPhaseShiftReal = 1;
            currentPhaseShiftImag = 0;

            for (var fftStep = 0; fftStep < halfSize; fftStep++) {
                var i = fftStep;

                while (i < bufferSize) {
                    off = i + halfSize;
                    tr =
                        currentPhaseShiftReal * real[off] -
                        currentPhaseShiftImag * imag[off];
                    ti =
                        currentPhaseShiftReal * imag[off] +
                        currentPhaseShiftImag * real[off];

                    real[off] = real[i] - tr;
                    imag[off] = imag[i] - ti;
                    real[i] += tr;
                    imag[i] += ti;

                    i += halfSize << 1;
                }

                tmpReal = currentPhaseShiftReal;
                currentPhaseShiftReal =
                    tmpReal * phaseShiftStepReal -
                    currentPhaseShiftImag * phaseShiftStepImag;
                currentPhaseShiftImag =
                    tmpReal * phaseShiftStepImag +
                    currentPhaseShiftImag * phaseShiftStepReal;
            }

            halfSize = halfSize << 1;
        }

        for (var i = 0, N = bufferSize / 2; i < N; i++) {
            rval = real[i];
            ival = imag[i];
            mag = bSi * sqrt(rval * rval + ival * ival);

            if (mag > this.peak) {
                this.peakBand = i;
                this.peak = mag;
            }
            spectrum[i] = mag;
        }
        return spectrum;
    };
};

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

let Chroma = require("chroma-js");

const colours = Chroma.scale([
    '#ffffff',
    '#ffa500',
    '#ff0000',
    '#ff0000',
    '#ff0000',
]);
const colours2 = Chroma.scale(['#111111', '#7a1b0c', '#ff0000', '#ffa100', '#ffff00', '#ffff9e', '#ffffff']); //
const colours3 = Chroma.scale(['#00a8de', '#36469e', '#b52a8b', '#ec215c', '#f67b30', '#dddd37', '#009e54'])
//TODO: read
// https://dsp.stackexchange.com/questions/42428/understanding-overlapping-in-stft
// https://dsp.stackexchange.com/questions/47448/window-periodoverlap-and-fft
class Spectrogram {
    constructor(params, m3dAudio) {
        this.m3dAudio = m3dAudio;

        this.container_id = params.container_id;
        this.container = null;
        this.wrapper = null;

        this.spectrogramCanvas = null;
        this.spectrogramCtx = null;

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

        //TODO
        // drawer.wrapper.addEventListener('scroll', this._onScroll);
        // ws.on('redraw')
    }

    init() {
        this.createContainer(); //comment it out for <spectrogram> tag instead of <div> <spectrogram> </div>
        this.createWrapper();
        this.createCanvas();
        this.renderSpectrogram();
    }

    //TODO setM3dAudioState()


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

            if (this.m3dAudio.fill || this.m3dAudio.scroll) {
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
        const canvasWidth = this.m3dAudio.wave_wrapper.mainWave_wrapper.scrollWidth - this.maxCanvasElementWidth * 0;
        this.spectrogramCanvas.width = canvasWidth * this.pixelRatio;
        this.spectrogramCanvas.height = (this.height + 1) * this.pixelRatio;
        this.spectrogramCanvas.style.width = canvasWidth;
        this.width = this.m3dAudio.wave_wrapper.width;
        console.log(this.m3dAudio)
        console.log(this.m3dAudio.wave_wrapper.width, this.width);
        // width: `${canvasWidth}px`,
        // this.spectrogramCtx.fillStyle = 'green';
        // this.spectrogramCtx.fillRect(0, this.height - 20, 20, 20);
        // this.spectrogramCtx.beginPath();       // Start a new path
        // this.spectrogramCtx.moveTo(0, this.height-5);    // Move the pen to (30, 50)
        // this.spectrogramCtx.lineTo(150, this.height-5);  // Draw a line to (150, 100)
        // this.spectrogramCtx.stroke();
        this.getFrequencies(this.drawSpectrogram);
    }

    getFrequencies(cb) {
        const fftSamples = this.fftSamples;
        const buffer = (this.buffer = this.m3dAudio.web_audio.buffer);
        const channelOne = buffer.getChannelData(0);
        const bufferLength = buffer.length;
        const sampleRate = buffer.sampleRate;
        const frequencies = [];
        if (!buffer) {
            // this.fireEvent('error', 'Web Audio buffer is not available');
            return;
        }

        let noverlap = this.noverlap;
        if (!noverlap) {
            const uniqueSamplesPerPx = buffer.length / this.spectrogramCanvas.width;
            noverlap = Math.max(0, Math.round(fftSamples - uniqueSamplesPerPx));
        }
        const fft = new FFT(fftSamples, sampleRate, this.windowFunc, this.alpha);
        let currentOffset = 0;

        while (currentOffset + fftSamples < channelOne.length) {
            const segment = channelOne.slice(
                currentOffset,
                currentOffset + fftSamples
            );
            const spectrum = fft.calculateSpectrum(segment);

            const array = new Uint8Array(fftSamples / 2);
            let j;
            for (j = 0; j < fftSamples / 2; j++) {
                array[j] = Math.max(-255, Math.log10(spectrum[j]) * 45);
            }
            // frequencies.push(array);
            frequencies.push(spectrum); //using this same as central not array. TODO: more research
            currentOffset += fftSamples - noverlap;
        }
        // console.log(frequencies); //TODO; callback(frequencies, this);

        cb(frequencies, this);
    }

    drawSpectrogram(frequenciesData, my) {
        const spectrCc = my.spectrogramCtx;
        const length = my.m3dAudio.web_audio.getDuration();
        const height = my.height;
        const pixels = my.resample(frequenciesData);
        const heightFactor = my.buffer ? 2 / my.buffer.numberOfChannels : 1;
        let i;
        let j;
        for (i = 0; i < pixels.length; i++) {
            for (j = 0; j < pixels[i].length; j++) {
                // const colorMap = my.colorMap[pixels[i][j]];
                my.spectrogramCtx.beginPath();
                // my.spectrCc.rect()
                my.spectrogramCtx.fillStyle =
                    /*  'rgba(' +
                      colorMap[0] * 256 +
                      ', ' +
                      colorMap[1] * 256 +
                      ', ' +
                      colorMap[2] * 256 +
                      ',' +
                      colorMap[3] +
                      ')';*/
                    pixels[i][j];
                my.spectrogramCtx.fillRect(
                    i,
                    height - j * heightFactor,
                    1,
                    heightFactor
                );
            }
        }
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
                colorColumn[m] = colours2(column[m] *100).hex();
            }
            newMatrix.push(colorColumn);
        }
        return newMatrix;
    }

}

export default Spectrogram;
