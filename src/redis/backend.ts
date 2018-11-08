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

import { PromiseMap, ResourcePool } from "../containers";
import { ResultMessage, Status } from "../messages";
import { GetOptions, ResultBackend } from "../result_backend";
import { createTimeoutPromise, isNullOrUndefined } from "../utility";

import * as IoRedis from "ioredis";

/**
 * Redis in-memory database result backend.
 * Uses connection pooling with one connection per active subscriber.
 */
export class RedisBackend implements ResultBackend {
    private static readonly TIMEOUT: number = 86400000;
    private static readonly UUID_REGEX: RegExp = // tslint:disable:max-line-length
        /^celery-task-meta-([A-Fa-f\d]{8}-[A-Fa-f\d]{4}-[A-Fa-f\d]{4}-[A-Fa-f\d]{4}-[A-Fa-f\d]{12})$/;
    private static readonly UUID_INDEX: number = 1;

    private readonly options: RedisOptions;
    private readonly pool: ResourcePool<IoRedis.Redis>;
    private readonly results: PromiseMap<string, string> =
        new PromiseMap<string, string>(RedisBackend.TIMEOUT);
    private readonly subscriber: Promise<IoRedis.Redis>;

    /**
     * @param options The options to construct new clients with. If undefined,
     *                will use the default options from Redis.Options
     * @returns A RedisBackend with an empty connection pool.
     */
    public constructor(options?: RedisOptions) {
        this.options = (() => {
            if (isNullOrUndefined(options)) {
                return DEFAULT_REDIS_OPTIONS;
            }

            return options;
        })();

        this.pool = new ResourcePool<IoRedis.Redis>(
            () => this.options.createClient({ keyPrefix: "celery-task-meta-" }),
            async (connection) => {
                const response = await connection.quit();
                connection.disconnect();

                return response;
            },
            2,
        );

        this.subscriber = this.pool.get()
            .then(async (subscriber) => {
                await subscriber.psubscribe("celery-task-meta-*");
                subscriber.on(
                    "pmessage",
                    (_, channel, message) => this.onMessage(channel, message)
                );

                return subscriber;
            });
    }

    /**
     * Sets and publishes a value with the same key as the message's task ID.
     * Implemented with a MULTI SETEX PUBLISH EXEC pipeline.
     *
     * @param message The result to push onto the backend.
     * @returns A Promise that resolves to the response of the Redis server
     *          after the message has been set and published.
     */
    public async put<T>(message: ResultMessage<T>): Promise<string> {
        const key = message.task_id;
        const toPut = JSON.stringify(message);

        return this.pool.use(async (client): Promise<string> => client.multi()
            .setex(key, RedisBackend.TIMEOUT / 1000, toPut)
            .publish(key, toPut)
            .exec()
        );
    }

    /**
     * Uses two connections to SUBSCRIBE to the correct key ID, then try GET.
     * If GET returns a successful result,
     * immediately UNSUBSCRIBE, parse the message, and fulfill the Promise.
     * Otherwise, wait until a successful result is received on the subscribed
     * connection and resolve to the parsed result.
     *
     * @param taskId The UUID of the task whose result is to be fetched.
     * @param timeout The time to wait before rejecting the Promise. If
     *                undefined, no timeout will be set.
     * @returns A Promise that resolves to the result received from Redis.
     */
    public async get<T>({
        taskId,
        timeout
    }: GetOptions): Promise<ResultMessage<T>> {
        const listen = async (): Promise<ResultMessage<T>> => {
            const raw = await this.results.get(taskId);

            return JSON.parse(raw);
        };

        if (this.results.has(taskId)) {
            return listen();
        }

        return this.pool.use(async (client) => {
            const response = (async () => {
                const raw = await client.get(taskId);

                if (isNullOrUndefined(raw)) {
                    return listen();
                }

                const parsed: ResultMessage<T> = JSON.parse(raw);

                if (parsed.status !== Status.Success) {
                    return listen();
                }

                return parsed;
            })();

            return createTimeoutPromise(response, timeout);
        });
    }

    /**
     * Uses DELETE. If a result is in flight (not yet published and set), must
     * be called again after the result has been set for it to be removed from
     * Redis.
     *
     * @param taskId The UUID of the task whose result is to be deleted from
     *               Redis.
     * @returns A Promise that resolves to the DELETE response.
     */
    public async delete(taskId: string): Promise<string> {
        return this.pool.use(async (client): Promise<string> => {
            this.results.delete(taskId);

            return client.del(taskId);
        });
    }

    /**
     * Gently terminates the connection with Redis using QUIT. Same as #end.
     *
     * @returns A Promise that resolves to the QUIT response from Redis.
     *
     * @see #end
     */
    public async disconnect(): Promise<void> {
        await this.end();
    }

    /**
     * Gently terminates the connection with Redis using QUIT.
     *
     * @returns A Promise that resolves to the QUIT response from Redis.
     */
    public async end(): Promise<void> {
        const subscriber = await this.subscriber;
        await subscriber.punsubscribe("celery-task-meta-*");
        this.pool.return(subscriber);

        await this.pool.destroyAll();
    }

    /**
     * @returns A lossy representation of Redis connection options.
     */
    public uri(): string {
        return this.options.createUri();
    }

    /**
     * @param channel The channel that this message was published to.
     * @param message The payload  of the PUBLISH command.
     *
     * @throws Error If a message is received by the subscription that isn't
     *               a prefixed UUID.
     */
    private onMessage(channel: string, message: string): void {
        const maybeId = channel.match(RedisBackend.UUID_REGEX);

        if (isNullOrUndefined(maybeId)) {
            throw new Error(`channel ${channel} is not a celery result`);
        }

        const id = maybeId[RedisBackend.UUID_INDEX];

        this.results.resolve(id, message);
    }
}
