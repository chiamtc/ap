import style from './util/Style';

export default class WaveCanvas {
    constructor(wave_wrapper, params) {
        if (!wave_wrapper) {
            throw new Error('WaveCanvas is dependent on WaveWrapper. Pass WaveWrapper class object before initializing WaveCanvas class');
        }
        //WaveWrapper:HTMLElement
        this.wave_wrapper = wave_wrapper;
        this.maxCanvasWidth = params.maxCanvasWidth || 4000; //4k
        this.maxCanvasElementWidth = Math.round(this.maxCanvasWidth / params.pixelRatio);
        // this.hasProgressCanvas = params.waveColor != params.progressColor;
        this.halfPixel = 0.5 / (params.pixelRatio || 1);


        this.mainWave_canvas = null;
        this.progressWave_canvas = null;

    }

    init() {
        this.createMainWaveWrapperCanvas();
        this.createProgressWaveWrapperCanvas();
        this.addCursor();
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
        mainWave_canvas.getContext('2d', {desynchronized: true});
        this.wave_wrapper.mainWave_wrapper.appendChild(mainWave_canvas);
        this.mainWave_canvas = mainWave_canvas;
    }

    createProgressWaveWrapperCanvas() {
        const progressWave_canvas = document.createElement('canvas');
        style(progressWave_canvas, {
            position: 'absolute',
            left: '0px',
            top: 0,
            bottom: 0,
            height: '100%'
        });
        progressWave_canvas.getContext('2d', {desynchronized: true});
        this.wave_wrapper.progressWave_wrapper.appendChild(progressWave_canvas);
        this.progressWave_canvas = progressWave_canvas;
    }

    addCursor() {
        style(this.wave_wrapper.progressWave_wrapper, {
            borderRightWidth: '1px',
            borderRightColor: 'red'
        });
    }
}
