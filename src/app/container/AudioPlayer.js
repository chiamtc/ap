import React, {Component} from 'react';
import M3dAudio from './AudioPlayerControllers/M3dAudio';
import {subjects} from './AudioPlayerControllers/M3dAudio';
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
            filterId:'F7',
        }
    }

    async componentDidMount() {
        const m3dAudio = new M3dAudio();
        m3dAudio.create({filters:this.props.filters, filterId: this.props.filterId}); //change this to this.props.filterId
        await m3dAudio.load(this.props.url);
        await this.setState({m3dAudio});
        subjects.m3dAudio_state.subscribe((res) => this.setState({status: res}));
    }

    play = () => {
        this.state.m3dAudio.playPause();
        //TODO: make this a subject from frontend and subscribes to M3daudio's getCurrentTime
        this.state.m3dAudio.getCurrentTime((res) => {
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
        return <div>
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
        </div>
    }
}

AudioPlayer.propTypes={
    filters:PropTypes.array.isRequired,
    filterId: PropTypes.string.isRequired,
    url:PropTypes.string.isRequired
};

export default AudioPlayer
