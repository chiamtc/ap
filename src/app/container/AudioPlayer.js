import React, {Component} from 'react';
import Webaudio from "./AudioPlayerControllers/webaudio";
import HttpFetch from "./AudioPlayerControllers/util/HttpFetch";

class AudioPlayer extends Component {
    constructor(props) {
        super(props);
    }

    //TODO: abstract these
    async componentDidMount() {
        const web_audio = new Webaudio();
        web_audio.init();
        const ab = await this.getArrayBuffer();
        web_audio.decodeArrayBuffer(ab, (res) => {
            web_audio.loadDecodedArrayBuffer(res);
            console.log(web_audio.source);
            web_audio.source.connect(web_audio.audioContext.destination);
            web_audio.source.start()
        });
        // console.log(audioBuffer);
    }

    async getArrayBuffer() {
        const url = 'https://firebasestorage.googleapis.com/v0/b/stethee-vet.appspot.com/o/animal_samples%2F-LvrT_snUt2ppUo8xAwW.wav?alt=media&token=7ad4635f-cd8b-4b68-9917-66277664182e';
        const fetcher = new HttpFetch({url});
        return await fetcher.fetchFile();
    }

    render() {
        return <div></div>
    }
}

export default AudioPlayer
