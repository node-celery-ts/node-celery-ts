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

import { BasicRedisSocketOptions as Options } from "../basic_options";

import { ParseError } from "../../errors";
import { getScheme, parseUri, Queries, Scheme, Uri } from "../../uri";
import { isNullOrUndefined, parseBoolean } from "../../utility";

import * as _ from "underscore";

/**
 * @param uri the URI to parse, should be of the format:
 * redis[s]+socket://path[?query=value[&query=value]...]
 * @returns the SocketOptions extracted from the URI string
 */
export const parse = (uri: string): Options => {
    const protocol = getScheme(uri);

    if (protocol !== Scheme.RedisSocket
        && protocol !== Scheme.RedisSocketSecure) {
        throw new ParseError(`unrecognized scheme "${protocol}"`);
    }

    const parsed = parseUri(uri);

    const path = parsed.path;

    const withQueries = addQueries(parsed, {
        path: validatePath(path),
        protocol
    });

    return withQueries;
};

interface SocketQueries {
    readonly noDelay?: boolean;
    readonly password?: string;
}

enum Query {
    NoDelay = "noDelay",
    Password = "password",
}

const validatePath = (path: string): string => {
    if (/^[^\0]+$/.test(path) !== true) {
        throw new ParseError(`invalid path "${path}"`);
    }

    return path;
};

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

const intoQueries = (queries: Queries): SocketQueries => {
    type FunctionList = Array<(appending: SocketQueries) => SocketQueries>;

    const functions: FunctionList = [
        appendNoDelay(queries),
        appendPassword(queries),
    ];

    const convert = (toConvert: SocketQueries) =>
        functions.reduce((x, f) => f(x), toConvert);

    return convert({ });
};

const appendNoDelay = (queries: Queries) => {
    const maybeNoDelay = queries.noDelay;

    if (isNullOrUndefined(maybeNoDelay)) {
        return identity;
    }

    const noDelay = parseBoolean(asScalar(maybeNoDelay));

    return (appending: SocketQueries): SocketQueries => ({
        ...appending,
        noDelay,
    });
};

const appendPassword = (queries: Queries) => {
    const maybePassword = queries.password;

    if (isNullOrUndefined(maybePassword)) {
        return identity;
    }

    const password = asScalar(maybePassword);

    return (appending: SocketQueries): SocketQueries => ({
        ...appending,
        password,
    });
};

const identity = (queries: SocketQueries): SocketQueries => queries;

const asScalar = <T>(maybeArray: T | Array<T>): T => {
    if (maybeArray instanceof Array) {
        const array = maybeArray;

        return array[array.length - 1];
    }

    const scalar = maybeArray;

    return scalar;
};
