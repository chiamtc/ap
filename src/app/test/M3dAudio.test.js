import M3dAudio from "../container/M3dAudio/M3dAudio";

describe('M3dAudio test suite', ()=>{
    beforeEach(() => {
    });

    it('instantiate M3dAudio class' , ()=>{
        document.body.innerHTML =
            '<div><div id="waveform-container"/></div>';

        const a = new M3dAudio();
        a.create({
            container_id: '#waveform-container',
            filters: [],
            filterId: "F1",
            mainWaveStyle: {
                backgroundColor: 'transparent',
                lineColor: 'rgb(40, 170, 226, 0.5)'
            },
            progressWaveStyle: {
                backgroundColor: 'rgba(40, 170, 226,0.1)'
            },
            cursorStyle: {
                borderRightWidth: '2px',
                borderRightColor: 'red'
            },
        });
        
    });

});
