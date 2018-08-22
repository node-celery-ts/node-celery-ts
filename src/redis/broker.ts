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

import { DEFAULT_REDIS_OPTIONS, RedisOptions } from "./options";

import { MessageBroker } from "../message_broker";
import { TaskMessage } from "../messages";
import { isNullOrUndefined } from "../utility";

import * as IoRedis from "ioredis";

/**
 * RedisBroker implements MessageBroker using the Redis in-memory database.
 * Messages are not durable and will not survive a broker restart.
 */
export class RedisBroker implements MessageBroker {
    private readonly options: RedisOptions;
    private readonly connection: IoRedis.Redis;

    /**
     * Constructs a RedisBroker with the given RedisOptions object.
     *
     * @param options The configuration of the connection. If undefined, will
     *                connect over TCP to the default server at localhost.
     * @returns A RedisBroker that is connected to the specified Redis server.
     */
    public constructor(options?: RedisOptions) {
        this.options = (() => {
            if (isNullOrUndefined(options)) {
                return DEFAULT_REDIS_OPTIONS;
            }

            return options;
        })();

        this.connection = this.options.createClient({ keyPrefix: "" });
    }

    /**
     * Quickly disconnects from the Redis server. Should only be called once.
     * Any operations in flight are cancelled.
     *
     * @returns A Promise that resolves when the connection is servered.
     */
    public disconnect(): Promise<void> {
        return Promise.resolve(this.connection.disconnect());
    }

    /**
     * Gently disconnects from the Redis server. Should only be called once.
     *
     * @returns A Promise that resolves when all operations in flight are
     *          executed and the connection is severed.
     */
    public end(): Promise<void> {
        return Promise.resolve(this.connection.quit())
            .then(() => this.connection.disconnect());
    }

    /**
     * Publishes the given message to the Redis server.
     * Publishing is emulated by `LPUSH`ing to `celery`. Workers use `RPOP` to
     * extract tasks from the queue.
     *
     * @param message The message to be published. Serialized to UTF-8 encoded
     *                JSON before being `LPUSH`ed onto `celery`.
     * @returns A Promise that resolves to the response of the Redis server
     *          after the `LPUSH` operation is completed.
     */
    public publish(message: TaskMessage): Promise<string> {
        const toPublish = JSON.stringify(message);
        const queue = "celery";

        return Promise.resolve(this.connection.lpush(queue, toPublish));
    }
}
