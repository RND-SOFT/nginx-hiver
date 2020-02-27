/* eslint-disable no-console, no-warning-comments */
import { ContainerWatcher, getAllServices } from './docker';
import { generateConfig } from './nginx';

const dockerWatcher = new ContainerWatcher();

dockerWatcher.on('containerKilled', containerId => {
  console.log('containerKilled', containerId);
  getAllServices();
});

dockerWatcher.on('containerStarted', containerId => {
  console.log('containerStarted', containerId);
  getAllServices();
});

dockerWatcher.on('serviceCreated', (id, serviceName) => {
  console.log('serviceCreated', id, serviceName);
  getAllServices();
});

function checkServices () {
  const createTimeout = () => setTimeout(checkServices, 60000);

  new Promise( (resolve, reject) => {
    return resolve(getAllServices())
  }).
  catch(err => {
    console.log(err);
  }).
  finally(createTimeout);
}

checkServices()

