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

        const tryPublish = (): Promise<string> =>
            this.broker.publish(publishOptions)
                .catch(() => {
                    this.broker = this.failoverStrategy(this.brokers);

                    return tryPublish();
                });

        tryPublish();

        return result;
    }

    private static dateOrNull(date?: Date): string | null {
        if (isNullOrUndefined(date)) {
            return null;
        }

        return date.toISOString();
    }

    private static getTimeLimit({ soft, hard }: {
        soft?: number;
        hard?: number;
    }): [number | null, number | null] {
        if (isNullOrUndefined(soft) && isNullOrUndefined(hard)) {
            return [null, null];
        } else if (!isNullOrUndefined(soft)) {
            return [soft, null];
        } else if (!isNullOrUndefined(hard)) {
            return [null, hard];
        }

        return [null, null];
    }

    private getDeliveryMode(): 1 | 2 {
        if (this.deliveryMode === "transient") {
            return 1;
        }

        return 2;
    }

    private static createPacker(
        serializer: Packer.Serializer,
        compressor: Packer.Compressor
    ): [Packer.Packer, Packer.Encoder] {
        const encoder = Task.selectEncoder(compressor);

        return [
            Packer.createPacker({ compressor, encoder, serializer }),
            encoder
        ];
    }

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

    private static getContentTypeMime(
        serializer: Packer.Serializer
    ): ContentTypeMime {
        switch (serializer) {
            case Packer.Serializer.Json: return ContentTypeMime.Json;
            case Packer.Serializer.Yaml: return ContentTypeMime.Yaml;
        }
    }

    private static getOrigin(): string {
        return `${Process.pid}@${Os.hostname()}`;
    }

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

         // yes, even if it's zlib -- this is the behavior of the Python client
        return {
            ...base,
            compression: CompressionMime.Zlib,
        };
    }

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
            priority,
            reply_to: this.appId,
        };
    }

    private static selectEncoder(
        compressor: Packer.Compressor
    ): Packer.Encoder {
        if (compressor === Packer.Compressor.Identity) {
            return Packer.Encoder.Plaintext;
        }

        return Packer.Encoder.Base64;
    }

    private static getEncodingMime(encoding: Packer.Encoder)
    : ContentEncodingMime {
        switch (encoding) {
            case Packer.Encoder.Base64: return ContentEncodingMime.Base64;
            case Packer.Encoder.Plaintext: return ContentEncodingMime.Utf8;
        }
    }
}

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

export type Priority = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
