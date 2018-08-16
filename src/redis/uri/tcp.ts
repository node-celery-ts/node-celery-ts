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

import { BasicRedisTcpOptions as Options } from "../basic_options";

import { ParseError } from "../../errors";
import { getScheme, parseUri, Queries, Scheme, Uri } from "../../uri";
import {
    isNullOrUndefined,
    parseBoolean,
    parseInteger,
    toCamelCase,
} from "../../utility";

import * as _ from "underscore";

/**
 * @param uri the URI to parse, should be of the format:
 * redis[s]://[user[:pass]@]host[:port][/db][?query=value[&query=value]...]
 * @returns The options parsed from `uri`.
 */
export const parse = (rawUri: string): Options => {
    const protocol = getScheme(rawUri);

    if (protocol !== Scheme.Redis && protocol !== Scheme.RedisSecure) {
        throw new ParseError(`unrecognized scheme "${protocol}"`);
    }

    const parsed = parseUri(rawUri);

    if (isNullOrUndefined(parsed.authority)) {
        throw new ParseError(`"${rawUri}" is missing authority`);
    }

    const rawOptions = addOptions(parsed, { protocol });
    const withQueries = addQueries(parsed, rawOptions);

    return withQueries;
};

/** @ignore */
enum Option {
    Database = "db",
    Hostname = "host",
    Password = "password",
    Port = "port",
}

/** @ignore */
interface TcpQueries {
    readonly noDelay?: boolean;
    readonly password?: string;
}

/** @ignore */
enum Query {
    NoDelay = "noDelay",
    Password = "password",
}

/** @ignore */
const addOptions = (uri: Uri, options: Options): Options =>
    _.reduce(
        _.values(Option),
        (iterating: Options, key: Option): Options => {
            switch (key) {
                case Option.Database:
                    return addDatabase(uri, iterating);
                case Option.Hostname:
                    return addHostname(uri, iterating);
                case Option.Password:
                    return addPassword(uri, iterating);
                case Option.Port:
                    return addPort(uri, iterating);
            }
        },
        options
    );

/** @ignore */
const addQueries = (uri: Uri, options: Options): Options => {
    if (isNullOrUndefined(uri.query)) {
        return options;
    }

    const queries = intoQueries(uri.query);

    return _.reduce(
        _.pairs(queries) as Array<[Query, any]>,
        (appending: Options,
         [property, value]: [Query, any]): Options => {
            switch (property) {
                case Query.NoDelay: return {
                    ...appending,
                    noDelay: value as boolean,
                };
                case Query.Password: return {
                    ...appending,
                    password: value as string,
                };
            }
        },
        options
    );
};

/** @ignore */
const intoQueries = (queries: Queries): TcpQueries =>
    _.reduce(
        _.pairs(queries) as Array<[string, any]>,
        (converting: TcpQueries, [key, value]: [string, any]): TcpQueries => {
            switch (toCamelCase(key)) {
                case "noDelay":
                    return {
                        ...converting,
                        noDelay: parseBoolean(value),
                    };
                case "password":
                    return {
                        ...converting,
                        password: value,
                    };
            }

            return converting;
        },
        { }
    );

/** @ignore */
const addDatabase = (uri: Uri, iterating: Options): Options => {
    if (uri.path === "/") {
        return iterating;
    }

    return {
        ...iterating,
        db: parseDb(uri.path),
    };
};

/** @ignore */
const addHostname = (uri: Uri, iterating: Options): Options => {
    const authority = uri.authority!;

    return {
        ...iterating,
        host: authority.host,
    };
};

/** @ignore */
const addPassword = (uri: Uri, iterating: Options): Options => {
    const authority = uri.authority!;

    if (isNullOrUndefined(authority.userInfo)
        || isNullOrUndefined(authority.userInfo.pass)) {
        return iterating;
    }

    return {
        ...iterating,
        password: authority.userInfo.pass,
    };
};

/** @ignore */
const addPort = (uri: Uri, iterating: Options): Options => {
    const authority = uri.authority!;

    if (isNullOrUndefined(authority.port)) {
        return iterating;
    }

    return {
        ...iterating,
        port: authority.port,
    };
};

/** @ignore */
const parseDb = (maybeDb: string): number => {
    const DB_INDEX: number = 1;

    const maybeMatches = /^\/0*(\d+)/.exec(maybeDb);

    if (isNullOrUndefined(maybeMatches)) {
        throw new ParseError(`unable to parse "${maybeDb}" as db path`);
    }

    const matches: RegExpExecArray = maybeMatches;

    return parseInteger(matches[DB_INDEX]);
};
