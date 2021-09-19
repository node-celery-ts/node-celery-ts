// BSD 3-Clause License
//
// Copyright (c) 2021, node-celery-ts contributors
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

import { AmqpOptions, DEFAULT_AMQP_OPTIONS } from "./options";

import { ResourcePool } from "../containers";
import { MessageBroker } from "../message_broker";
import { TaskMessage } from "../messages";
import { isNullOrUndefined, promisifyEvent } from "../utility";

import * as AmqpLib from "amqplib";

/**
 * `AmqpBroker` implements `MessageBroker` using the `RabbitMQ` message broker.
 * Messages are, by default, durable, and will survive a broker restart.
 */
export class AmqpBroker implements MessageBroker {
    private channels: ResourcePool<AmqpLib.Channel>;
    private readonly connection: Promise<AmqpLib.Connection>;
    private readonly options: AmqpOptions;

    /**
     * Constructs an `AmqpBroker` with the given options.
     *
     * @param options The configuration of the connection to make. If
     *                `undefined`, will connect to RabbitMQ at localhost:6379.
     * @returns An `AmqpBroker` connected using the specified configuration.
     */
    public constructor(options?: AmqpOptions) {
        this.options = (() => {
            if (isNullOrUndefined(options)) {
                return DEFAULT_AMQP_OPTIONS;
            }

            return options;
        })();

        this.connection = Promise.resolve(AmqpLib.connect(this.options));

        this.channels = new ResourcePool(
            async () => {
                const connection = await this.connection;

                return connection.createChannel();
            },
            async (channel) => {
                await channel.close();

                return "closed";
            },
            2,
        );
    }

    /**
     * Disconnects from the RabbitMQ node. Only call once.
     * Alias for #end().
     *
     * @returns A `Promise` that resolves once the connection is closed.
     *
     * @see #end
     */
    public async disconnect(): Promise<void> {
        await this.end();
    }

    /**
     * Disconnects from the RabbitMQ node. Only call once.
     *
     * @returns A `Promise` that resolves once the connection is closed.
     */
    public async end(): Promise<void> {
        await this.channels.destroyAll();

        const connection = await this.connection;
        await connection.close();
    }

    /**
     * Queues a message onto the requested exchange.
     *
     * @param message The message to be published. Used to determine the
     *                publishing options.
     * @returns A `Promise` that resolves to `"flushed to write buffer"`.
     */
    public async publish(message: TaskMessage): Promise<string> {
        const exchange = message.properties.delivery_info.exchange;
        const routingKey = message.properties.delivery_info.routing_key;

        const body = AmqpBroker.getBody(message);
        const options = AmqpBroker.getPublishOptions(message);

        return this.channels.use(async (channel) => {
            await AmqpBroker.assert({ channel, exchange, routingKey });

            return AmqpBroker.doPublish({
                body,
                channel,
                exchange,
                options,
                routingKey
            });
        });
    }

    /**
     * Converts a task message's body into a `Buffer`.
     */
    private static getBody(message: TaskMessage): Buffer {
        return Buffer.from(message.body, message.properties.body_encoding);
    }

    /**
     * @param message The message to extract options from.
     * @returns The options that the message should be published with.
     */
    private static getPublishOptions(
        message: TaskMessage
    ): AmqpLib.Options.Publish {
        return {
            contentEncoding: message["content-encoding"],
            contentType: message["content-type"],
            correlationId: message.properties.correlation_id,
            deliveryMode: message.properties.delivery_mode,
            headers: message.headers,
            priority: message.properties.priority,
            replyTo: message.properties.reply_to,
        };
    }

    /**
     * Uses `AmqpLib.Channel#assertQueue`.
     *
     * @param channel The channel to make assertions with.
     * @param exchange The exchange to assert.
     * @param routingKey The queue to assert.
     * @returns A `Promise` that resolves when the assertions are complete.
     */
    private static async assert({ channel, exchange, routingKey }: {
        channel: AmqpLib.Channel;
        exchange: string;
        routingKey: string;
    }): Promise<void> {
        const assertion = channel.assertQueue(routingKey);

        // cannot assert default exchange
        if (exchange === "") {
            await assertion;
        } else {
            await Promise.all([
                assertion,
                channel.assertExchange(exchange, "direct"),
            ]);
        }
    }

    /**
     * Uses `AmqpLib.Channel#publish`. If the write buffer is full, recursively
     * calls itself after a `"drain"` event is emitted until the write is
     * performed.
     *
     * @param body The body of the message to publish.
     * @param channel The channel to publish with.
     * @param exchange The exchange to publish to.
     * @param options The options to forward to `amqplib`.
     * @param routingKey The key to route by. If using a direct exchange, this
     *                   is the queue to route to.
     * @returns The response from the RabbitMQ node.
     */
    private static async doPublish({
        body,
        channel,
        exchange,
        options,
        routingKey
    }: {
        body: Buffer;
        channel: AmqpLib.Channel;
        exchange: string;
        options: AmqpLib.Options.Publish;
        routingKey: string;
    }): Promise<string> {
        const publish = () => channel.publish(
            exchange,
            routingKey,
            body,
            options
        );

        while (!publish()) {
            await promisifyEvent<void>(channel, "drain");
        }

        return "flushed to write buffer";
    }
}
