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

import { UnimplementedError } from "../errors";
import {
    BasicRedisClusterOptions,
    BasicRedisSentinelOptions,
    BasicRedisSocketOptions,
    BasicRedisTcpOptions,
} from "./basic_options";

import * as IoRedis from "ioredis";

/**
 * Options polymorphically wraps the logic of client and URI creation
 *
 * @see createOptions
 */
export interface RedisOptions {
    /**
     * @returns a Client according to the type of the Options object
     */
    createClient(): IoRedis.Redis;

    /**
     * @returns a URI that can be used to lossily reconstruct an Options object
     */
    createUri(): string;
}

export class RedisTcpOptions implements RedisOptions {
    public readonly options: BasicRedisTcpOptions;

    public constructor(options: BasicRedisTcpOptions) {
        this.options = options;
    }

    public createClient(): IoRedis.Redis {
        return new IoRedis(this.options);
    }

    public createUri(): string {
        let uri = "redis";

        if (typeof this.options.tls !== "undefined") {
            uri += "s";
        }

        uri += "://";

        if (typeof this.options.password !== "undefined") {
            uri += `:${this.options.password}@`;
        }

        if (typeof this.options.host !== "undefined"
            || typeof this.options.password !== "undefined") {
            if (typeof this.options.host === "undefined") {
                uri += "localhost";
            } else {
                uri += this.options.host;
            }

            if (typeof this.options.port !== "undefined") {
                uri += `:${this.options.port}`;
            }
        }

        if (typeof this.options.db !== "undefined") {
            uri += `/${this.options.db}`;
        }

        return uri;
    }
}

export class RedisSocketOptions implements RedisOptions {
    public readonly options: BasicRedisSocketOptions;

    public constructor(options: BasicRedisSocketOptions) {
        this.options = options;
    }

    public createClient(): IoRedis.Redis {
        return new IoRedis(this.options);
    }

    public createUri(): string {
        let uri = "redis";

        if (typeof this.options.tls !== "undefined") {
            uri += "s";
        }

        uri += `+socket://${this.options.path}`;

        if (typeof this.options.password !== "undefined") {
            uri += `?password=${this.options.password}`;
        }

        return uri;
    }
}

export class RedisSentinelOptions implements RedisOptions {
    public readonly options: BasicRedisSentinelOptions;

    public constructor(options: BasicRedisSentinelOptions) {
        this.options = options;
    }

    public createClient(): IoRedis.Redis {
        return new IoRedis(this.options);
    }

    public createUri(): string {
        throw new UnimplementedError();
    }
}

export class RedisClusterOptions implements RedisOptions {
    public readonly options: BasicRedisClusterOptions;

    public constructor(options: BasicRedisClusterOptions) {
        this.options = options;
    }

    public createClient(): IoRedis.Redis {
        return new IoRedis.Cluster(this.options.nodes, this.options);
    }

    public createUri(): string {
        throw new UnimplementedError();
    }
}

export const DEFAULT_REDIS_OPTIONS: RedisTcpOptions = new RedisTcpOptions({
    protocol: "redis"
});

export const createOptions = (options: NativeOptions): RedisOptions => {
    if (isCluster(options)) {
        return new RedisClusterOptions(options);
    } else if ((options as BasicRedisSentinelOptions).sentinels) {
        return new RedisSentinelOptions(options as BasicRedisSentinelOptions);
    } else if ((options as BasicRedisSocketOptions).path) {
        return new RedisSocketOptions(options as BasicRedisSocketOptions);
    }

    return new RedisTcpOptions({
        ...(options as BasicRedisTcpOptions),
        protocol: (() => {
            if (options.tls) {
                return "rediss";
            }

            return "redis";
        })(),
    });
};

export type NativeOptions = IoRedis.RedisOptions
                            | BasicRedisClusterOptions;

const isCluster =
    (options: NativeOptions): options is BasicRedisClusterOptions =>
        (options as BasicRedisClusterOptions).nodes !== undefined;
