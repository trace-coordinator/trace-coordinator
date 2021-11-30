# trace-coordinator

Trace coordinator's API follows [Trace Server Protocol (TSP)](https://theia-ide.github.io/trace-server-protocol)

## Usage

- Clone the repo `yarn`.
- You must start all the `trace-server` nodes before starting `trace-coordinator`. It will exit if detecting one of the `trace-server` node is unreachable.
- `yarn build` to compile then `yarn start` to run production build.
- `yarn dev` to run dev server (watch mode).

### Configuration

```json
// package.json
"trace-coordinator": {
    "port": 8080,
    "trace-servers": [
        {
            "url": "http://buildServer.dorsal.polymtl.ca:8080",
            "traces-uri": "/home/ubuntu/trace-coordinator-test-set/original-clones/trace-server-0"
        },
        {
            "url": "http://compute3.dorsal.polymtl.ca:8080",
            "traces-uri": "/home/ubuntu/trace-coordinator-test-set/original-clones/trace-server-1"
        }
    ]
}
```

- `port`: The port for `trace-coordinator` to listen to.
- `trace-servers`: Array of `trace-server`'s details.
  - `url`: URL of the `trace-server`.
  - `traces-uri`: `trace-coordinator` currently has a special endpoint outside of [TSP](https://theia-ide.github.io/trace-server-protocol), `POST /tsp/api/dev/createExperimentsFromTraces`. Upon calling it, the `traces-uri` is used as the parent folder in which all sub-folder containing traces are imported to the corresponding`trace-server`, for which an experiment is then created from.
