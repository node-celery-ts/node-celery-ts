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

import { MessageBroker } from "./message_broker";

export interface Configuration {
    // task settings
    taskCompression?: "gzip" | "zlib";
    taskProtocol?: 2;
    taskSerializer?: "json" | "yaml";
    taskIgnoreResult?: boolean;
    taskTimeLimit?: number;
    taskSoftTimeLimit?: number;

    // task result backend settings
    resultBackend?: string;
    resultBackendTransportOptions?: { [key: string]: any | undefined };
    resultSerializer?: "json" | "yaml";
    resultCompression?: "gzip" | "zlib";
    resultExpires?: number;

    // RPC backend options
    resultPersistent?: boolean;

    // Redis backend options
    redisBackendUseSsl?: SslOptions;

    // message routing
    taskDefaultQueue?: string;
    taskDefaultDeliveryMode?: "persistent" | "transient";

    // broker settings
    brokerUrl?: string | Array<string>;
    brokerFailoverStrategy?: "round-robin" | "shuffle" | FailoverStrategy;
    brokerUseSsl?: SslOptions;
    brokerTransportOptions?: { [key: string]: any | undefined };
}

export const DEFAULT_CONFIG: Configuration = {
    brokerFailoverStrategy: "round-robin",
    brokerUrl: "amqp://localhost",
    resultPersistent: false,
    resultSerializer: "json",
    taskDefaultDeliveryMode: "persistent",
    taskDefaultQueue: "celery",
    taskIgnoreResult: false,
    taskProtocol: 2,
    taskSerializer: "json",
};

export type ContentType = "json" | "yaml" | "application/json"
                          | "application/x-yaml";

export type FailoverStrategy = (brokers: Array<MessageBroker>) => MessageBroker;

export interface SslOptions {
    keyfile?: string;
    certfile?: string;
    caCerts?: string;
    certReqs: CertificationRequirement;
}

export enum CertificationRequirement {
    None,
    Optional,
    Required,
}
