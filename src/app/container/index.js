import React, {Component} from 'react';
import AudioPlayer from "./AudioPlayer";
import {listOfFilter} from "./M3dAudio/constants/filterschema"; //will be moved to parent class of AP
class Home extends Component {
    constructor(props) {
        super(props);
        this.state = {
            url:''
        }
    }

    componentDidMount() {

        this.setState({url:'https://firebasestorage.googleapis.com/v0/b/stethee-vet.appspot.com/o/animal_samples%2F-LvrT_snUt2ppUo8xAwW.wav?alt=media&token=7ad4635f-cd8b-4b68-9917-66277664182e'})
        // this.setState({url:'https://firebasestorage.googleapis.com/v0/b/podstetheedata.appspot.com/o/human_samples%2F-Lw1PemOHIdz5GxaaGIx?alt=media&token=b04378b7-bd3a-4598-a2d6-f943b04717f3'})
    }

    componentDidUpdate(prevProps,prevState){
        if(prevState.url !== this.state.url){
            this.setState({url:this.state.url})
        }
    }

    change = (param)=>{
        this.setState({url:param});
    }

    render() {
        if(this.state.url === '') return <div>Loading...</div>
        return (
            <div>
                <AudioPlayer url={this.state.url} filters={listOfFilter} filterId='F0'/>
                    <hr/>
                    <button onClick={() => this.change('https://firebasestorage.googleapis.com/v0/b/stethee-vet.appspot.com/o/animal_samples%2F-LvrT_snUt2ppUo8xAwW.wav?alt=media&token=7ad4635f-cd8b-4b68-9917-66277664182e')}>vet 20 secs -LvrT_snUt2ppUo8xAwW</button>
                    <button onClick={() => this.change("https://firebasestorage.googleapis.com/v0/b/podstetheedata.appspot.com/o/human_samples%2F-LvrfS3FUwxCIH8_3uT3.wav?alt=media&token=24d4a22a-793f-4d10-b2cb-3345e188fb6b")}>pro 20 secs -LvrfS3FUwxCIH8_3uT3</button>
                    <button onClick={() => this.change("https://firebasestorage.googleapis.com/v0/b/podstetheedata.appspot.com/o/human_samples%2F-Lw1PemOHIdz5GxaaGIx?alt=media&token=b04378b7-bd3a-4598-a2d6-f943b04717f3")}>pro 12 secs -Lw1PemOHIdz5GxaaGIx</button>
            </div>)
    }
}

export default Home;
