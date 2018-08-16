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

import * as Tls from "tls";

/**
 * I avoid {@literal @}types/ioredis here so we can overload for different
 * connection types
 */

/**
 * TCP/Unix Socket common options
 */
interface BasicRedisOptions {
    autoResendUnfulfilledCommands?: boolean;
    autoResubscribe?: boolean;
    connectionName?: string;
    connectTimeout?: number; // milliseconds
    db?: number;
    dropBufferSupport?: boolean;
    enableOfflineQueue?: boolean;
    enableReadyCheck?: boolean;
    keepAlive?: number;
    keyPrefix?: string;
    lazyConnect?: boolean;
    noDelay?: boolean;
    password?: string;
    protocol: string;
    readOnly?: boolean;
    reconnectOnError?(error: Error): boolean | 1 | 2;
    retryStrategy?(times: number): number | false;
    stringNumbers?: boolean;
    tls?: Tls.TlsOptions;
}

/**
 * TCP connection options
 * uri should be of the format:
 * redis[s]://[:pass{@literal @}]host[:port][/db][?key=value[?key=value]...]
 */
export interface BasicRedisTcpOptions extends BasicRedisOptions {
    family?: 4 | 6;
    host?: string;
    port?: number;
}

/**
 * Unix Socket connection options
 * uri should be of the format:
 * redis[s]+socket://path[?key=value[?key=value]...]
 */
export interface BasicRedisSocketOptions extends BasicRedisOptions {
    path: string;
}

/**
 * Sentinel connection options
 * uri should be of the format:
 * sentinel[s]://name{@literal @}host:port[;sentinel[s]://host:port]...
 */
export interface BasicRedisSentinelOptions extends BasicRedisTcpOptions {
    name: string;
    role?: "master" | "slave";
    sentinelRetryStrategy?(times: number): number | false;
    sentinels: Array<RedisSentinelAuthority>;
}

/**
 * Cluster connection options
 */
export interface BasicRedisClusterOptions {
    clusterRetryStrategy?(times: number): number;
    enableOfflineQueue?: boolean;
    enableReadyCheck?: boolean;
    maxRedirections?: number;
    nodes: Array<RedisClusterNode>;
    redisOptions?: BasicRedisTcpOptions;
    retryDelayOnClusterDown?: number;
    retryDelayOnFailover?: number;
    scaleReads?: "master" | "slave" | "all";
}

export interface RedisTransportOptions {
    fanoutPatterns?: string;
    fanoutPrefix?: string;
    masterName?: string;
    visibilityTimeout?: number;
}

/**
 * fields to describe a Sentinel
 */
export interface RedisSentinelAuthority {
    host: string;
    port: number;
}

/**
 * fields to describe a Cluster Node
 */
export interface RedisClusterNode {
    host: string;
    port: number;
}
