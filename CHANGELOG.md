BM<a name="1.1.0"></a>
# [1.1.0](https://github.com/node-celery-ts/node-celery-ts/compare/v1.0.0...v1.1.0) (2018-08-29)

## Bug Fixes

* `RedisBackend` and `RpcBackend` will no longer throw upon UUID collision
* `RedisBackend` now returns `Promise<string>` instead of `Promise<string | number>`
* `AmqpBroker` now returns amqplib `Channel`s to its resource pool if `#publish` fails

## Features

* Add multiple message broker URI parsing to `createClient`

## Other Changes

* Complete documentation, including internal modules and functions
* Add `Client` and `RedisBackend` integration tests
* Add Vagrantfile to run tests
* Add test cases for `Packer` module
* Add `PromiseQueue` internal container
* Make all functions that return a `Promise` `async`
