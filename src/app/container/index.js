import React, {Component} from 'react';
import AudioPlayer from "./AudioPlayer";
import {listOfFilter} from "./M3dAudio/constants/filterschema"; //will be moved to parent class of AP
class Home extends Component {
    constructor(props) {
        super(props);
        this.state = {}
    }

    componentDidMount() {

    }

    render() {
        return <AudioPlayer url='https://firebasestorage.googleapis.com/v0/b/podstetheedata.appspot.com/o/human_samples%2F-LvrfS3FUwxCIH8_3uT3.wav?alt=media&token=24d4a22a-793f-4d10-b2cb-3345e188fb6b'
        filters={listOfFilter} filterId='F7'/>
    }
}

export default Home;
