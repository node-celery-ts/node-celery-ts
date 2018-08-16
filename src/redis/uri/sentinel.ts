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

import {
    BasicRedisSentinelOptions as Options,
    RedisSentinelAuthority as Authority,
} from "../basic_options";

import { ParseError } from "../../errors";
import { getScheme, parseUri, Queries, Scheme, Uri } from "../../uri";
import { isNullOrUndefined } from "../../utility";

/**
 * @param rawUri the URI to parse, should be of the format
 *               sentinel://host:port[;sentinel://host:port...]
 * @returns SentinelOptions parsed from `rawUri`.
 */
export const parseSentinelUri = (rawUris: string): Options => {
    const split = rawUris.split(";");

    const parsed = split.map(parseIndividual);
    const sentinels = parsed.map(([sentinel, _]) => sentinel);
    const individualOptions = parsed.map(([_, query]) => query);

    const options = individualOptions.reduce(
        (lhs, rhs) => ({ ...lhs, ...rhs })
    );

    if (isNullOrUndefined(options.name)) {
        throw new ParseError("sentinel options missing name");
    }

    return {
        ...options as StrongSentinelQueries,
        protocol: "sentinel",
        sentinels,
    };
};

interface SentinelQueries {
    name?: string;
    role?: "master" | "slave";
}

interface StrongSentinelQueries {
    name: string;
    role?: "master" | "slave";
}

const parseIndividual = (
    rawUri: string
): [Authority, SentinelQueries] => {
    const uri = parseUri(rawUri);

    const authority = parseAuthority(uri);
    const queries = parseQueries(uri);

    return [authority, queries];
};

const parseAuthority = (uri: Uri): Authority => {
    const scheme = getScheme(uri.raw);

    if (!isSentinelScheme(scheme)) {
        throw new ParseError(`URI ${uri.raw} is not a sentinel URI.`);
    } else if (isNullOrUndefined(uri.authority)) {
        throw new ParseError(`URI ${uri.raw} is missing its authority.`);
    } else if (isNullOrUndefined(uri.authority.port)) {
        throw new ParseError(`URI "${uri.raw}" is missing a port.`);
    }

    return {
        host: uri.authority.host,
        port: uri.authority.port,
    };
};

const parseQueries = (uri: Uri): SentinelQueries => {
    if (isNullOrUndefined(uri.query)) {
        return { };
    }

    const rawQuery = uri.query;

    return [appendName, appendRole].reduce(
        (appending, f) => f(appending, rawQuery),
        { },
    );
};

const isSentinelScheme = (scheme: Scheme): boolean =>
    scheme === Scheme.RedisSentinel || scheme === Scheme.RedisSentinelSecure;

const appendName = (
    appending: SentinelQueries,
    queries: Queries
): SentinelQueries => {
    const maybeName = queries.name;

    if (isNullOrUndefined(maybeName)) {
        return appending;
    }

    const name = collapseArray(maybeName);

    return {
        ...queries,
        name,
    };
};

const appendRole = (
    appending: SentinelQueries,
    queries: Queries
): SentinelQueries => {
    const maybeRole = queries.role;

    if (isNullOrUndefined(maybeRole)) {
        return appending;
    }

    const role = collapseArray(maybeRole);

    if (role !== "master" && role !== "slave") {
        throw new ParseError(`role "${role}" is not "master" or "slave"`);
    }

    return {
        ...queries,
        role,
    };
};

const collapseArray = <T>(maybeArray: T | Array<T>): T => {
    if (maybeArray instanceof Array) {
        return maybeArray[maybeArray.length - 1];
    }

    return maybeArray;
};
