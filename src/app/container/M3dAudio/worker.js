export default () => {
    self.onmessage =  e => { // eslint-disable-line no-restricted-globals
        if (!e) return;

        const users = [];

        const userDetails = {
            name: 'Jane Doe',
            email: 'jane.doe@gmail.com',
            id: 1
        };

        for (let i = 0; i < e.data; i++) {

            userDetails.id = i++
            userDetails.dateJoined = Date.now()

            users.push(userDetails);
        }
      console.log('e',e)
                postMessage(users);
    }
}
