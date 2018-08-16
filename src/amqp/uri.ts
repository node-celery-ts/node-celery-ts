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

import { AmqpOptions } from "./options";

import { ParseError } from "../errors";
import { getScheme, parseUri, Queries, Scheme, Uri } from "../uri";
import { isNullOrUndefined, parseInteger, toCamelCase } from "../utility";

import * as _ from "underscore";

/**
 * parses a URI formatted according to the rules set forth by RabbitMQ
 * https://www.rabbitmq.com/uri-spec.html
 * https://www.rabbitmq.com/uri-query-parameters.html
 * potential queries are authMechanism, channelMax, connectionTimeout,
 * frameMax, heartbeat, and locale. snake_case and camelCase are accepted.
 *
 * @param uri a uri string formatted as follows:
 * amqp://[user[:pass]@]host[:port][/vhost][?key0=value0[&key1=value1]...]
 * @returns an Options object containing the information from the URI
 */
export const parseAmqpUri = (rawUri: string): AmqpOptions => {
    const scheme = getScheme(rawUri);

    if (scheme !== Scheme.Amqp && scheme !== Scheme.AmqpSecure
        && scheme !== Scheme.Rpc && scheme !== Scheme.RpcSecure) {
        throw new ParseError(`unrecognized scheme "${scheme}"`);
    }

    const uri = parseUri(rawUri);

    if (isNullOrUndefined(uri.authority)) {
        throw new ParseError(`"${rawUri}" missing authority`);
    }

    const protocol = (() => {
        switch (scheme) {
        case Scheme.Rpc: return Scheme.Amqp;
        case Scheme.RpcSecure: return Scheme.RpcSecure;
        }

        return scheme;
    })();

    const withOptions = appendOptions(uri, {
        hostname: uri.authority.host,
        protocol,
    });

    const withVhost = appendVhost(rawUri, withOptions);
    const withQueries = appendQueries(uri, withVhost);

    return withQueries;
};

/** @ignore */
interface AmqpQueries {
    readonly channelMax?: number;
    readonly frameMax?: number;
    readonly heartbeat?: number;
    readonly locale?: string;
}

/** @ignore */
const appendOptions = (uri: Uri, appending: AmqpOptions): AmqpOptions => {
    type FunctionList = Array<(options: AmqpOptions) => AmqpOptions>;

    const functions: FunctionList =
        [appendPass(uri), appendPort(uri), appendUser(uri)];

    return functions.reduce(
        (x, f) => f(x),
        appending,
    );
};

/** @ignore */
const appendQueries = (uri: Uri, appending: AmqpOptions): AmqpOptions => {
    if (isNullOrUndefined(uri.query)) {
        return appending;
    }

    const queries = asQueries(uri.query);

    return _.defaults(queries, appending);
};

/** @ignore */
const appendVhost = (rawUri: string, appending: AmqpOptions): AmqpOptions => {
    const maybeMatches = /^.+:\/\/[^/]*\/([\w\d-.~%]*)$/.exec(rawUri);

    if (isNullOrUndefined(maybeMatches)) {
        return appending;
    }

    const vhost = decodeURIComponent(maybeMatches[1]);

    return {
        ...appending,
        vhost,
    };
};

/** @ignore */
const appendPass = (uri: Uri) => (options: AmqpOptions): AmqpOptions => {
    if (isNullOrUndefined(uri.authority)
        || isNullOrUndefined(uri.authority.userInfo)
        || isNullOrUndefined(uri.authority.userInfo.pass)) {
        return options;
    }

    return {
        ...options,
        password: uri.authority.userInfo.pass,
    };
};

/** @ignore */
const appendPort = (uri: Uri) => (options: AmqpOptions): AmqpOptions => {
    if (isNullOrUndefined(uri.authority)
        || isNullOrUndefined(uri.authority.port)) {
        return options;
    }

    return {
        ...options,
        port: uri.authority.port,
    };
};

/** @ignore */
const appendUser = (uri: Uri) => (options: AmqpOptions): AmqpOptions => {
    if (isNullOrUndefined(uri.authority)
        || isNullOrUndefined(uri.authority.userInfo)) {
        return options;
    }

    return {
        ...options,
        username: uri.authority.userInfo.user,
    };
};

/** @ignore */
const asQueries = (toTransform: Queries): AmqpQueries => {
    const cased = camelCaseQueries(toTransform);

    type FunctionList = Array<QueryAppender>;

    const functions: FunctionList = [
        appendChannelMax(cased),
        appendFrameMax(cased),
        appendHeartbeat(cased),
        appendLocale(cased),
    ];

    const append = (queries: AmqpQueries): AmqpQueries =>
        functions.reduce((x, f) => f(x), queries);

    return append({ });
};

/** @ignore */
const appendChannelMax = (raw: Queries): QueryAppender => {
    const maybeChannelMax = raw.channelMax;

    if (isNullOrUndefined(maybeChannelMax)) {
        return identity;
    }

    return (queries) => ({
        ...queries,
        channelMax: parseInteger(narrowArray(maybeChannelMax)),
    });
};

/** @ignore */
const appendFrameMax = (raw: Queries): QueryAppender => {
    const maybeFrameMax = raw.frameMax;

    if (isNullOrUndefined(maybeFrameMax)) {
        return identity;
    }

    return (queries) => ({
        ...queries,
        frameMax: parseInteger(narrowArray(maybeFrameMax)),
    });
};

/** @ignore */
const appendHeartbeat = (raw: Queries): QueryAppender => {
    const maybeHeartbeat = raw.heartbeat;

    if (isNullOrUndefined(maybeHeartbeat)) {
        return identity;
    }

    return (queries) => ({
        ...queries,
        heartbeat: parseInteger(narrowArray(maybeHeartbeat)),
    });
};

/** @ignore */
const appendLocale = (raw: Queries): QueryAppender => {
    const maybeLocale = raw.locale;

    if (isNullOrUndefined(maybeLocale)) {
        return identity;
    }

    return (queries) => ({
        ...queries,
        locale: narrowArray(maybeLocale),
    });
};

/** @ignore */
const camelCaseQueries = (queries: Queries): Queries =>
    _.reduce(
        _.keys(queries) as Array<string>,
        (converting: Queries, key: string): Queries => ({
            ...converting,
            [toCamelCase(key)]: queries[key],
        }),
        { },
    );

type QueryAppender = (queries: AmqpQueries) => AmqpQueries;

/** @ignore */
const identity = (queries: AmqpQueries): AmqpQueries => queries;

/** @ignore */
const narrowArray = <T>(value: T | Array<T>): T => {
    if (value instanceof Array) {
        return value[value.length - 1];
    }

    return value;
};
