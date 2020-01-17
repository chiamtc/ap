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
        return <AudioPlayer url='https://firebasestorage.googleapis.com/v0/b/stethee-vet.appspot.com/o/animal_samples%2F-LvrT_snUt2ppUo8xAwW.wav?alt=media&token=7ad4635f-cd8b-4b68-9917-66277664182e'
        filters={listOfFilter} filterId='F0'/>
    }
}

export default Home;
