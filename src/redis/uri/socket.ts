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

import { BasicRedisSocketOptions as Options } from "../basic_options";

import { ParseError } from "../../errors";
import { getScheme, parseUri, Scheme } from "../../uri";

import * as _ from "underscore";

/**
 * `uri` should be of the format:
 * redis[s]+socket://path[?query=value[&query=value]...]
 * Valid queries are `"noDelay"` and `"password"`. snake_case will be converted
 * to camelCase. If multiple duplicate queries are provided, the last one
 * provided will be used.
 *
 * @param uri The URI to parse.
 * @returns The `Options` parsed from `uri`.
 *
 * @throws ParseError If `uri` is not a valid Redis Socket URI.
 */
export const parse = (uri: string): Options => {
    const protocol = getScheme(uri);

    if (protocol !== Scheme.RedisSocket
        && protocol !== Scheme.RedisSocketSecure) {
        throw new ParseError(`unrecognized scheme "${protocol}"`);
    }

    const parsed = parseUri(uri);
    const path = parsed.path;

    return {
        path: validatePath(path),
        protocol,
        ...parseRedisQuery(parsed),
    };
};

/**
 * @param path The URI path to validate.
 * @returns `path`, if it is a valid Unix path.
 *
 * @throws ParseError If `path` contains a null-terminator (`'\0'`).
 */
const validatePath = (path: string): string => {
    if (/^[^\0]+$/.test(path) !== true) {
        throw new ParseError(`invalid path "${path}"`);
    }

    return path;
};
