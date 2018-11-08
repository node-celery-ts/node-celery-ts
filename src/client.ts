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

import { FailoverStrategy } from "./config";
import { MessageBroker } from "./message_broker";
import { NullBackend } from "./null_backend";
import { ResultBackend } from "./result_backend";
import { Task } from "./task";

/**
 * Celery client. Supports Redis and RabbitMQ message brokers and Redis and RPC
 * result backends.
 */
export class Client {
    private readonly backend: ResultBackend;
    private readonly brokers: Array<MessageBroker>;
    private readonly id: string;
    private readonly taskDefaults: TaskDefaults;
    private readonly failoverStrategy: FailoverStrategy;

    /**
     * @param backend The result backend to store the results of task invocation
     *                on. If `undefined`, `NullBackend` will be used by default
     *                and results will be ignored.
     * @param brokers A list of message brokers to use for task message
     *                transport.
     * @param failoverStrategy The strategy to follow in case of a message
     *                         broker failover event.
     * @param id The UUID of this app.
     * @param taskDefaults Default options to be passed to `new Task`.
     * @returns A `Client` ready to begin creating tasks.
     */
    public constructor({
        backend = new NullBackend(),
        brokers,
        failoverStrategy = getRoundRobinStrategy(brokers.length),
        id,
        taskDefaults = { },
    }: ClientOptions) {
        this.brokers = brokers;
        this.backend = backend;
        this.id = id;
        this.taskDefaults = taskDefaults;
        this.failoverStrategy = failoverStrategy;
    }

    /**
     * @param name The name of the task to execute.
     * @returns A `Task` ready to be invoked.
     */
    public createTask<T>(name: string): Task<T> {
        return new Task({
            ...this.taskDefaults,
            appId: this.id,
            backend: this.backend,
            brokers: this.brokers,
            failoverStrategy: this.failoverStrategy,
            name,
        });
    }

    /**
     * Forcefully disconnects from message brokers and the result backend.
     */
    public async disconnect(): Promise<void> {
        await disconnectOrEndAll(this.brokers, this.backend, "disconnect");
    }

    /**
     * Gently disconnect from message brokers and the result backend.
     */
    public async end(): Promise<void> {
        await disconnectOrEndAll(this.brokers, this.backend, "end");
    }
}

/**
 * Creational options for `Client`'s constructor.
 */
export interface ClientOptions {
    backend?: ResultBackend;
    brokers: Array<MessageBroker>;
    failoverStrategy?: FailoverStrategy;
    id: string;
    taskDefaults?: TaskDefaults;
}

/**
 * Default options passed to `Task`'s constructor.'
 */
export interface TaskDefaults {
    deliveryMode?: "persistent" | "transient";
    hardTimeLimit?: number;
    queue?: string;
    softTimeLimit?: number;
}

/**
 * @param size The number of brokers to cycle through.
 * @returns A `FailoverStrategy` that will cycle through each result broker
 *          sequentially with modulo arithmetic.
 */
export const getRoundRobinStrategy = (size: number): FailoverStrategy => {
    let index = 0;

    return (brokers: Array<MessageBroker>): MessageBroker => {
        const broker = brokers[index];

        ++index;
        index %= size;

        return broker;
    };
};

/**
 * @param brokers To have #disconnect or #end called on them.
 * @param backend To have #disconnect or #end called on it.
 * @param toInvoke The name of the function to invoke.
 * @returns A `Promise` that settles when all invocations have settled.
 */
const disconnectOrEndAll = async (
    brokers: Array<MessageBroker>,
    backend: ResultBackend,
    toInvoke: "disconnect" | "end"
): Promise<Array<void>> => Promise.all(
    brokers.map((b) => b[toInvoke]()).concat(backend[toInvoke]())
);
