import React, {Component} from 'react';
import AudioPlayer from "./AudioPlayer";

class Home extends Component {
    constructor(props) {
        super(props);
        this.state = {}
    }

    componentDidMount() {

    }

    render() {
        return <AudioPlayer/>
    }
}

export default Home;
