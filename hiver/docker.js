import Docker from 'dockerode';
import { EventEmitter } from 'events';
import { generateConfig } from './nginx';

const fs = require('fs');
export const docker = new Docker();

let cgroup = fs.readFileSync('/proc/self/cgroup', 'UTF-8').match(/docker\/([A-Za-z0-9]+)/);
export const currentContainer = docker.getContainer(cgroup[1]);


export function getEnvValue (env, variable) {
  const start = `${variable}=`;

  for (let i = 0; i < env.length; i++) {
    if (env[i].startsWith(start)) {
      return env[i].split('=').slice(1).
        join('=');
    }
  }

  return null;
}

export async function getAllServices () {
  let inspection = await currentContainer.inspect();

  let allowNetworks = []
  for(let net_name in inspection.NetworkSettings.Networks){
    allowNetworks.push(inspection.NetworkSettings.Networks[net_name].NetworkID)
  }

  const services = await docker.listServices();
  let result = {};
  services.forEach(service => {
    if (!service.Spec.TaskTemplate.ContainerSpec.Env){ return }
    let vhost = service.Spec.TaskTemplate.ContainerSpec.Env.find(e => e.match('VIRTUAL_HOST='))
    if (vhost){
      let host = vhost.split('=')[1];
      if (!result[host]){ result[host] = [] }
      if (service.Endpoint.VirtualIPs) {
        service.Endpoint.VirtualIPs.forEach( vip => {
          result[host].push( service.Spec.Name );
        })
      }
    }
  })
  generateConfig(result);
}

export function dockerEventListener (cb) {
  docker.getEvents().then(stream => {
    stream.setEncoding('utf8');
    stream.on('data', json => {
      const data = JSON.parse(json);

      cb(data);
    });
  });
}

export class ContainerWatcher extends EventEmitter {
  constructor () {
    super();
    this.setupListener();
  }

  setupListener () {
    dockerEventListener(event => {
      if (event.Type === 'container') {
        this.handleContainerEvent(event);
      } else if (event.Type === 'service') {
        this.handleServiceEvent(event);
      }
    });
  }

  handleContainerEvent (event) {
    switch (event.Action) {
      case 'kill':
        this.emit('containerKilled', event.id, event.Actor.Attributes.name);
        break;
      case 'start':
        this.emit('containerStarted', event.id);

      // no default
    }
  }

  handleServiceEvent (event) {
    switch (event.Action) {
      case 'create':
        this.emit('serviceCreated', event.Actor.ID, event.Actor.Attributes.name);

      // no default
    }
  }
}
