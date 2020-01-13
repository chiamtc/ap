/*
import {Canvas, transfer} from 'canvas-webworker';

export default () => {
    self.onmessage = e => {
        console.log('e',e)

        const canvas = new Canvas(300, 300);
        const context = canvas.getContext('2d');

        context.fillRect(100, 100, 100, 100);

        const {data, buffer} = transfer.encode(canvas);
        console.log('data', data, buffer)
        self.postMessage(data, [buffer]);
    }
}*/


import {Canvas, Image, transfer} from 'canvas-webworker';

export default () => {
    self.onmessage = e => {
        /*const canvas = new Canvas(300, 300);
        const context = canvas.getContext('2d');
        context.fillStyle='red';
        context.fillRect(100, 100, 100, 100);
        context.fill();
        const {data, buffer} = transfer.encode(canvas);

        postMessage(data, [buffer]);*/

        postMessage('dasad')
    }
}
/*

const canvas = new Canvas(300, 300);
const context = canvas.getContext('2d');

context.fillRect(100, 100, 100, 100);

const { data, buffer } = transfer.encode(canvas);

self.postMessage(data, [buffer]);*/
