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

import { AmqpOptions, DEFAULT_AMQP_OPTIONS } from "./options";

import { ResourcePool } from "../containers";
import { MessageBroker } from "../message_broker";
import { TaskMessage } from "../messages";
import { isNullOrUndefined, promisifyEvent } from "../utility";

import * as AmqpLib from "amqplib";

/**
 * AmqpBroker implements MessageBroker using the RabbitMQ message broker.
 * Messages are durable and will survive a broker restart.
 */
export class AmqpBroker implements MessageBroker {
    private channels: ResourcePool<AmqpLib.Channel>;
    private connection: Promise<AmqpLib.Connection>;
    private readonly options: AmqpOptions;

    /**
     * Constructs an AmqpBroker with the given options.
     *
     * @param options The configuration of the connection to make. If
     *                `undefined`, will connect to RabbitMQ at localhost.
     * @returns An AmqpBroker connected using the specified configuration.
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
            () => this.connection.then((connection) =>
                connection.createChannel()
            ),
            (channel) => channel.close().then(() => "closed"),
            2,
        );
    }

    /**
     * Disconnects from the RabbitMQ server. Only call once.
     * Alias for #end().
     *
     * @returns.A Promise that resolves when all in flight operations are
     *          complete and the connection is closed.
     */
    public disconnect(): Promise<void> {
        return this.end();
    }

    /**
     * Disconnects from the RabbitMQ server. Only call once.
     *
     * @returns.A Promise that resolves when all in flight operations are
     *          complete and the connection is closed.
     */
    public end(): Promise<void> {
        return this.channels.destroyAll().then(() => this.connection)
            .then((connection) => connection.close());
    }

    /**
     * Queues a message onto the requested exchange.
     * Uses a direct exchange to a durable queue.
     *
     * @param message The message to be published. Used to determine the
     *                exchange, routing key, and body encoding to use.
     * @returns A Promise that resolves to `"flushed to write buffer"` after the
     *          message is flushed to the amqp.node write buffer.
     */
    public publish(message: TaskMessage): Promise<string> {
        const exchange = message.properties.delivery_info.exchange;
        const routingKey = message.properties.delivery_info.routing_key;

        const body = AmqpBroker.getBody(message);
        const options = AmqpBroker.getPublishOptions(message);

        return this.channels.get().then((channel) => {
            const response = AmqpBroker.assert({
                channel,
                exchange,
                routingKey
            }).then(() => AmqpBroker.doPublish({
                body,
                channel,
                exchange,
                options,
                routingKey,
            }));

            return this.channels.returnAfter(response, channel);
        });
    }

    private static getBody(message: TaskMessage): Buffer {
        return Buffer.from(message.body, message.properties.body_encoding);
    }

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

    private static assert({ channel, exchange, routingKey }: {
        channel: AmqpLib.Channel;
        exchange: string;
        routingKey: string;
    }): Promise<void> {
        const queue = channel.assertQueue(routingKey);

        if (exchange === "") {
            return Promise.resolve(queue).then(() => { });
        }

        return Promise.all([
            channel.assertExchange(exchange, "direct"),
            queue,
        ]).then(() => { });
    }

    private static doPublish({ body, channel, exchange, options, routingKey }: {
        body: Buffer;
        channel: AmqpLib.Channel;
        exchange: string;
        options: AmqpLib.Options.Publish;
        routingKey: string;
    }): Promise<string> {
        if (!channel.publish(exchange, routingKey, body, options)) {
            return promisifyEvent(channel, "drain").then(() =>
                this.doPublish({ body, channel, exchange, options, routingKey })
            );
        }

        return Promise.resolve("flushed to write buffer");
    }
}
