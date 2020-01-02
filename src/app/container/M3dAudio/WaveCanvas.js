import style from './util/Style';

export default class WaveCanvas {
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
    constructor(params) {
        this.start = 0;
        this.end = 1;

        this._mainWave_canvas = null;
        this.mainWave_ctx = null;
        this.progressWave_canvas = null;
        this._progressWave_ctx = null;

        this.overlap = 2;

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
            background: '#28aae2' // I added myself //hardcoded
        });
        this._progressWave_ctx = progressWave_canvas.getContext('2d', {desynchronized: true});
        this.progressWave_canvas = progressWave_canvas;
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
        this.progressWave_canvas.width = width;
        this.progressWave_canvas.height = height;
        style(this.progressWave_canvas, {...elementSize, display: 'block'});
    }


    clearWave() {
        this.mainWave_ctx.clearRect(0, 0, this.mainWave_ctx.canvas.width, this.mainWave_ctx.canvas.height);
        this._progressWave_ctx.clearRect(0, 0, this._progressWave_ctx.canvas.width, this._progressWave_ctx.canvas.height);
    }
}
