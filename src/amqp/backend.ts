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

import { AmqpOptions, DEFAULT_AMQP_OPTIONS } from "./options";

import { PromiseMap, ResourcePool } from "../containers";
import { UnimplementedError } from "../errors";
import { ResultMessage } from "../messages";
import { GetOptions, ResultBackend } from "../result_backend";
import {
    createTimeoutPromise,
    isNullOrUndefined,
    promisifyEvent,
} from "../utility";

import * as AmqpLib from "amqplib";

/**
 * RabbitMQ result backend using RPC and one queue per client.
 */
export class RpcBackend implements ResultBackend {
    private readonly channels: ResourcePool<AmqpLib.Channel>;
    private readonly connection: Promise<AmqpLib.Connection>;
    private readonly consumer: Promise<AmqpLib.Channel>;
    private readonly consumerTag: Promise<string>;
    private readonly options: AmqpOptions;
    private promises: PromiseMap<string, Message>;
    private readonly routingKey: string;

    /**
     * Constructs an RpcBackend with the given routing key and options.
     * Queues up connection, creation, queue assertion, and consumer handling.
     *
     * @param routingKey the routing key / queue name to consume from
     * @param Options the options for the amqp connection
     */
    public constructor(routingKey: string, options?: AmqpOptions) {
        const DEFAULT_TIMEOUT: number = 86400000; // 1 year in milliseconds

        this.options = (() => {
            if (isNullOrUndefined(options)) {
                return DEFAULT_AMQP_OPTIONS;
            }

            return options;
        })();

        this.promises = new PromiseMap<string, Message>(DEFAULT_TIMEOUT);
        this.routingKey = routingKey;

        this.connection = Promise.resolve(AmqpLib.connect(this.options));

        this.channels = new ResourcePool<AmqpLib.Channel>(
            () => this.connection.then((connection) =>
                connection.createChannel()
            ),
            (channel) => Promise.resolve(channel.close()).then(() => "closed"),
            2,
        );

        this.consumer = this.channels.get();

        this.consumerTag = this.consumer.then((consumer) =>
            this.assertQueue(consumer)
                .then(() => this.createConsumer(consumer))
        );
    }

    /**
     * @param message the message to put on the backend
     * @returns a promise that resolves to the response from the backend
     */
    public put<T>(message: ResultMessage<T>): Promise<string> {
        const toSend = Buffer.from(JSON.stringify(message), "utf8");
        const options = RpcBackend.createPublishOptions(message);

        return this.channels.get().then((channel) =>
            this.assertQueue(channel)
                .then(() => this.sendToQueue({ channel, options, toSend }))
                .then((response) => {
                    this.channels.return(channel);

                    return response;
                })
        );
    }

    /**
     * @param taskId The task ID whose result we want to fetch.
     * @param timeout The time to wait before rejecting the promise.
     * @returns A  promise with the response from the backend.
     */
    public get<T>({ taskId, timeout }: GetOptions): Promise<ResultMessage<T>> {
        const result = this.promises.get(taskId)
            .then((message) => RpcBackend.parseMessage<T>(message));

        return createTimeoutPromise(result, timeout);
    }

    /**
     * @param taskId the task ID whose result we want to delete
     * @returns a promise with the response from the backend
     */
    public delete(taskId: string): Promise<string> {
        const response = (() => {
            if (this.promises.delete(taskId)) {
                return "deleted";
            }

            return "no result found";
        })();

        return Promise.resolve(response);
    }

    /**
     * gently terminates the connection with the backend
     */
    public disconnect(): Promise<void> {
        return Promise.all([
            this.consumer,
            this.consumerTag,
        ]).then(([consumer, consumerTag]) => {
            const reason = new Error("disconnecting");
            this.promises.rejectAll(reason);

            return Promise.all([
                consumer.cancel(consumerTag),
            ]).then(() => this.channels.return(consumer))
            .then(() => this.channels.destroyAll())
            .then(() => this.connection)
            .then((connection) => connection.close());
        });
    }

    /**
     * @returns the backend URI
     */
    public uri(): string {
        throw new UnimplementedError("Celery.Amqp.Backend.RpcBackend.uri");
    }

    private static parseMessage<T>(message: Message): ResultMessage<T> {
        const content = message.content.toString("utf8");
        const parsed: ResultMessage<T> = JSON.parse(content);

        return parsed;
    }

    private static createPublishOptions<T>(message: ResultMessage<T>)
    : AmqpLib.Options.Publish {
        return {
            contentEncoding: "utf-8",
            contentType: "application/json",
            correlationId: message.task_id,
            persistent: false,
            priority: 0,
        };
    }

    private assertQueue(channel: AmqpLib.Channel)
    : Promise<AmqpLib.Replies.AssertQueue> {
        return Promise.resolve(channel.assertQueue(this.routingKey, {
            autoDelete: false,
            durable: false,
            expires: 86400000, // 1 day in ms
        }));
    }

    private sendToQueue({ channel, options, toSend }: {
        channel: AmqpLib.Channel;
        options: AmqpLib.Options.Publish;
        toSend: Buffer;
    }): Promise<string> {
        const send = () =>
            channel.sendToQueue(this.routingKey, toSend, options);

        if (!send()) {
            return promisifyEvent<void>(channel, "drain")
                .then(() => this.sendToQueue({ channel, options, toSend }));
        }

        return Promise.resolve("flushed to write buffer");
    }

    private createConsumer(consumer: AmqpLib.Channel): Promise<string> {
        return Promise.resolve(consumer.consume(
            this.routingKey,
            (message) => this.onMessage(message),
            { noAck: true },
         )).then((reply) => reply.consumerTag);
    }

    private onMessage(maybeMessage?: Message | null): void {
        if (isNullOrUndefined(maybeMessage)) {
            const error = new Error("RabbitMQ cancelled consumer");
            this.promises.rejectAll(error);

            return;
        }

        const message = maybeMessage;
        const id = message.properties.correlationId;

        this.promises.resolve(id, message);
    }
}

interface Message {
    content: Buffer;
    fields: object;
    properties: {
        contentEncoding: string;
        contentType: string;
        correlationId: string;
        headers: object;
        priority: number;
    };
}
