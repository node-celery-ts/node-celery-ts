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

import { FailoverStrategy } from "./config";
import { MessageBroker } from "./message_broker";
import {
    CompressionMime,
    ContentEncodingMime,
    ContentTypeMime,
    TaskHeaders,
    TaskProperties,
} from "./messages";
import { NullBackend } from "./null_backend";
import * as Packer from "./packer";
import { Result } from "./result";
import { ResultBackend } from "./result_backend";

import { isNullOrUndefined } from "./utility";

import * as Os from "os";
import * as Process from "process";

import * as Uuid from "uuid";

/**
 * `Task` encapsulates functionality relating to Celery Tasks. The generic
 * parameter T is the return type of the task to be called.
 *
 * @see Client#createTask
 */
export class Task<T> {
    private readonly appId: string;
    private readonly backend: ResultBackend;
    private broker: MessageBroker;
    private readonly brokers: Array<MessageBroker>;
    private readonly deliveryMode: "persistent" | "transient" = "persistent";
    private readonly failoverStrategy: FailoverStrategy;
    private readonly name: string;
    private readonly queue: string = "celery";
    private readonly timeLimit: [number | null, number | null] = [null, null];

    /**
     * @param appId The UUID of the parent app.
     * @param backend The result backend to use.
     * @param brokers The message brokers to use.
     * @param deliveryMode The persistence of the task queue.
     * @param failoverStrategy A function to be called to select a new message
     *                         broker in the case of a failover.
     * @param hardTimeLimit Maximum number of seconds that a worker can spend
     *                      executing and cleaning up after this task. If
     *                      exceeded, the worker will be killed and replaced.
     * @param name The name of the task to call.
     * @param queue The queue to communicate with workers on.
     * @param softTimeLimit Maximum number of seconds that a worker can spend
     *                      executing this task. If exceeded, the worker will
     *                      raise an exception in the executing task, allowing
     *                      the task to clean up before returning.
     * @returns A `Task` that is ready to be applied.
     */
    public constructor({
        appId,
        backend,
        brokers,
        deliveryMode = "persistent",
        failoverStrategy,
        hardTimeLimit,
        name,
        queue = "celery",
        softTimeLimit,
    }: TaskOptions) {
        this.appId = appId;
        this.backend = backend;
        this.broker = failoverStrategy(brokers);
        this.brokers = brokers;
        this.deliveryMode = deliveryMode;
        this.failoverStrategy = failoverStrategy;
        this.name = name;
        this.queue = queue;
        this.timeLimit = Task.getTimeLimit({
            hard: hardTimeLimit,
            soft: softTimeLimit,
        });
    }

    /**
     * @param args The positional arguments to invoke the task with.
     * @param compression The method of compression to apply to the task body.
     * @param eta The earliest time that this task should be invoked.
     * @param expires The latest time that this task should be invoke.
     * @param ignoreResult If true, no result backend will be used to store the
     *                     result of invoking this task.
     * @param kwargs The keyword arguments to invoke the task with.
     * @param priority The priority of this task. Must be in the range [0, 255].
     *                 For RabbitMQ message brokers, 255 is the highest
     *                 priority. For Redis message brokers, 0 is the highest
     *                 priority. Other message brokers do not support priority.
     * @param queue The name of the direct exchange to send this task to.
     * @param serializer The serializer to transform the task body into
     *                   a UTF-8 encoded string.
     * @returns A `Result` object. If `ignoreResult` is true or the client was
     *          created with a `NullBackend`, `Result#get` cannot be invoked.
     */
    public applyAsync({
        args,
        compression = Packer.Compressor.Identity,
        eta,
        expires,
        ignoreResult = false,
        kwargs,
        priority = 0,
        queue = this.queue,
        serializer = Packer.Serializer.Json,
    }: TaskApplyOptions): Result<T> {
        const backend = (() => {
            if (ignoreResult) {
                return new NullBackend();
            }

            return this.backend;
        })();

        const id = Uuid.v4();
        const result = new Result<T>(id, backend);

        const [packer, encoding] = Task.createPacker(serializer, compression);
        const body = Task.packBody({ args, kwargs, packer });

        const etaStr = Task.dateOrNull(eta);
        const expiresStr = Task.dateOrNull(expires);

        const publishOptions = {
            body,
            "content-encoding": ContentEncodingMime.Utf8,
            "content-type": Task.getContentTypeMime(serializer),
            headers: this.createHeaders({
                args,
                compression,
                eta: etaStr,
                expires: expiresStr,
                id,
                kwargs,
            }),
            properties: this.createProperties({
                deliveryMode: this.getDeliveryMode(),
                encoding,
                id,
                priority,
                queue,
            }),
        };

        const tryPublish = async (): Promise<string> => {
            try {
                return this.broker.publish(publishOptions);
            } catch {
                this.broker = this.failoverStrategy(this.brokers);

                return tryPublish();
            }
        };

        tryPublish();

        return result;
    }

    /**
     * @param date If `undefined`, will return `null`.
     * @returns An ISO 8601 date string or `null`.
     */
    private static dateOrNull(date?: Date): string | null {
        if (isNullOrUndefined(date)) {
            return null;
        }

        return date.toISOString();
    }

    /**
     * @param soft If `undefined`, will return `null` in place of the soft time
     *             limit.
     * @param hard If `undefined`, will return `null` in place of the hard time
     *             limit.
     * @returns A [soft, hard] tuple.
     */
    private static getTimeLimit({ soft, hard }: {
        soft?: number;
        hard?: number;
    }): [number | null, number | null] {
        if (!isNullOrUndefined(soft) && !isNullOrUndefined(hard)) {
            return [soft, hard];
        } else if (!isNullOrUndefined(soft)) {
            return [soft, null];
        } else if (!isNullOrUndefined(hard)) {
            return [null, hard];
        }

        return [null, null];
    }

    /**
     * @returns 1 if transient, 2 otherwise (if persistent).
     */
    private getDeliveryMode(): 1 | 2 {
        if (this.deliveryMode === "transient") {
            return 1;
        }

        return 2;
    }

    /**
     * If gzip compression is selected, will use zlib compression. This is a
     * quirk of Celery. https://github.com/celery/celery/issues/4917
     *
     * @param serializer The serialization method to use.
     * @param compressor The compression method to use. If the not "identity"
     *                   will use Base64 encoding. Will use plaintext (UTF-8)
     *                   encoding otherwise.
     * @returns A `Packer` with the requested serializer and compressor and the
     *          autodetected encoding.
     */
    private static createPacker(
        serializer: Packer.Serializer,
        compressor: Packer.Compressor
    ): [Packer.Packer, Packer.Encoder] {
        const encoder = Task.selectEncoder(compressor);

        const realCompressor = (() => {
            // this is the behavior of the Python client
            if (compressor === Packer.Compressor.Gzip) {
                return Packer.Compressor.Zlib;
            }

            return compressor;
        })();

        return [
            Packer.createPacker({
                compressor: realCompressor,
                encoder,
                serializer,
            }),
            encoder
        ];
    }

    /**
     * @param args The positional arguments to pack into the body.
     * @param kwargs The keyword arguments to pack into the body.
     * @param packer The packing strategy to use to create a task message body.
     * @returns The serialized, compressed, and encoded body of a task message.
     */
    private static packBody({ args, kwargs, packer }: {
        args: Args;
        kwargs: KeywordArgs;
        packer: Packer.Packer;
    }): string {
        return packer.pack([
            args,
            kwargs,
            { callbacks: null, chain: null, chord: null, errbacks: null },
        ]);
    }

    /**
     * Behavior is undefined if a serializer that isn't JSON or YAML is passed.
     *
     * @param serializer The string to convert into a MIME type.
     * @returns The matching MIME type.
     */
    private static getContentTypeMime(
        serializer: Packer.Serializer
    ): ContentTypeMime {
        switch (serializer) {
            case Packer.Serializer.Json: return ContentTypeMime.Json;
            case Packer.Serializer.Yaml: return ContentTypeMime.Yaml;
        }
    }

    /**
     * @returns The origin of this task - pid@hostname.
     */
    private static getOrigin(): string {
        return `${Process.pid}@${Os.hostname()}`;
    }

    /**
     * If `compression` is `"identity"`, there will not be a corresponding
     * field in the headers returned.
     *
     * @param args The positional arguments to pack into the headers.
     * @param compression The compression type to indicate.
     * @param eta The earliest time this task should be executed as an ISO 8601
     *            date string.
     * @param expires The latest time this task should be executed as an ISO
     *                8601 date string.
     * @param kwargs The keyword arguments to pack into the headers.
     * @param id The UUID of this task.
     * @returns The headers of a task message to be queued.
     */
    private createHeaders({ args, compression, eta, expires, kwargs, id }: {
        args: Args;
        compression: Packer.Compressor;
        eta: string | null;
        expires: string | null;
        id: string;
        kwargs: KeywordArgs;
    }): TaskHeaders {
        const base: TaskHeaders = {
            argsrepr: JSON.stringify(args),
            eta,
            expires,
            group: null,
            id,
            kwargsrepr: JSON.stringify(kwargs),
            lang: "py",
            origin: Task.getOrigin(),
            parent_id: null,
            retries: 0,
            root_id: id,
            shadow: null,
            task: this.name,
            timelimit: this.timeLimit,
        };

        if (compression === Packer.Compressor.Identity) {
            return base;
        }

        // both zlib and gzip map to using zlib with application/x-gzip MIME
        return {
            ...base,
            compression: CompressionMime.Zlib,
        };
    }

    /**
     * @param deliveryMode If 1, transient. If 2, persistent.
     * @param encoding The encoding type to indicate in the task message's
     *                 properties.
     * @param id The UUID of this task.
     * @param priority The priority of this task.
     * @param queue The queue to send this message to. Only direct exchanges
     *              are supported, so this is also the routing key of the
     *              exchange.
     * @returns The properties of a task message.
     */
    private createProperties({
        deliveryMode,
        encoding,
        id,
        priority,
        queue,
    }: {
        deliveryMode: 1 | 2;
        encoding: Packer.Encoder;
        id: string;
        priority: Priority;
        queue: string;
    }): TaskProperties {
        return {
            body_encoding: Task.getEncodingMime(encoding),
            correlation_id: id,
            delivery_info: {
                exchange: "",
                routing_key: queue,
            },
            delivery_mode: deliveryMode,
            delivery_tag: "celery",
            queue: queue,
            priority,
            reply_to: this.appId,
        };
    }

    /**
     * @param compressor The compression method to infer encoding from.
     * @returns The encoding to be used for creating task messages.
     */
    private static selectEncoder(
        compressor: Packer.Compressor
    ): Packer.Encoder {
        if (compressor === Packer.Compressor.Identity) {
            return Packer.Encoder.Plaintext;
        }

        return Packer.Encoder.Base64;
    }

    /**
     * @param encoding The encoding type to be converted into a MIME type.
     * @returns Base64 if base-64, UTF-8 if plaintext.
     */
    private static getEncodingMime(
        encoding: Packer.Encoder
    ): ContentEncodingMime {
        switch (encoding) {
            case Packer.Encoder.Base64: return ContentEncodingMime.Base64;
            case Packer.Encoder.Plaintext: return ContentEncodingMime.Utf8;
        }
    }
}

/**
 * Task creation options.
 */
export interface TaskOptions {
    appId: string;
    backend: ResultBackend;
    brokers: Array<MessageBroker>;
    deliveryMode?: "persistent" | "transient";
    failoverStrategy: FailoverStrategy;
    hardTimeLimit?: number;
    name: string;
    queue?: string;
    softTimeLimit?: number;
}

/**
 * Task invocation options.
 */
export interface TaskApplyOptions {
    args: Args;
    compression?: Packer.Compressor;
    eta?: Date;
    expires?: Date;
    ignoreResult?: boolean;
    kwargs: KeywordArgs;
    priority?: Priority;
    queue?: string;
    serializer?: Packer.Serializer;
}

export type Args = Array<any>;

export interface KeywordArgs {
    [key: string]: any | undefined;
}

export type Priority = number;
