import React, {Component} from 'react';
import M3dAudio from '@m3dicine/audio-player'
import {
    subjects,
    PREPARING,
    UNREADY,
    READY,
    PLAY,
    PAUSE,
    PLAYING,
    RESUME,
    PAUSED,
    FINISHED,
    TIMELINE,
    SPECTROGRAM
} from '@m3dicine/audio-player';
/*import {
    PREPARING,
    UNREADY,
    READY,
    PLAY,
    PAUSE,
    PLAYING,
    RESUME,
    PAUSED,
    FINISHED,
    TIMELINE,
    SPECTROGRAM
} from "./M3dAudio/constants";
import M3dAudio from './M3dAudio/M3dAudio';
import {subjects} from './M3dAudio/M3dAudio';*/

import PropTypes from 'prop-types';

class AudioPlayer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            time: 0,
            percent: 0,
            m3dAudio: null,
            gain: 1,
            status: UNREADY,
            filterId: 'F1', //default
            zoomLevel: 20
        }
    }

    //TODO: copy this whole project (front-end only) to @m3dicine/workspace with a script
    async componentDidMount() {
        /*
          Wavesurfer.js
              1. createDrawer() -> drawer.multicanvas.js extends drawer.js ->
                1.5.1 createWrapper() from drawer.js
                1.5.2 createElements() in multicanvas.js

                1.5.1 -> create 'wave' element which has click, dblclick and scroll events

                1.5.2 -> create another 'wave' element -> add two canvases (a. wave canvas, b. progress canvas = if user seeks to the middle of the canvas, left-hand side of the canvas is darker in color)

              2. createBackend() .. create all audiocontext, scriptprocessor, gain etc etc
              3. load() is called after drawer, backend are created via fireEvents
              4. load url + decode + load arraybuffer + empty()
              5. once finished loading arraybuffer to audiocontext and etc etc, drawBuffer() is called
              6. ws.drawBuffer() calls backend.getPeaks():WebAudio then drawer.drawPeaks():Drawer
              7. in drawer.drawPeaks(),
                  7.1 calls drawer.setWidth() -> multicanvas.updateSize() -> ( multicanvas.updateDimensions()  -> entry.updateDimensions()) to update both wave and progress wave dimension in the if statement
                  7.2 it calls drawWave(),which is an empty method initially but details are implemented in 1. because of MultiCanvas extends Drawer
              8. drawWave() -> 8.1 Multicanvas.drawLines (crucial) -> entry.drawLine //using peak
                            -> 8.2 Multicanvas.fillRect to draw a median line

                 8.1 -> a. fill the style with color
                        b. uses 2dcontext from 1.5.2.a to draw line and 1.5.2.b to draw progress line


              ** in the case of zooming in/out, it repeats from step 7.1 based the value of params.minPxPerSec

           */
        const m3dAudio = new M3dAudio();

        // const colors = Chroma.scale(['#ffffff', '#ffa500', '#ff0000']);
        // const colors2 = Chroma.scale(['#111111', '#7a1b0c', '#ff0000', '#ffa100', '#ffff00', '#ffff9e', '#ffffff']).mode('lab'); //
        // const colors3 = Chroma.scale(['#00a8de', '#36469e', '#b52a8b', '#ec215c', '#f67b30', '#dddd37', '#009e54'])

        const colors = ['#ffffff', '#ffa500', '#ff0000'];
        const colors2 = ['#111111', '#7a1b0c', '#ff0000', '#ffa100', '#ffff00', '#ffff9e', '#ffffff'];
        const colors3 = ['#00a8de', '#36469e', '#b52a8b', '#ec215c', '#f67b30', '#dddd37', '#009e54']
        m3dAudio.create({
            container_id: '#waveform-container',
            filters: this.props.filters,
            filterId: this.props.filterId,
            height: 200,
            amplitude: 1,
            normalize: false,
            fill: true,
            scroll: true,
            minZoom: 20,
            maxZoom: 200,
            responsive: true, //will expand the width, causes re-calculate of peak
            mainWaveStyle: {
                backgroundColor: 'transparent',
                lineColor: 'rgb(40, 170, 226, 0.5)'
            },
            progressWaveStyle: {
                // backgroundColor: 'rgba(40, 170, 226,0.1)'
                backgroundColor: 'rgba(255,255,255,0.5)'
            },
            cursorStyle: {
                borderRightWidth: '2px',
                borderRightColor: 'red'
            },
            plugins: [
                {
                    type: SPECTROGRAM,
                    params: {
                        container_id: '#waveform-spectrogram',
                        fftSamples: 1024,
                        windowFunc: 'hamming',
                        spectrumGain: 1000,
                        colorMap: colors2
                    }
                },
                {
                    type: TIMELINE,
                    params: {
                        container_id: '#waveform-timeline-top',
                        interval: 5,
                        direction: 'top',
                        displayInterval: false,
                        fontColor: '#000',
                        fontFamily: `Avenir`,
                        fontSize: 10
                    }
                },
                {
                    type: TIMELINE,
                    params: {
                        container_id: '#waveform-timeline-bottom',
                        interval: 5,
                        direction: 'bottom',
                        displayInterval: true,
                        fontColor: '#000',
                        fontWeight: 800,
                        fontFamily: `Avenir`,
                        fontSize: 10
                    }
                },
            ]
        }); //change this to this.props.filterId
        await m3dAudio.load(this.props.url);
        await this.setState({m3dAudio});
        subjects.m3dAudio_state.subscribe((res) => {
            this.setState({status: res});
        });
    }

    zoomViaButton = (level) => {
        this.state.m3dAudio.zoom(level);
        this.setState({zoomLevel: level})
    };

    play = () => {
        this.state.m3dAudio.playPause();
        //TODO: make this a subject from frontend and subscribes to M3daudio's getCurrentTime
        this.state.m3dAudio.getOnAudioProcessTime((res) => {
            this.setState({time: res.ms, percent: res.percent});
        })
    };

    changeVolume = (e) => {
        const gain = parseFloat(e.target.value);
        this.state.m3dAudio.setVolume(gain);
        this.setState({gain: this.state.m3dAudio.getVolume()});
    };

    //TODO: export to ./AudioPlayerControllers/constants/index.js
    renderStatus() {
        switch (this.state.status) {
            case UNREADY:
                return PREPARING;
            case READY:
                return PLAY;
            case PLAYING:
                return PAUSE;
            case PAUSED:
                return RESUME;
            case FINISHED:
                return PLAY;
        }
    }

    changeFilter = (e) => this.state.m3dAudio.changeFilter(e.target.value);

    renderOptions() {
        let options = [];
        this.props.filters.map((f) => {
            if (f.displayInPicker) options.push(<option key={f.filterID} value={f.filterID}>{f.labelName}</option>)
        });
        return options;
    }

    zoom = (e) => {
        this.state.m3dAudio.zoom(e.target.value);
        this.setState({zoomLevel: e.target.value});
    };

    renderZoomButtons() {
        let buttons = [];
        for (let i = 20; i <= 200; i += 30) {
            const id = 'zoom-btn-'+i;
            buttons.push(<button id={id} key={i} disabled={this.state.status === 'unready'}
                                 onClick={() => this.zoomViaButton(i)}>Zoom {i}
            </button>)
        }
        return buttons;
    }

    render() {
        return <div style={{margin: '32px'}}>
            <select id="filter-select" defaultValue={this.state.filterId} onChange={this.changeFilter}>
                {this.renderOptions()}
            </select>
            <button id="play-btn" disabled={this.state.status === 'unready'}
                    onClick={this.play}>{this.renderStatus()}</button>


            <p>play time: <span id="time-txt">{this.state.time}</span> s</p>
            <p>played percentage: {this.state.percent} % </p>
            <hr/>
            <div>
                Volume: <input id="gain-input" type="range" min="0" max="10" step="0.5" defaultValue={1}
                               onChange={this.changeVolume}/>
                <p>gain: <span id="gain-txt">{this.state.gain}</span></p>
            </div>
            <hr/>
            <div>
                Zoom level: <input type="range" min="20" max="200" step={30} defaultValue={20} onChange={this.zoom}/>
                <p>minpxpersec: <span id="zoom-txt">{this.state.zoomLevel}</span></p>

                {this.renderZoomButtons()}
            </div>
            <hr/>
            <div style={{width: '100%', maxWidth: '700px'}}>
                {/*<div>*/}
                <div id="waveform-timeline-top"/>
                <div id="waveform-container"/>
                <div id="waveform-spectrogram"/>
                <div id="waveform-timeline-bottom"/>
            </div>
            <hr/>
        </div>
    }
}

AudioPlayer.propTypes = {
    filters: PropTypes.array.isRequired,
    filterId: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired
};

export default AudioPlayer
