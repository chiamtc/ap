//beginner tutorial for web worker https://www.html5rocks.com/en/tutorials/workers/basics/#toc-enviornment-subworkers
export default () => {
    self.onmessage = e => { // eslint-disable-line no-restricted-globals
        if (!e) return;
        switch (e.data.type) {
            case 'ww_getFrequencies':
                let {
                    fftSamples,
                    buffer,
                    noverlap,
                    width,
                    windowFunc,
                    alpha,
                    // FFT_Blob
                } = e.data.data;
                // importScripts(FFT_Blob);
                //to reduce the chances of failure to create url(blob) object, fft class stays here.
                //I've gotten  errors -> Refused to execute script from 'blob:http://localhost:9000/ac2e3a22-5634-4b24-ba90-826536e102f7' because its MIME type ('') is not executable
                const FFT = function (bufferSize, sampleRate, windowFunc, alpha) {
                    this.bufferSize = bufferSize;
                    this.sampleRate = sampleRate;
                    this.bandwidth = (2 / bufferSize) * (sampleRate / 2);

                    this.sinTable = new Float32Array(bufferSize);
                    this.cosTable = new Float32Array(bufferSize);
                    this.windowValues = new Float32Array(bufferSize);
                    this.reverseTable = new Uint32Array(bufferSize);

                    this.peakBand = 0;
                    this.peak = 0;

                    let i;
                    switch (windowFunc) {
                        case 'bartlett':
                            for (i = 0; i < bufferSize; i++) {
                                this.windowValues[i] = (2 / (bufferSize - 1)) * ((bufferSize - 1) / 2 - Math.abs(i - (bufferSize - 1) / 2));
                            }
                            break;
                        case 'bartlettHann':
                            for (i = 0; i < bufferSize; i++) {
                                this.windowValues[i] = 0.62 - 0.48 * Math.abs(i / (bufferSize - 1) - 0.5) - 0.38 * Math.cos((Math.PI * 2 * i) / (bufferSize - 1));
                            }
                            break;
                        case 'blackman':
                            alpha = alpha || 0.16;
                            for (i = 0; i < bufferSize; i++) {
                                this.windowValues[i] = (1 - alpha) / 2 - 0.5 * Math.cos((Math.PI * 2 * i) / (bufferSize - 1)) + (alpha / 2) * Math.cos((4 * Math.PI * i) / (bufferSize - 1));
                            }
                            break;
                        case 'cosine':
                            for (i = 0; i < bufferSize; i++) {
                                this.windowValues[i] = Math.cos((Math.PI * i) / (bufferSize - 1) - Math.PI / 2);
                            }
                            break;
                        case 'gauss':
                            alpha = alpha || 0.25;
                            for (i = 0; i < bufferSize; i++) {
                                this.windowValues[i] = Math.pow(Math.E, -0.5 * Math.pow((i - (bufferSize - 1) / 2) / ((alpha * (bufferSize - 1)) / 2), 2));
                            }
                            break;
                        case 'hamming':
                            for (i = 0; i < bufferSize; i++) {
                                this.windowValues[i] = (0.54 - 0.46) * Math.cos((Math.PI * 2 * i) / (bufferSize - 1));
                            }
                            break;
                        case 'hann':
                        case undefined:
                            for (i = 0; i < bufferSize; i++) {
                                this.windowValues[i] = 0.5 * (1 - Math.cos((Math.PI * 2 * i) / (bufferSize - 1)));
                            }
                            break;
                        case 'lanczoz':
                            for (i = 0; i < bufferSize; i++) {
                                this.windowValues[i] = Math.sin(Math.PI * ((2 * i) / (bufferSize - 1) - 1)) / (Math.PI * ((2 * i) / (bufferSize - 1) - 1));
                            }
                            break;
                        case 'rectangular':
                            for (i = 0; i < bufferSize; i++) {
                                this.windowValues[i] = 1;
                            }
                            break;
                        case 'triangular':
                            for (i = 0; i < bufferSize; i++) {
                                this.windowValues[i] = (2 / bufferSize) * (bufferSize / 2 - Math.abs(i - (bufferSize - 1) / 2));
                            }
                            break;
                        default:
                            throw Error('No such window function \'' + windowFunc + '\'');
                    }

                    let limit = 1;
                    let bit = bufferSize >> 1;

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
                        let bufferSize = this.bufferSize,
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

                        const k = Math.floor(Math.log(bufferSize) / Math.LN2);
                        if (Math.pow(2, k) !== bufferSize) {
                            throw 'Invalid buffer size, must be a power of 2.';
                        }
                        if (bufferSize !== buffer.length) {
                            throw `Supplied buffer is not the same size as defined FFT. FFT Size: ${bufferSize}. Buffer Size: ${buffer.length}`;
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

                        for (let i = 0; i < bufferSize; i++) {
                            real[i] = buffer[reverseTable[i]] * this.windowValues[reverseTable[i]];
                            imag[i] = 0;
                        }

                        while (halfSize < bufferSize) {
                            phaseShiftStepReal = cosTable[halfSize];
                            phaseShiftStepImag = sinTable[halfSize];

                            currentPhaseShiftReal = 1;
                            currentPhaseShiftImag = 0;

                            for (let fftStep = 0; fftStep < halfSize; fftStep++) {
                                let i = fftStep;

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
                                currentPhaseShiftReal = tmpReal * phaseShiftStepReal - currentPhaseShiftImag * phaseShiftStepImag;
                                currentPhaseShiftImag = tmpReal * phaseShiftStepImag + currentPhaseShiftImag * phaseShiftStepReal;
                            }

                            halfSize = halfSize << 1;
                        }

                        for (let i = 0, N = bufferSize / 2; i < N; i++) {
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
                const channelOne = buffer.channelData;
                const sampleRate = buffer.sampleRate;
                const frequencies = [];
                if (!buffer) return;
                if (!noverlap) {
                    const uniqueSamplesPerPx = buffer.length / width;
                    noverlap = Math.max(0, Math.round(fftSamples - uniqueSamplesPerPx));
                }
                const fft = new FFT(fftSamples, sampleRate, windowFunc, alpha);
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
                    frequencies.push(spectrum);
                    currentOffset += fftSamples - noverlap;
                }
                postMessage(frequencies);
                break;
            case 'ww_resample':
                importScripts('https://cdn.jsdelivr.net/npm/chroma-js@2.1.0/chroma.min.js');
                const {oldMatrix, resample_width, colorMap, spectrumGain} = e.data.data;

                const chroma_colorMap = chroma.scale(colorMap);
                const newMatrix = [];
                const oldPiece = 1 / oldMatrix.length;
                const newPiece = 1 / resample_width;
                let i;
                for (i = 0; i < resample_width; i++) {
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
                        colorColumn[m] = chroma_colorMap(column[m] * spectrumGain).hex(); //prepares canvas colour for efficient actual drawing. Note: this array contains all hex code color
                    }
                    newMatrix.push(colorColumn);
                }
                postMessage(newMatrix);
                break;
        }
    }
}
