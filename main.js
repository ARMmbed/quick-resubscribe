'use strict';

var TOKEN = 'YOUR_ACCESS_TOKEN';

var Connector = require('mbed-connector-api');
var promisify = require('es6-promisify');
var co = require('co');

var api = new Connector({
  accessKey: process.env.TOKEN || TOKEN
});

// promisified version of api.getEndpoints
function getEndpoints(type) {
  return new Promise((res, rej) => {
    api.getEndpoints((err, devices) => {
      if (err) return rej(err);
      devices = devices.map(d => {
        d.endpoint = d.name;
        return d;
      });
      res(devices);
    }, { parameters: { type: type } });
  });
}


co.wrap(function*() {
  try {
    console.log('gonna put Callback now...');

    yield promisify(api.putCallback.bind(api))({ url: 'http://213.30.161.139/armRestDC-1.0/rest/processNotifications' });

    console.log('putCallback OK');

    var endpoints = yield getEndpoints();
    endpoints = endpoints.filter(e => e.type.indexOf('MACHINE') === 0);

    console.log('got endpoints', endpoints);

    var allResources = yield Promise.all(endpoints.map(e => {
      return promisify(api.getResources.bind(api))(e.name);
    }));

    allResources = allResources.map(r => r.filter(a => a.obs).map(a => a.uri));

    console.log('got resources', allResources);


    yield Promise.all(allResources.map((resources, rix) => {
      let endpoint = endpoints[rix].name;

      return co.wrap(function*() {
        for (let res of resources) {
          console.log(endpoint, 'subscribing to', res);
          yield promisify(api.putResourceSubscription.bind(api))(endpoint, res);
          console.log(endpoint, 'subscribed to', res);
          yield wait(100);
        }
      })();
    }));

    console.log('Done');
  }
  catch (ex) {
    console.error('Oh noes...', ex);
  }
})();

function wait(ms) {
  return new Promise((res, rej) => {
    setTimeout(res, ms);
  });
}
