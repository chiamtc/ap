import React, {Component} from 'react';
import M3dAudio from './M3dAudio/M3dAudio';
import {subjects} from './M3dAudio/M3dAudio';
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
            filterId: 'F7',
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
            height: 300,
            mainWaveStyle:{
                backgroundColor:'white',
                lineColor:'blue'
            },
            progressWaveStyle:{
                backgroundColor:'rgba(40, 170, 226,0.1)',
                lineColor:'violet'
            }
        }); //change this to this.props.filterId
        await m3dAudio.load(this.props.url);
        await this.setState({m3dAudio});
        subjects.m3dAudio_state.subscribe((res) => this.setState({status: res}));
    }

    play = () => {
        this.state.m3dAudio.playPause();
        //TODO: make this a subject from frontend and subscribes to M3daudio's getCurrentTime
        this.state.m3dAudio.getOnAudioProcessTime((res) => {
            this.setState({time: res.ms, percent: res.percent});
        })
    }

    changeVolume = (e) => {
        const gain = parseFloat(e.target.value);
        this.state.m3dAudio.setVolume(gain);
        this.setState({gain: this.state.m3dAudio.getVolume()});
    }

    //TODO: export to ./AudioPlayerControllers/constants/index.js
    renderStatus() {
        switch (this.state.status) {
            case 'unready':
                return 'preparing';
            case 'ready':
                return 'play';
            case 'playing':
                return 'pause';
            case 'paused':
                return 'resume';
            case 'finished':
                return 'play';
        }
    }

    changeFilter = (e) => {
        this.state.m3dAudio.changeFilter(e.target.value);
    };

    renderOptions() {
        let options = [];
        this.props.filters.map((f) => options.push(<option key={f.filterID} value={f.filterID}>{f.labelName}</option>));
        return options;
    }

    render() {
        return <div style={{padding: '32px'}}>
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
            <div id="waveform-container" style={{border: '1px solid black'}}></div>
        </div>
    }
}

AudioPlayer.propTypes = {
    filters: PropTypes.array.isRequired,
    filterId: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired
};

export default AudioPlayer
