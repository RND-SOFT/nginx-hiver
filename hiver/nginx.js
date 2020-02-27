/* eslint-disable no-sync, no-process-env */
import { docker, currentContainer } from './docker';
import { promises as fs } from 'fs';
import path from 'path';

const UPSTREAM_DIR = '/etc/nginx/conf.d';
const ENDPOINT_PREFIX = '# endpoints=';

export const CONFIG_IDENTIFIER = '# GENERATED BY NGINX_PROXY_SWARM_UPSTREAM';

export function generateConfig (results) {
  let config = '';
  for(let url in results){
    config += "# " + url + "\n";
    config += "upstream up_" + url + " { \n";
    results[url].forEach(srv => {
      config += "  server " + srv + ":80;\n";
    })
    config += "}\n";
    config += "server { \n";
    config += "  server_name " + url + ";\n";
    config += "  listen 80;\n";
    config += "  access_log /var/log/nginx/access.log vhost;\n";
    config += "  location / {\n";
    config += "    proxy_pass http://up_" + url + ";\n";
    config += "  }\n";
    config += "}\n\n";
  }

  fs.writeFile(UPSTREAM_DIR+'/services.conf', config);

  reloadNginx();
}

export function reloadNginx () {
  console.log('Reloading nginx');

  currentContainer.exec({
    Cmd: [ 'sh', '-c', '/usr/sbin/nginx -s reload' ],
    AttachStdin: false,
    AttachStdout: true
  }, (err, exec) => {
    if (err) {
      console.log(err);

      return;
    }

    exec.start({
      hijack: true,
      stdin: false
    }, (_err, stream) => {
      if (_err) {
        console.log(_err);
      }

      docker.modem.demuxStream(stream, process.stdout, process.stderr);
    });
  });
}