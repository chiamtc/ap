const DFT = function (bufferSize, sampleRate) {
    this.bufferSize = bufferSize;
    this.sampleRate = sampleRate;
    this.bandwidth  = 2 / bufferSize * sampleRate / 2;

    this.spectrum   = new Float64Array(bufferSize/2);
    this.real       = new Float64Array(bufferSize);
    this.imag       = new Float64Array(bufferSize);

    this.peakBand   = 0;
    this.peak       = 0;

    var N = bufferSize/2 * bufferSize;
    var TWO_PI = 2 * Math.PI;

    this.sinTable = new Float64Array(N);
    this.cosTable = new Float64Array(N);

    for (var i = 0; i < N; i++) {
        this.sinTable[i] = Math.sin(i * TWO_PI / bufferSize);
        this.cosTable[i] = Math.cos(i * TWO_PI / bufferSize);
    }

    this.calculateSpectrum = function(buffer) {
        var spectrum  = this.spectrum,
            real      = this.real,
            imag      = this.imag,
            bSi       = 2 / this.bufferSize,
            sqrt      = Math.sqrt,
            rval,
            ival,
            mag;

        for (var k = 0; k < this.bufferSize/2; k++) {
            rval = 0.0;
            ival = 0.0;

            for (var n = 0; n < buffer.length; n++) {
                rval += this.cosTable[k*n] * buffer[n];
                ival += this.sinTable[k*n] * buffer[n];
            }

            real[k] = rval;
            imag[k] = ival;
        }


        for (var i = 0, N = bufferSize/2; i < N; i++) {
            rval = real[i];
            ival = imag[i];
            mag = bSi * sqrt(rval * rval + ival * ival);

            if (mag > this.peak) {
                this.peakBand = i;
                this.peak = mag;
            }

            spectrum[i] = mag;
        }
        return spectrum
    };

}
export default DFT
