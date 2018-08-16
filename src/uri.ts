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

import { ParseError } from "./errors";
import { isNullOrUndefined, toCamelCase } from "./utility";

import * as _ from "underscore";
import * as UriJs from "urijs";

/**
 * immutable destructuring of a URI
 */
export interface Uri {
    readonly authority?: Authority;
    readonly path: string;
    readonly query?: Queries;
    readonly raw: string;
    readonly scheme: string;
}

/**
 * supported scheme types for backend and broker selection
 */
export enum Scheme {
    Amqp = "amqp",
    AmqpSecure = "amqps",
    Redis = "redis",
    RedisSecure = "rediss",
    RedisSentinel = "sentinel",
    RedisSentinelSecure = "sentinels",
    RedisSocket = "redis+socket",
    RedisSocketSecure = "rediss+socket",
    Rpc = "rpc",
    RpcSecure = "rpcs",
}

const SCHEMES = new Set<string>(_.values(Scheme));

export interface Authority {
    readonly userInfo?: UserInfo;
    readonly host: string;
    readonly port?: number;
}

export interface Queries {
    readonly [key: string]: string | Array<string> | undefined;
}

export interface UserInfo {
    readonly user: string;
    readonly pass?: string;
}

/**
 * @param toParse a URI of the format:
 * scheme:[//[user[:pass]@]host[:port]]path[?query=value[&query=value]...]
 * @returns a Uri object with all fields validated and normalized
 */
export const parseUri = (toParse: string): Uri => {
    const parsed = (() => {
        try {
            return UriJs.parse(toParse);
        } catch (error) {
            throw new ParseError("Celery.Uri.parse: unable to parse "
                                 + `${toParse}: ${error}`);
        }
    })();

    if (isNullOrUndefined(parsed.path) || isNullOrUndefined(parsed.protocol)) {
        throw new ParseError(`Celery.Uri.parse: unable to parse ${parsed}: `
                             + "missing path or protocol");
    }

    const withRequired: Uri = {
        path: parsed.path,
        raw: toParse,
        scheme: parsed.protocol.toLowerCase(),
    };

    const withAuthority = addHostUserPassAndPort(parsed, withRequired);
    const withQuery = addQuery(parsed, withAuthority);

    return withQuery;
};

/**
 * @param rawUri A raw URI string.
 * @returns A Scheme enum parsed from `rawUri`.
 * @throws ParseError If `rawUri` is not a valid URI or if its scheme is
 *                    unrecognized.
 */
export const getScheme = (rawUri: string): Scheme => {
    const SCHEME_REGEX: RegExp = /^([A-Za-z][A-Za-z\d+.-]*):/;
    const SCHEME_INDEX: number = 1;

    const maybeMatches = rawUri.match(SCHEME_REGEX);

    if (isNullOrUndefined(maybeMatches)) {
        throw new ParseError(`invalid uri "${rawUri}"`);
    }

    const matches = maybeMatches;
    const scheme = matches[SCHEME_INDEX].toLowerCase();

    if (!SCHEMES.has(scheme)) {
        throw new ParseError(`unrecognized scheme "${scheme}"`);
    }

    return scheme as Scheme;
};

interface RawUri {
    readonly fragment?: string;
    readonly hostname?: string;
    readonly password?: string;
    readonly path: string;
    readonly port?: string;
    readonly protocol: string;
    readonly query?: string;
    readonly username?: string;
}

const addHost = (uri: RawUri, parsing: Uri): Uri => {
    if (isNullOrUndefined(uri.hostname)) {
        return parsing;
    }

    return {
        ...parsing,
        authority: {
            host: validateHost(uri.hostname).toLowerCase(),
        },
    };
};

const addHostAndUser = (uri: RawUri, parsing: Uri): Uri => {
    const withHost = addHost(uri, parsing);

    if (isNullOrUndefined(withHost.authority)
        || isNullOrUndefined(uri.username)) {
        return withHost;
    }

    return {
        ...withHost,
        authority: {
            ...withHost.authority,
            userInfo: {
                user: uri.username,
            },
        },
    };
};

const addHostUserAndPass = (uri: RawUri, parsing: Uri): Uri => {
    const withUser = addHostAndUser(uri, parsing);

    if (isNullOrUndefined(withUser.authority)) {
        return withUser;
    }

    if (isNullOrUndefined(withUser.authority.userInfo)
        && !isNullOrUndefined(uri.password)) {
        return {
            ...withUser,
            authority: {
                ...withUser.authority,
                userInfo: {
                    pass: uri.password,
                    user: "",
                },
            },
        };
    }

    if (isNullOrUndefined(withUser.authority.userInfo)
        || isNullOrUndefined(uri.password)) {
        return withUser;
    }

    return {
        ...withUser,
        authority: {
            ...withUser.authority,
            userInfo: {
                ...withUser.authority.userInfo,
                pass: uri.password,
            },
        },
    };
};

const addHostUserPassAndPort = (uri: RawUri, parsing: Uri): Uri => {
    const withPass = addHostUserAndPass(uri, parsing);

    if (isNullOrUndefined(withPass.authority)
        || isNullOrUndefined(uri.port)) {
        return withPass;
    }

    return {
        ...withPass,
        authority: {
            ...withPass.authority,
            port: parsePort(uri.port),
        },
    };
};

const addQuery = (uri: RawUri, parsing: Uri): Uri => {
    const REGEX: RegExp = // tslint:disable:max-line-length
        /^[A-Za-z\d*-._+%]+=[A-Za-z\d*-._+%]*(?:&[A-Za-z\d*-._+%]+=[A-Za-z\d*-._+%+]*)*$/;

    if (isNullOrUndefined(uri.query)) {
        return parsing;
    }

    if (!REGEX.test(uri.query)) {
        throw new ParseError(`query "${uri.query}" is not a valid HTML query`);
    }

    const unconverted = UriJs.parseQuery(uri.query) as Queries;

    const camelCaseQuery = (queries: Queries, key: string) => {
        const cased = toCamelCase(key);

        if (cased === key) {
            return queries;
        }

        const { [key]: _key, ...renamed } = {
            ...queries,
            [cased]: queries[key],
        };

        return renamed;
    };

    const query = Object.keys(unconverted)
        .reduce(camelCaseQuery, unconverted);

    return {
        ...parsing,
        query,
    };
};

const parsePort = (maybePort: string): number => {
    const maybeMatches = /^\d+$/.exec(maybePort);

    if (isNullOrUndefined(maybeMatches)) {
        throw new ParseError(`could not parse "${maybePort}" as port`);
    }

    const parsed = Number.parseInt(maybePort, 10);

    return parsed;
};

const validateHost = (maybeHost: string): string => {
    if (HOST_REGEX.test(maybeHost) === false) {
        throw new ParseError(`invalid host "${maybeHost}"`);
    }

    return maybeHost;
};

/** @ignore */
const HOST_REGEX: RegExp = // tslint:disable:max-line-length
    /^(?:[A-Za-z\d]|[A-Za-z\d][A-Za-z\d-]{0,61}?[A-Za-z\d])(?:\.(?:[A-Za-z\d]|[A-Za-z\d][A-Za-z\d-]{0,61}?[A-Za-z\d]))*$/;
