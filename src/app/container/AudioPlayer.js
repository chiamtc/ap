import React, {Component} from 'react';
import WebAudio from "./AudioPlayerControllers/WebAudio";
import HttpFetch from "./AudioPlayerControllers/util/HttpFetch";
import M3dAudio from './AudioPlayerControllers/M3dAudio'

class AudioPlayer extends Component {
    constructor(props) {
        super(props);
        this.state = {
            time: 0,
            percent: 0,
            m3dAudio: null,
            gain: 1
        }
    }

    //TODO: abstract these
    async componentDidMount() {
        const m3dAudio = new M3dAudio();
        m3dAudio.create();
        await m3dAudio.load('https://firebasestorage.googleapis.com/v0/b/stethee-vet.appspot.com/o/animal_samples%2F-LvrT_snUt2ppUo8xAwW.wav?alt=media&token=7ad4635f-cd8b-4b68-9917-66277664182e');

        await this.setState({m3dAudio})
    }

    play = () => {
        this.state.m3dAudio.playPause();
        //TODO: make this a subject from frontend and subscribes to M3daudio's getCurrentime
        this.state.m3dAudio.getCurrentTime((res) => {
            this.setState({time: res.ms, percent: res.percent});
        })
    }

    changeVolume = (e) => {
        const gain = parseFloat(e.target.value);
        this.state.m3dAudio.setVolume(gain);
        this.setState({gain:this.state.m3dAudio.getVolume()});
    }

    render() {
        return <div>
            <button onClick={this.play}>play</button>
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

export default AudioPlayer
