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

import { parseRedisQuery } from "./common";

import { BasicRedisTcpOptions as Options } from "../basic_options";

import { ParseError } from "../../errors";
import { getScheme, parseUri, Scheme, Uri } from "../../uri";
import { isNullOrUndefined, parseInteger, } from "../../utility";

import * as _ from "underscore";

/**
 * `uri` should be of the format:
 * redis[s]://[user[:pass]@]host[:port][/db][?query=value[&query=value]...]
 * snake_case query keys will be converted to camelCase. Supported queries are
 * `"noDelay"` and `"password"`,
 *
 * @param rawUri The URI to parse.
 * @returns The `Options` parsed from `uri`.
 *
 * @throws ParseError If `uri` is not a valid Redis Socket URI.
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

    return {
        ...rawOptions,
        ...parseRedisQuery(parsed),
    };
};

/**
 * Accepted options for TCP URIs.
 */
enum Option {
    Database = "db",
    Hostname = "host",
    Password = "password",
    Port = "port",
}

/**
 * TODO: restructure this to be less verbose and less duplicated.
 *
 * @param uri The URI to extract authority and path information from.
 * @param options The `Options` to fill non-query components to.
 * @returns `options` with database, hostname, password, and port filled in.
 *
 * @throws ParseError If the URI's path is not parsable as a non-negative base
 *                    10 number.
 */
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

/**
 * @param uri The URI to parse from.
 * @param iterating The `Options` object to draw defaults from.
 * @returns An `Options` object with database appended and all other members
 *          copied from `iterating`.
 *
 * @throws ParseError If `uri`'s path cannot be parsed as a database number.'
 */
const addDatabase = (uri: Uri, iterating: Options): Options => {
    if (uri.path === "/") {
        return iterating;
    }

    return {
        ...iterating,
        db: parseDb(uri.path),
    };
};

/**
 * @param uri The URI to parse from.
 * @param iterating The `Options` object to draw defaults from.
 * @returns An `Options` object with hostname appended and all other members
 *          copied from `iterating`.
 */
const addHostname = (uri: Uri, iterating: Options): Options => {
    const authority = uri.authority!;

    return {
        ...iterating,
        host: authority.host,
    };
};

/**
 * @param uri The URI to parse from.
 * @param iterating The `Options` object to draw defaults from.
 * @returns An `Options` object with password appended and all other members
 *          copied from `iterating`.
 */
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

/**
 * @param uri The URI to parse from.
 * @param iterating The `Options` object to draw defaults from.
 * @returns An `Options` object with port appended and all other members
 *          copied from `iterating`.
 */
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

/**
 * Uses `Utility.parseInteger` internally.
 *
 * @param maybeDb A datab
 * @returns A database index.
 */
const parseDb = (maybeDb: string): number => {
    const DB_INDEX: number = 1;

    const maybeMatches = /^\/0*(\d+)/.exec(maybeDb);

    if (isNullOrUndefined(maybeMatches)) {
        throw new ParseError(`unable to parse "${maybeDb}" as db path`);
    }

    const matches: RegExpExecArray = maybeMatches;

    return parseInteger(matches[DB_INDEX]);
};
