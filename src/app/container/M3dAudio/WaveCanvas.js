import style from './util/Style';

export default class WaveCanvas {
    constructor() {
        this.start = 0;
        this.end = 1;
        this.mainWave_canvas = null;
        this.mainWave_ctx = null;
        this.progressWave_canvas = null;
        this.progressWave_ctx = null;
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
        this.mainWave_ctx = mainWave_canvas.getContext('2d', {desynchronized: true});
        this.mainWave_canvas = mainWave_canvas;
    }

    createProgressWaveWrapperCanvas() {
        const progressWave_canvas = document.createElement('canvas');
        style(progressWave_canvas, {
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            height: '100%',
        });
        this.progressWave_ctx = progressWave_canvas.getContext('2d', {desynchronized: true});
        this.progressWave_canvas = progressWave_canvas;
    }

    updateDimensions(elementWidth, totalWidth, width, height) {
        this.start = this.mainWave_canvas.offsetLeft / totalWidth || 0;
        this.end = this.start + elementWidth / totalWidth;

        // set mainwave canvas dimensions
        this.mainWave_canvas.width = width;
        this.mainWave_canvas.height = height;
        let elementSize = {width: elementWidth + 'px'};
        style(this.mainWave_canvas, elementSize);

        // set progresswave canvas dimensions and display block to make it visible
        this.progressWave_canvas.width = width;
        this.progressWave_canvas.height = height;
        style(this.progressWave_canvas, elementSize);
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

        this.mainWave_ctx.beginPath();
        this.mainWave_ctx.moveTo((canvasStart - first) * scale, halfOffset);

        this.mainWave_ctx.lineTo(
            (canvasStart - first) * scale,
            halfOffset - Math.round((peaks[2 * canvasStart] || 0) / absmaxHalf)
        );

        let i, peak, h;
        for (i = canvasStart; i < canvasEnd; i++) {
            peak = peaks[2 * i] || 0;
            h = Math.round(peak / absmaxHalf);
            this.mainWave_ctx.lineTo((i - first) * scale + this.halfPixel, halfOffset - h);
        }

        // draw the bottom edge going backwards, to make a single
        // closed hull to fill
        let j = canvasEnd - 1;
        for (j; j >= canvasStart; j--) {
            peak = peaks[2 * j + 1] || 0;
            h = Math.round(peak / absmaxHalf);
            this.mainWave_ctx.lineTo((j - first) * scale + this.halfPixel, halfOffset - h);
        }

        this.mainWave_ctx.lineTo((canvasStart - first) * scale, halfOffset - Math.round((peaks[2 * canvasStart + 1] || 0) / absmaxHalf));

        this.mainWave_ctx.closePath();

        // this.mainWave_ctx.stroke();
        this.mainWave_ctx.fill();
    }

    setCtxWaveFillStyles(mainWaveColor, progressWaveColor) {
        this.mainWave_ctx.fillStyle = mainWaveColor.lineColor;
        this.mainWave_ctx.strokeStyle = mainWaveColor.lineColor;
        this.mainWave_ctx.lineJoin = "round";
        this.progressWave_ctx.fillStyle = progressWaveColor.lineColor;
    }

    setCanvasWaveBgStyles(mainWaveColor, progressWaveColor) {
        //good for dark mode
        style(this.mainWave_canvas, {backgroundColor: mainWaveColor.backgroundColor});
        style(this.progressWave_canvas, {backgroundColor: progressWaveColor.backgroundColor});
    }

    clearWave() {
        this.mainWave_ctx.clearRect(0, 0, this.mainWave_ctx.canvas.width, this.mainWave_ctx.canvas.height);
        this.progressWave_ctx.clearRect(0, 0, this.progressWave_ctx.canvas.width, this.progressWave_ctx.canvas.height);
    }
}
