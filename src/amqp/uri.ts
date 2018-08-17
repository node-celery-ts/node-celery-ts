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
 * Parses a URI formatted according to the rules set forth by RabbitMQ.
 * https://www.rabbitmq.com/uri-spec.html
 * https://www.rabbitmq.com/uri-query-parameters.html
 * Potential queries are authMechanism, channelMax, connectionTimeout,
 * frameMax, heartbeat, and locale. snake_case and camelCase are accepted.
 * Should be formatted roughly as follows:
 * amqp[s]://[user[:pass]@]host[:port][/vhost][?key0=value0[&key1=value1]...]
 * Or as:
 * rpc[s]://[user[:pass]@]host[:port][/vhost][?key0=value0[&key1=value1]...]
 *
 * @param rawUri A RabbitMQ URI.
 * @returns An object representation of `uri`.
 *
 * @throws ParseError If `rawUri` is not a RabbitMQ URI.
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
        case Scheme.RpcSecure: return Scheme.AmqpSecure;
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

/**
 * All the options that will be parsed from a URI query.
 */
interface AmqpQueries {
    readonly channelMax?: number;
    readonly frameMax?: number;
    readonly heartbeat?: number;
    readonly locale?: string;
}

/**
 * @param uri The URI to extract a password, port, and username from.
 * @param appending The object to use as default.
 * @returns A shallow copy of `appending` with options added.
 */
const appendOptions = (uri: Uri, appending: AmqpOptions): AmqpOptions => {
    type FunctionList = Array<(options: AmqpOptions) => AmqpOptions>;

    const functions: FunctionList =
        [appendPass(uri), appendPort(uri), appendUser(uri)];

    return functions.reduce(
        (x, f) => f(x),
        appending,
    );
};

/**
 * @param uri The URI to extract queries from.
 * @param appending The object to use as default.
 * @returns A shallow copy of `appending` with query options added.
 */
const appendQueries = (uri: Uri, appending: AmqpOptions): AmqpOptions => {
    if (isNullOrUndefined(uri.query)) {
        return appending;
    }

    const queries = asQueries(uri.query);

    return _.defaults(queries, appending);
};

/**
 * vhost is parsed from the URI's path. amqp://localhost uses the default
 * vhost, while amqp://localhost/ uses the vhost "". Strange.
 *
 * @param uri The URI to extract a vhost from.
 * @param appending The object to use as default.
 * @returns A shallow copy of `appending` with options added.
 */
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

/**
 * @param uri The URI to extract a password from.
 * @param appending The object to use as default.
 * @returns A shallow copy of `appending` with password added.
 */
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

/**
 * @param uri The URI to extract a port number from.
 * @param appending The object to use as default.
 * @returns A shallow copy of `appending` with port number added.
 */
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

/**
 * @param uri The URI to extract a username from.
 * @param appending The object to use as default.
 * @returns A shallow copy of `appending` with username added.
 */
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

/**
 * @param toTransform The raw URI queries to parse from.
 * @returns The converted queries.
 *
 * @throws ParseError If the queries to be extracted are ill-formed.
 */
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

/**
 * @param raw The queries to extract channelMax from.
 * @returns A function that will append channelMax to an input.
 */
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

/**
 * @param raw The queries to extract frameMax from.
 * @returns A function that will append frameMax to an input.
 */
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

/**
 * @param raw The queries to extract heartbeat from.
 * @returns A function that will append heartbeat to an input.
 */
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

/**
 * @param raw The queries to extract a locale from.
 * @returns A function that will append the locale to an input.
 */
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

/**
 * @param queries The queries to convert from snake_case to camelCase.
 * @returns Queries with all that were in snake_case as camelCase.
 */
const camelCaseQueries = (queries: Queries): Queries =>
    _.reduce(
        _.keys(queries) as Array<string>,
        (converting: Queries, key: string): Queries => ({
            ...converting,
            [toCamelCase(key)]: queries[key],
        }),
        { },
    );

/**
 * A function that makes a copy of an `AmqpQueries` object and appends a new
 * parameter to it.
 */
type QueryAppender = (queries: AmqpQueries) => AmqpQueries;

/**
 * @param queries The object to forward.
 * @returns `queries`.
 */
const identity = (queries: AmqpQueries): AmqpQueries => queries;

/**
 * @param value A scalar or an array to convert into a scalar.
 * @returns A scalar; either the value itself, or the last element of an array.
 */
const narrowArray = <T>(value: T | Array<T>): T => {
    if (value instanceof Array) {
        return value[value.length - 1];
    }

    return value;
};
