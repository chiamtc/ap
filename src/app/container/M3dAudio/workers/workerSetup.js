//source reference: https://codesandbox.io/s/reactworker-7v5lv
export default class WebWorker {
    constructor(worker) {
        const code = worker.toString();
        const blob = new Blob(['('+code+')()']);
        return new Worker(URL.createObjectURL(blob));
    }
}
