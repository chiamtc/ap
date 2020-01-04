import style from './util/Style';

export default class WaveCanvas {
    constructor() {
        this.start = 0;
        this.end = 1;
        this._mainWave_canvas = null;
        this._mainWave_ctx = null;
        this._progressWave_canvas = null;
        this._progressWave_ctx = null;
        this.halfPixel = 0.5 / (window.devicePixelRatio || screen.deviceXDPI / screen.logicalXDPI);
    }

    init() {
        this.createMainWaveWrapperCanvas();
        this.createProgressWaveWrapperCanvas();
    }

    createMainWaveWrapperCanvas() {
        const mainWave_canvas = document.createElement('canvas');
        style(mainWave_canvas, {
            position: 'absolute',
            zIndex: 2,
            left: '0px',
            top: 0,
            bottom: 0,
            height: '100%',
            pointerEvents: 'none'
        });
        this._mainWave_ctx = mainWave_canvas.getContext('2d', {desynchronized: true});
        this._mainWave_canvas = mainWave_canvas;
    }

    createProgressWaveWrapperCanvas() {
        const progressWave_canvas = document.createElement('canvas');
        style(progressWave_canvas, {
            position: 'absolute',
            left: '0px',
            top: 0,
            bottom: 0,
            height: '100%',
        });
        this._progressWave_ctx = progressWave_canvas.getContext('2d', {desynchronized: true});
        this._progressWave_canvas = progressWave_canvas;
    }

    updateDimensions(elementWidth, totalWidth, width, height) {
        this.start = this._mainWave_canvas.offsetLeft / totalWidth || 0;
        this.end = this.start + elementWidth / totalWidth;

        // set mainwave canvas dimensions
        this._mainWave_canvas.width = width;
        this._mainWave_canvas.height = height;
        let elementSize = {width: elementWidth + 'px'};
        style(this._mainWave_canvas, elementSize);

        // set progresswave canvas dimensions and display block to make it visible
        this._progressWave_canvas.width = width;
        this._progressWave_canvas.height = height;
        style(this._progressWave_canvas, {...elementSize, display: 'block'});
    }

    drawLine(peaks, absmax, halfH, offsetY) {

        const length = peaks.length / 2;
        const first = Math.round(length * this.start);

        // use one more peak value to make sure we join peaks at ends -- unless,
        // of course, this is the last canvas
        const last = Math.round(length * this.end) + 1;

        const canvasStart = first;
        const canvasEnd = last;
        const scale = this.mainWave_canvas.width / (canvasEnd - canvasStart - 1);

        // optimization
        const halfOffset = halfH + offsetY;
        const absmaxHalf = absmax / halfH;

        this._mainWave_ctx.beginPath();
        this._mainWave_ctx.moveTo((canvasStart - first) * scale, halfOffset);

        this._mainWave_ctx.lineTo(
            (canvasStart - first) * scale,
            halfOffset - Math.round((peaks[2 * canvasStart] || 0) / absmaxHalf)
        );

        let i, peak, h;
        for (i = canvasStart; i < canvasEnd; i++) {
            peak = peaks[2 * i] || 0;
            h = Math.round(peak / absmaxHalf);
            this._mainWave_ctx.lineTo((i - first) * scale + this.halfPixel, halfOffset - h);
        }

        // draw the bottom edge going backwards, to make a single
        // closed hull to fill
        let j = canvasEnd - 1;
        for (j; j >= canvasStart; j--) {
            peak = peaks[2 * j + 1] || 0;
            h = Math.round(peak / absmaxHalf);
            this._mainWave_ctx.lineTo((j - first) * scale + this.halfPixel, halfOffset - h);
        }

        this._mainWave_ctx.lineTo(
            (canvasStart - first) * scale,
            halfOffset -
            Math.round((peaks[2 * canvasStart + 1] || 0) / absmaxHalf)
        );

        this._mainWave_ctx.closePath();
        this._mainWave_ctx.fill(); //this.mainWave_ctx.stroke();
    }

    setCtxWaveFillStyles(mainWaveColor, progressWaveColor) {
        this._mainWave_ctx.fillStyle = mainWaveColor.lineColor;
        this.progressWave_ctx.fillStyle = progressWaveColor.lineColor;
    }

    setCanvasWaveBgStyles(mainWaveColor, progressWaveColor) {
        //good for dark mode
        style(this.mainWave_canvas, {backgroundColor: mainWaveColor.backgroundColor});
        style(this._progressWave_canvas, {backgroundColor: progressWaveColor.backgroundColor});
    }

    clearWave() {
        this._mainWave_ctx.clearRect(0, 0, this._mainWave_ctx.canvas.width, this._mainWave_ctx.canvas.height);
        this._progressWave_ctx.clearRect(0, 0, this._progressWave_ctx.canvas.width, this._progressWave_ctx.canvas.height);
    }

    get mainWave_canvas() {
        return this._mainWave_canvas;
    }

    set mainWave_canvas(value) {
        this._mainWave_canvas = value;
    }

    get progressWave_ctx() {
        return this._progressWave_ctx;
    }

    set progressWave_ctx(value) {
        this._progressWave_ctx = value;
    }

    get mainWave_ctx() {
        return this._mainWave_ctx;
    }

    set mainWave_ctx(value) {
        this._mainWave_ctx = value;
    }

    get progressWave_canvas() {
        return this._progressWave_canvas;
    }

    set progressWave_canvas(value) {
        this._progressWave_canvas = value;
    }
}
