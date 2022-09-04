# Status

[![NPM](https://img.shields.io/npm/v/celery-ts.svg)](https://www.npmjs.com/package/celery-ts)
[![Maintainability](https://api.codeclimate.com/v1/badges/841b29c65d87bcdcdc85/maintainability)](https://codeclimate.com/github/node-celery-ts/node-celery-ts/maintainability)[![Test Coverage](https://api.codeclimate.com/v1/badges/841b29c65d87bcdcdc85/test_coverage)](https://codeclimate.com/github/node-celery-ts/node-celery-ts/test_coverage)

# Description

`node-celery-ts` is a Celery client for Node.js written in TypeScript.
`node-celery-ts` supports RabbitMQ and Redis result brokers and RPC (over
RabbitMQ) and Redis result backends. `node-celery-ts` provides
higher performance than Celery on PyPy and provides greater feature support than
[`node-celery`](https://github.com/mher/node-celery), including Redis Sentinel
and Cluster, RPC result backends, YAML serialization, zlib task compression, and
Promise-based interfaces. `node-celery-ts` uses
[`amqplib`](https://github.com/squaremo/amqp.node) and
[`ioredis`](https://github.com/luin/ioredis) for RabbitMQ and Redis,
respectively. `node-celery-ts` does not support Amazon SQS or Zookeeper message
brokers, nor does it support SQLAlchemy, Memcached, Cassandra, Elasticsearch,
IronCache, Couchbase, CouchDB, filesystem, or Consul result backends.


# Usage
## Basic
```typescript
import * as Celery from "celery-ts";

const client: Celery.Client = Celery.createClient({
	brokerUrl: "amqp://localhost",
	resultBackend: "redis://localhost",
});

const task: Celery.Task<number> = client.createTask<number>("tasks.add");
const result: Celery.Result<number> = task.applyAsync({
	args: [0, 1],
	kwargs: { },
});

const promise: Promise<number> = result.get();

promise.then(console.log)
       .catch(console.error);
```

## Advanced
```typescript
import * as Celery from "celery-ts";

const id = "7a5b72ab-03d1-47d9-8a9d-54af7c26bd59";
const brokers: Array<Celery.MessageBroker> = [
	Celery.createBroker("amqp://localhost"),
];
const backend: Celery.ResultBackend = Celery.createBackend("redis://localhost");

const client: Celery.Client = new Celery.Client({
	backend,
	brokers,
	id,
});
```

## Message Broker Failover
```typescript
const id = "7a5b72ab-03d1-47d9-8a9d-54af7c26bd59";
const brokers: Array<Celery.MessageBroker> = [
	Celery.createBroker("amqp://localhost"),
	Celery.createBroker("amqp://localhost:5673"),
];
const backend: Celery.ResultBackend = Celery.createBackend("redis://localhost");

const failoverStrategy: Celery.FailoverStrategy = (
	brokers: Array<Celery.MessageBroker>,
): Celery.MessageBroker => {
	return brokers[Math.floor(Math.random() * 2)];
};

const client: Celery.Client = new Celery.Client({
	backend,
	brokers,
	failoverStrategy,
	id,
});
```

## Task Options

```typescript
const client: Celery.Client = Celery.createClient({
	brokerUrl: "amqp://localhost",
	resultBackend: "redis://localhost",
});

const task: Celery.Task<number> = client.createTask<number>("tasks.add");
const result: Celery.Result<number> = task.applyAsync({
	args: [0, 1],
	compression: Celery.Compressor.Zlib,
	eta: new Date(Date.now() + 1000),
	expires: new Date(Date.now() + 5000),
	kwargs: { },
	serializer: Celery.Serializer.Yaml,
});

const promise: Promise<number> = result.get();

promise.then(console.log)
	.catch(console.error);
```

## RabbitMQ
### `AmqpBroker`

```typescript
const options: Celery.AmqpOptions = {
	hostname: "localhost",
	protocol: "amqp",
};
const broker = new Celery.AmqpBroker(options);
```

### `RpcBackend`

```typescript
const id = "7a5b72ab-03d1-47d9-8a9d-54af7c26bd59";
const options: Celery.AmqpOptions = {
	hostname: "localhost",
	protocol: "amqp",
};
const backend = new Celery.RpcBackend(id, options);
```

## Redis

`RedisBackend` and `RedisBroker` both accept a `RedisOptions` object, which is
an interface that can be extended by the user to allow new creational patterns.

### TCP
```typescript
const tcp: RedisOptions = new Celery.RedisTcpOptions({
	host: "localhost",
	protocol: "redis",
});
```

### Unix Socket
```typescript
const socket: RedisOptions = new Celery.RedisSocketOptions({
	path: "/tmp/redis.sock",
	protocol: "redis+socket",
});
```

If you so desire, you may also provide options directly to `ioredis` when using
a TCP or Unix Socket connection. See `BasicRedisOptions` for the full list.

### Sentinel
```typescript
const sentinel: RedisOptions = new Celery.RedisSentinelOptions({
	sentinels: [
		{ host: "localhost", port: 26379 },
		{ host: "localhost", port: 26380 },
	],
	name: "mymaster",
});
```

### Cluster
```typescript
const cluster: RedisOptions = new Celery.RedisClusterOptions({
	nodes: [
		{ host: "localhost", port: 6379 },
		{ host: "localhost", port: 6380 },
	],
});
```

# Thanks

`node-celery-ts` was inspired by
[`node-celery`](https://github.com/mher/node-celery). Special thanks to
[Cameron Will](https://github.com/cwill747) for his guidance.

# License

`node-celery-ts` is licensed under the BSD-3-Clause license.
