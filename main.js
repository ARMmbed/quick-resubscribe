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

function putResource(endpoint, r) {
  return new Promise((res, rej) => {
    api.putResourceSubscription(endpoint, r, function(err) {
      if (err) console.error('subscribe error', endpoint, r, err);
      console.log('subscribed', endpoint, r);
      if (err) return rej(err);
      setTimeout(() => {
        res();
      }, 1500);
    });
  });
}

co.wrap(function*() {
  try {
    yield promisify(api.startLongPolling.bind(api))();

    console.log('Started long polling');

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
        try {

          for (let r of resources) {
            console.log('subscribing', endpoint, r);
            yield putResource(endpoint, r);
          }
        }
        catch (ex) {
          console.error('Error...', ex.toString());
        }
      })();
    }));

    console.log('gonna put Callback now...');

    yield promisify(api.putCallback.bind(api))({ url: 'http://213.30.161.139/armRestDC-1.0/rest/processNotifications' });

    console.log('putCallback OK');

    console.log('Done');

    process.exit(1);
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
