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

import * as Amqp from "./amqp";
import { Client } from "./client";
import { UnimplementedError } from "./errors";
import { MessageBroker } from "./message_broker";
import { NullBackend } from "./null_backend";
import * as Redis from "./redis";
import { ResultBackend } from "./result_backend";
import { getScheme, Scheme } from "./uri";
import { isNullOrUndefined } from "./utility";

import * as Uuid from "uuid";

/**
 * Delegates to `createBackend` and `createBroker`.
 *
 * @param brokerUrl The URI(s) where message broker(s) to be used can be found.
 * @param resultBackend The optional URI where a result backend can be found.
 *                      If none is provided, `NullBackend` will be used.
 * @returns A newly constructed Client which will use the provided message
 *          broker(s) and result backend.
 * @throws Error If any of the URIs could not be parsed.
 *
 * @see createBackend
 * @see createBroker
 */
export const createClient = ({ brokerUrl, resultBackend }: {
    brokerUrl: string | Array<string>;
    resultBackend?: string;
}): Client => {
    const id = Uuid.v4();

    const backend = (() => {
        if (isNullOrUndefined(resultBackend)) {
            return new NullBackend();
        }

        return createBackend(id, resultBackend);
    })();

    const brokers = (() => {
        if (typeof brokerUrl === "string") {
            return [createBroker(brokerUrl)];
        }

        return brokerUrl.map(createBroker);
    })();

    return new Client({
        backend,
        brokers,
        id,
    });
};

/**
 * Supports Redis over TCP or Unix Socket, Redis Sentinel, or RabbitMQ RPC.
 *
 * @param id The UUID of this app.
 * @param rawUri The URI where a result backend can be found.
 * @returns A `ResultBackend` with settings parsed from `rawUri`.
 * @throws Error If an error is thrown during parsing.
 * @throws UnimplementedError If an unsupported result backend URI is passed in.
 */
export const createBackend = (id: string, rawUri: string): ResultBackend => {
    try {
        const scheme = getScheme(rawUri);

        switch (scheme) {
        case Scheme.Redis:
            return new Redis.RedisBackend(new Redis.RedisTcpOptions(
                Redis.parseTcpUri(rawUri)
            ));
        case Scheme.RedisSocket:
            return new Redis.RedisBackend(new Redis.RedisSocketOptions(
                Redis.parseSocketUri(rawUri)
            ));
        case Scheme.RedisSentinel:
            return new Redis.RedisBackend(new Redis.RedisSentinelOptions(
                Redis.parseSentinelUri(rawUri)
            ));
        case Scheme.Rpc:
            return new Amqp.RpcBackend(id, Amqp.parseAmqpUri(rawUri));
        }
    } catch (error) {
        throw new Error("Celery.Factories.createBackend: could not parse URI "
                        + `${rawUri}: ${error}`);
    }

    throw new UnimplementedError("Celery.Factory.createBackend");
};

/**
 * Supports Redis over TCP and Sentinel, Redis Sentinel, and RabbitMQ.
 *
 * @param rawUri The URI where a message broker can be found.
 * @returns A `MessageBroker` with settings parsed from `rawUri`.
 * @throws Error If an error is thrown during parsing.
 * @throws UnimplementedError If an unsupported message broker URI is passed in.
 */
export const createBroker = (rawUri: string): MessageBroker => {
    try {
        const scheme = getScheme(rawUri);

        switch (scheme) {
        case Scheme.Redis:
            return new Redis.RedisBroker(new Redis.RedisTcpOptions(
                Redis.parseTcpUri(rawUri)
            ));
        case Scheme.RedisSocket:
            return new Redis.RedisBroker(new Redis.RedisSocketOptions(
                Redis.parseSocketUri(rawUri)
            ));
        case Scheme.RedisSentinel:
            return new Redis.RedisBroker(new Redis.RedisSentinelOptions(
                Redis.parseSentinelUri(rawUri)
            ));
        case Scheme.Amqp:
            return new Amqp.AmqpBroker(Amqp.parseAmqpUri(rawUri));
        }
    } catch (error) {
        throw new Error("Celery.Factories.createBroker: could not parse URI "
                        + `${rawUri}: ${error}`);
    }

    throw new UnimplementedError("Celery.Factory.createBroker");
};
