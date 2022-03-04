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

/**
 * ResultMessage represents a result message as represented in Redis.
 * Directly (de)serializable via JSON.stringify() and JSON.parse().
 */
export interface ResultMessage<T> {
    /** The subtasks called by this task. */
    children: Array<any>;
    result: T;
    status: Status;
    /** The UUID of this result's task. */
    task_id: string;
    /** The traceback of this result, if any. */
    traceback: string | null;
}

/**
 * JSON layout of a task message sent via Redis broker.
 * Directly (de)serializable via JSON.stringify() and JSON.parse().
 */
export interface TaskMessage {
    /** Encoded as specified by `"content-encoding"` */
    body: string;
    /** The encoding of the message itself. Always UTF-8. */
    "content-encoding": ContentEncodingMime;
    /** The serialization method of the message body. */
    "content-type": ContentTypeMime;
    headers: TaskHeaders;
    properties: TaskProperties;
}

/**
 * JSON layout of task headers.
 * Directly (de)serializable via JSON.stringify() and JSON.parse().
 */
export interface TaskHeaders {
    /** The UUID of this task's group, if any. */
    group: string | null;
    /** The UUID of this task. */
    id: string;
    /** The language this task is to be executed in, usually `"py"`. */
    lang: string;
    /** The UUID of the task that caled this task, if any. */
    parent_id: string | null;
    /** The UUID of the first task in this task's workflow, if any.  */
    root_id: string;
    /** The name of the task to execute. */
    task: string;

    /** A Python representation of args, should an alternative be required. */
    argsrepr?: string;
    /** MIME type of the compression of this task's message body. */
    compression?: CompressionMime;
    /** Earliest time that this Task will execute. ISO 8601 date string. */
    eta?: string | null;
    /** Latest time that this Task will execute. ISO 8601 date string. */
    expires?: string | null;
    /** A Python representation of kwargs, should an alternative be required. */
    kwargsrepr?: string;
    meth?: string;
    /** The name of the host that sent this task. */
    origin?: string;
    /** The number of times this task has been retried. Initially 0. */
    retries?: number;
    shadow?: string | null;
    /** A tuple of the soft and hard time limits for this task, if any. */
    timelimit?: [number | null, number | null];
}

/**
 * JSON layout of task properties.
 * Directly (de)serializable via JSON.stringify() and JSON.parse().
 */
export interface TaskProperties {
    /** The MIME encoding type of the body. */
    body_encoding: "base64" | "utf-8";
    /** Used by RabbitMQ for child tasks. Usually the UUID of this task. */
    correlation_id: string;
    delivery_info: TaskDeliveryInfo;
    /** 1 is not durable, 2 is durable. */
    delivery_mode: 1 | 2;
    /** Typically `"celery"`. */
    delivery_tag: string;
    /** May be ignored if unsupported by the queue. */
    priority: number;
    /** Used by redis to select queue. Typically `"celery"` */
    queue: string;
    /** Queue name to send replies to. Used for RPC result backend. */
    reply_to?: string;
}

/**
 * Message routing details, if applicable.
 */
export interface TaskDeliveryInfo {
    /** `""` (the default exchange) by default. */
    exchange: string;
    /** `"celery"` by default. */
    routing_key: string;
}

/**
 * Status states that a Result can take.
 */
export enum Status {
    Failure = "FAILURE",
    Pending = "PENDING",
    Received = "RECEIVED",
    Retry = "RETRY",
    Revoked = "REVOKED",
    Started = "STARTED",
    Success = "SUCCESS",
}

/**
 * MIME types for task message body serialization.
 */
export enum ContentTypeMime {
    Json = "application/json",
    Yaml = "application/x-yaml",
}

/**
 * MIME encodings for task message bodies.
 */
export enum ContentEncodingMime {
    Utf8 = "utf-8",
    Base64 = "base64",
}

/**
 * MIME types for compression.
 * The only valid MIME type is `application/x-gzip`, but Celery uses zlib
 * encoding when zlib or gzip is requested. This is misleading, but mirrors
 * the Python implementation.
 */
export enum CompressionMime {
    Zlib = "application/x-gzip",
}
