### Based on https://github.com/jwilder/nginx-hiver

### Usage

To run it:

    $ docker run -d -p 80:80 -v /var/run/docker.sock:/tmp/docker.sock:ro rnds/nginx-hiver

Then start any containers you want proxied with an env var `VIRTUAL_HOST=subdomain.youdomain.com`

    $ docker run -e VIRTUAL_HOST=foo.bar.com  ...

The containers being proxied must [expose](https://docs.docker.com/engine/reference/run/#expose-incoming-ports) the port to be proxied, either by using the `EXPOSE` directive in their `Dockerfile` or by using the `--expose` flag to `docker run` or `docker create` and be in the same network. By default, if you don't pass the --net flag when your nginx-hiver container is created, it will only be attached to the default bridge network. This means that it will not be able to connect to containers on networks other than bridge.

Provided your DNS is setup to forward foo.bar.com to the host running nginx-hiver, the request will be routed to a container with the VIRTUAL_HOST env var set.

### Docker Compose

```yaml
version: '2'

services:
  nginx-hiver:
    image: rnds/nginx-hiver
    ports:
      - "80:80"
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro

  whoami:
    image: rnds/whoami
    environment:
      - VIRTUAL_HOST=whoami.local
```

```shell
$ docker-compose up
$ curl -H "Host: whoami.local" localhost
I'm 5b129ab83266
```

### Multiple Ports

If your container exposes multiple ports, nginx-hiver will default to the service running on port 80.  If you need to specify a different port, you can set a VIRTUAL_PORT env var to select a different one.  If your container only exposes one port and it has a VIRTUAL_HOST env var set, that port will be selected.

### Multiple Hosts

If you need to support multiple virtual hosts for a container, you can separate each entry with commas.  For example, `foo.bar.com,baz.bar.com,bar.com` and each host will be setup the same.

### Wildcard Hosts

You can also use wildcards at the beginning and the end of host name, like `*.bar.com` or `foo.bar.*`. Or even a regular expression, which can be very useful in conjunction with a wildcard DNS service like [xip.io](http://xip.io), using `~^foo\.bar\..*\.xip\.io` will match `foo.bar.127.0.0.1.xip.io`, `foo.bar.10.0.2.2.xip.io` and all other given IPs. More information about this topic can be found in the nginx documentation about [`server_names`](http://nginx.org/en/docs/http/server_names.html).

### Multiple Networks

With the addition of [overlay networking](https://docs.docker.com/engine/userguide/networking/get-started-overlay/) in Docker 1.9, your `nginx-hiver` container may need to connect to backend containers on multiple networks. By default, if you don't pass the `--net` flag when your `nginx-hiver` container is created, it will only be attached to the default `bridge` network. This means that it will not be able to connect to containers on networks other than `bridge`.

If you want your `nginx-hiver` container to be attached to a different network, you must pass the `--net=my-network` option in your `docker create` or `docker run` command. At the time of this writing, only a single network can be specified at container creation time. To attach to other networks, you can use the `docker network connect` command after your container is created:

```console
$ docker run -d -p 80:80 -v /var/run/docker.sock:/tmp/docker.sock:ro \
    --name my-nginx-hiver --net my-network rnds/nginx-hiver
$ docker network connect my-other-network my-nginx-hiver
```

In this example, the `my-nginx-hiver` container will be connected to `my-network` and `my-other-network` and will be able to proxy to other containers attached to those networks.

### Internet vs. Local Network Access

If you allow traffic from the public internet to access your `nginx-hiver` container, you may want to restrict some containers to the internal network only, so they cannot be accessed from the public internet.  On containers that should be restricted to the internal network, you should set the environment variable `NETWORK_ACCESS=internal`.  By default, the *internal* network is defined as `127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16`.  To change the list of networks considered internal, mount a file on the `nginx-hiver` at `/etc/nginx/network_internal.conf` with these contents, edited to suit your needs:

```
# These networks are considered "internal"
allow 127.0.0.0/8;
allow 10.0.0.0/8;
allow 192.168.0.0/16;
allow 172.16.0.0/12;

# Traffic from all other networks will be rejected
deny all;
```

When internal-only access is enabled, external clients with be denied with an `HTTP 403 Forbidden`

> If there is a load-balancer / reverse proxy in front of `nginx-hiver` that hides the client IP (example: AWS Application/Elastic Load Balancer), you will need to use the nginx `realip` module (already installed) to extract the client's IP from the HTTP request headers.  Please see the [nginx realip module configuration](http://nginx.org/en/docs/http/ngx_http_realip_module.html) for more details.  This configuration can be added to a new config file and mounted in `/etc/nginx/conf.d/`.

### Default Host

To set the default host for nginx use the env var `DEFAULT_HOST=foo.bar.com` for example

    $ docker run -d -p 80:80 -e DEFAULT_HOST=foo.bar.com -v /var/run/docker.sock:/tmp/docker.sock:ro rnds/nginx-hiver
