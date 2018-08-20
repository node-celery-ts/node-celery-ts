// BSD 3-Clause License
//
// Copyright (c) 2018, IBM Corporation
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// * Redistributions of source code must retain the above copyright notice, this
//   list of conditions and the following disclaimer.
//
// * Redistributions in binary form must reproduce the above copyright notice,
//   this list of conditions and the following disclaimer in the documentation
//   and/or other materials provided with the distribution.
//
// * Neither the name of the copyright holder nor the names of its
//   contributors may be used to endorse or promote products derived from
//   this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

import * as Celery from "../src";

import * as Chai from "chai";
import * as Ioredis from "ioredis";
import * as Mocha from "mocha";
import * as Uuid from "uuid";

Mocha.describe("Celery.RedisBackend", () => {
    const REDIS_URI: string = "redis://localhost";

    const createRedisClient = () => new Ioredis(REDIS_URI);

    const getKey = (id: string) => `celery-task-meta-${id}`;

    const createRedisBackend = () => new Celery.RedisBackend();

    Mocha.it("should receive messages via SET/GET", async () => {
        const id = Uuid.v4();
        const message = {
            children: [],
            result: "foo",
            status: Celery.Status.Success,
            task_id: id,
            traceback: null,
        };

        const redis = createRedisClient();
        await redis.set(getKey(id), JSON.stringify(message));

        const backend = createRedisBackend();
        const result = await backend.get<string>({ taskId: id, timeout: 20 });

        Chai.expect(result).to.deep.equal(message);

        await backend.end();
        await redis.flushall();
        await redis.quit();
        redis.disconnect();
    });

    Mocha.it("should receive messages via PUBLISH/SUBSCRIBE", async () => {
        const id = Uuid.v4();
        const message = {
            children: [],
            result: "foo",
            status: Celery.Status.Success,
            task_id: id,
            traceback: null,
        };

        const backend = createRedisBackend();
        const result = backend.get<string>({ taskId: id, timeout: 20 });

        await new Promise((resolve) => setTimeout(resolve, 5));

        const redis = createRedisClient();
        await redis.publish(getKey(id), JSON.stringify(message));

        Chai.expect(await result).to.deep.equal(message);

        await backend.end();
        await redis.flushall();
        await redis.quit();
        redis.disconnect();
    });

    Mocha.it("should set with expected timeout", async () => {
        const id = Uuid.v4();
        const message = {
            children: [],
            result: "foo",
            status: Celery.Status.Success,
            task_id: id,
            traceback: null,
        };

        const redis = createRedisClient();

        const backend = createRedisBackend();
        await backend.put<string>(message);

        const expry = await redis.ttl(getKey(id));
        const placed = JSON.parse(await redis.get(getKey(id)));

        Chai.expect(placed).to.deep.equal(message);
        Chai.expect(expry).to.be.greaterThan(8638); // give 2 seconds leeway

        await backend.end();
        await redis.flushall();
        await redis.quit();
        redis.disconnect();
    });

    Mocha.it("should DELETE from Redis when #delete is invoked", async () => {
        const id = Uuid.v4();
        const message = {
            children: [],
            result: "foo",
            status: Celery.Status.Success,
            task_id: id,
            traceback: null,
        };

        const redis = createRedisClient();
        await redis.set(getKey(id), JSON.stringify(message));

        const backend = createRedisBackend();

        Chai.expect(await backend.delete(id)).to.deep.equal("1");
        Chai.expect(await redis.exists(getKey(id))).to.deep.equal(0);

        await backend.end();
        await redis.flushall();
        await redis.quit();
        redis.disconnect();
    });

    Mocha.it("should receive messages published before #get", async () => {
        const id = Uuid.v4();
        const message = {
            children: [],
            result: "foo",
            status: Celery.Status.Success,
            task_id: id,
            traceback: null,
        };

        const backend = createRedisBackend();

        await new Promise((resolve) => setTimeout(resolve, 5));

        const redis = createRedisClient();
        await redis.publish(getKey(id), JSON.stringify(message));

        Chai.expect(await backend.get<string>({ taskId: id }))
            .to.deep.equal(message);

        await backend.end();
        await redis.flushall();
        await redis.quit();
        redis.disconnect();
    });
});
