//TODO: check if current browser supports fetch api
//TODO: more types other than arrayBuffer()?
class HttpFetch {

    constructor(params) {
        this.url = params.url;
    }

    async fetchFile() {
        const response = await fetch(this.url);
        return await response.arrayBuffer();
    }


}

export default HttpFetch;
