import React, {Component} from 'react';
import WebAudio from "./AudioPlayerControllers/WebAudio";
import HttpFetch from "./AudioPlayerControllers/util/HttpFetch";
import M3dAudio from './AudioPlayerControllers/M3dAudio'

class AudioPlayer extends Component {
    constructor(props) {
        super(props);
        this.state={
            time:0,
            percent:0,
            m3dAudio:null
        }
    }

    //TODO: abstract these
    async componentDidMount() {
        // const web_audio = new WebAudio();
        // web_audio.init();
        // const ab = await this.getArrayBuffer();
        /* web_audio.decodeArrayBuffer(ab, (res) => {
             web_audio.loadDecodedArrayBuffer(res);
             console.log(web_audio.source);
             web_audio.source.connect(web_audio.audioContext.destination);
         });*/
        //rxjs observable
        // web_audio.decodeArrayBuffer(ab).subscribe(res => console.log('res',res))

        // const audioBuffer = await web_audio.decodeArrayBuffer(ab);
        // web_audio.loadDecodedArrayBuffer(audioBuffer);
        // web_audio.source.connect(web_audio.audioContext.destination);
        const m3dAudio = new M3dAudio();
        m3dAudio.create();
        await m3dAudio.load('https://firebasestorage.googleapis.com/v0/b/stethee-vet.appspot.com/o/animal_samples%2F-LvrT_snUt2ppUo8xAwW.wav?alt=media&token=7ad4635f-cd8b-4b68-9917-66277664182e');
        await this.setState({m3dAudio})
    }

    play(){
        this.state.m3dAudio.playPause();
        //TODO: make this a subject from frontend and subscribes to M3daudio's getCurrentime
        this.state.m3dAudio.getCurrentTime((res)=>{
            this.setState({time:res.ms, percent:res.percent});
        })
    }

    render() {
        return <div>
            <button onClick={() => this.play()}>play</button>
            <p>{this.state.time}</p>
            <p>{this.state.percent} % </p>
        </div>
    }
}

export default AudioPlayer
