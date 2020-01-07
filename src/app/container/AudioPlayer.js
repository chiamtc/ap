import React, {Component} from 'react';
import M3dAudio from './M3dAudio/M3dAudio';
import {subjects} from './M3dAudio/M3dAudio';
import style from "./M3dAudio/util/Style";
import {
    PREPARING,
    UNREADY,
    READY,
    PLAY,
    PAUSE,
    PLAYING,
    RESUME,
    PAUSED,
    FINISHED
} from "./M3dAudio/constants";
import PropTypes from 'prop-types';

class AudioPlayer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            time: 0,
            percent: 0,
            m3dAudio: null,
            gain: 1,
            status: 'unready',
            filterId: 'F1',
            zoomLevel: 20
        }
    }

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
        m3dAudio.create({
            container_id: '#waveform-container',
            filters: this.props.filters,
            filterId: this.props.filterId,
            height: 250,
            amplitude: 1,
            fill: true,
            scroll: true,
            responsive: true,
            mainWaveStyle: {
                backgroundColor: 'transparent',
                lineColor: 'rgb(40, 170, 226)'
            },
            progressWaveStyle: {
                backgroundColor: 'rgba(40, 170, 226,0.05)',
                lineColor: 'violet'
            },
            cursorStyle: {
                borderRightWidth: '2px',
                borderRightColor: 'red'
            },
            plugins: [
                {
                    type: 'timeline',
                    params: {
                        container_id: '#waveform-timeline-top',
                        interval: 5,
                        direction: 'top',
                        displayInterval: false
                    }
                },
                {
                    type: 'timeline',
                    params: {
                        container_id: '#waveform-timeline-bottom',
                        interval: 5,
                        direction: 'bottom',
                        displayInterval: true
                    }
                }]
        }); //change this to this.props.filterId
        await m3dAudio.load(this.props.url);
        await this.setState({m3dAudio});
        subjects.m3dAudio_state.subscribe((res) => {
            this.setState({status: res});
        });
    }

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
    }

    render() {
        return <div style={{margin: '2em'}}>
            <select defaultValue={this.state.filterId} onChange={this.changeFilter}>
                {this.renderOptions()}
            </select>
            <button disabled={this.state.status === 'unready'} onClick={this.play}>{this.renderStatus()}</button>
            <hr/>
            <div>
                Volume: <input type="range" min="0" max="10" step="0.5" defaultValue={1} onChange={this.changeVolume}/>
                <p>gain: {this.state.gain}</p>
            </div>
            <hr/>
            <div>
                <p>play time: {this.state.time} s</p>
                <p>played percentage: {this.state.percent} % </p>
            </div>
            <div>
                Zoom level: <input type="range" min="20" max="200" defaultValue={20} onChange={this.zoom}/>
                <p>minpxpersec: {this.state.zoomLevel}</p>
            </div>
            <div style={{maxWidth: '600px', overflow: 'auto'}}>
                <div id="waveform-timeline-top"/>
                <div id="waveform-container"/>
                <div id="waveform-timeline-bottom"/>
            </div>
        </div>
    }
}

AudioPlayer.propTypes = {
    filters: PropTypes.array.isRequired,
    filterId: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired
};

export default AudioPlayer
